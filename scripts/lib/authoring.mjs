// Authoring transitions: add -> approve -> schedule. These edit local post files only. They never
// commit, push or call a destination API.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { CATEGORIES, DESCRIPTION_MAX, DESCRIPTION_MIN, DESCRIPTION_REQUIRED_FROM, TAGS } from '../../src/data/taxonomy.ts';
import { root } from './dist.mjs';
import { editFrontMatter, setKey, setMapping } from './frontmatter.mjs';
import { DEFAULT_CADENCE, DEFAULT_WEEKDAY, scheduleReport } from './schedule.mjs';
import { DEFAULT_TIME, frontMatterDate, goLive, loadPosts, SITE, slugify, ukDateTime } from './posts.mjs';

export class AuthoringError extends Error {}
const fail = (msg) => {
  throw new AuthoringError(msg);
};
const parseDate = (fmDate) => new Date(fmDate.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
const byLower = (list) => new Map(list.map((v) => [v.toLowerCase(), v]));

/** Find one post by id, slug or unique part of one. */
export function findPost(posts, query) {
  const key = path.basename(query).replace(/\.md$/, '');
  const exact = posts.find((p) => p.id === key || p.slug === key);
  if (exact) return exact;
  const hits = posts.filter((p) => p.id.includes(key));
  if (hits.length === 1) return hits[0];
  fail(hits.length ? `"${query}" is ambiguous:\n  ${hits.map((p) => p.id).join('\n  ')}` : `"${query}" matches no post`);
}

/** Editorial lifecycle state of a post, for status output and transition guards. */
export function editorialState(post, now = Date.now()) {
  if (!post.published) return 'unpublished';
  if (post.live) return post.approvalOk ? 'live' : 'live (approval missing)';
  if (post.scheduled) return post.approvalStatus === 'stale' || post.approvalStatus === 'missing' ? `scheduled (approval ${post.approvalStatus})` : 'scheduled';
  if (post.approvalStatus === 'approved') return 'approved';
  if (post.approvalStatus === 'stale') return 'approval stale';
  return post.date.valueOf() <= now ? 'draft (date past)' : 'draft';
}

// ---------------------------------------------------------------------------------------------
// add

export async function addPost(opts, { sourceRoot = root, now = Date.now() } = {}) {
  if (!opts.title || !opts.category) fail('--title and --category are required');
  const category = byLower(CATEGORIES).get(opts.category.trim().toLowerCase());
  if (!category) fail(`Unknown category "${opts.category}". Use one of: ${CATEGORIES.join(', ')}`);
  const tagMap = byLower(TAGS);
  const tags = [];
  const unknown = [];
  for (const raw of (opts.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean)) {
    const t = tagMap.get(raw.toLowerCase());
    if (t) tags.push(t);
    else unknown.push(raw);
  }
  if (unknown.length) {
    const near = (u) =>
      TAGS.filter((t) => {
        const [a, b] = [t.toLowerCase(), u.toLowerCase()];
        return a.includes(b) || b.includes(a) || a.replace(/s$/, '') === b.replace(/s$/, '');
      });
    fail(
      unknown.map((u) => `Unknown tag "${u}".${near(u).length ? ` Did you mean: ${near(u).join(', ')}?` : ''}`).join('\n') +
        '\nReuse an existing tag, or add the new one to src/data/taxonomy.ts first.',
    );
  }
  if (opts.description) {
    const n = opts.description.trim().length;
    if (n < DESCRIPTION_MIN || n > DESCRIPTION_MAX) fail(`Description is ${n} characters; it must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}.`);
  }
  const time = opts.time ?? DEFAULT_TIME;
  if (!/^\d{2}:\d{2}$/.test(time)) fail('--time must be HH:MM (UK local time)');

  const posts = await loadPosts(now, { sourceRoot });
  const date = opts.date ?? scheduleReport(posts, { now }).nextSlot;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date must be YYYY-MM-DD');
  const slug = opts.slug ? slugify(opts.slug) : slugify(opts.title).split('-').slice(0, 8).join('-');
  const id = `${date}-${slug}`;
  const file = path.join(sourceRoot, 'src/content/posts', `${id}.md`);
  if (existsSync(file)) fail(`${path.relative(sourceRoot, file)} already exists.`);
  const sameSlug = posts.find((p) => p.slug === slug);
  if (sameSlug) fail(`Slug "${slug}" is already used by ${sameSlug.id}. Pass --slug to choose another.`);

  const fm = {
    title: opts.title.trim(),
    description: opts.description?.trim() ?? 'TODO: one or two sentences (80-320 characters) for listings, RSS and the post lead.',
    date: frontMatterDate(date, time),
    draft: true,
    categories: [category],
    tags,
    author: { display_name: 'Clive Shirley' },
  };
  // Dates stay unquoted to match existing posts; titles are double-quoted, like recent posts.
  const yaml = stringify(fm, { lineWidth: 0, indentSeq: false })
    .replace(/^date: (['"])(.*)\1$/m, 'date: $2')
    .replace(/^title: .*$/m, `title: ${JSON.stringify(fm.title)}`);
  const body = `<!-- Opening: the problem or situation in two or three short paragraphs, then one line
     saying what this post covers. See docs/writing-style.md. -->

## TODO: first section heading (sentence case)

## The general lesson

<!-- What a reader can take away and apply elsewhere. -->
`;
  await writeFile(file, `---\n${yaml}---\n\n${body}`);
  return { id, file, date, slug, hasDescription: Boolean(opts.description), url: `${SITE}/${slugify(category)}/${date.replaceAll('-', '/')}/${slug}.html` };
}

// ---------------------------------------------------------------------------------------------
// approve

/** Problems that stop a post being approved. Warnings do not. */
export function approvalProblems(post) {
  const errors = [];
  const warnings = [];
  const fm = post.fm;
  if (!post.published) errors.push('post has published: false');
  if (post.live) errors.push('post is already live; approval applies to unpublished posts');
  const cats = fm.categories ?? [];
  if (!cats.length) errors.push('at least one category is required');
  for (const c of cats) if (!CATEGORIES.includes(c)) errors.push(`unknown category "${c}"`);
  for (const t of fm.tags ?? []) if (!TAGS.includes(t)) errors.push(`unknown tag "${t}"`);
  const desc = String(fm.description ?? '');
  if (!desc && post.date >= DESCRIPTION_REQUIRED_FROM) errors.push('description is required');
  if (desc && (desc.length < DESCRIPTION_MIN || desc.length > DESCRIPTION_MAX)) {
    errors.push(`description is ${desc.length} characters; it must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}`);
  }
  for (const [where, value] of [['title', fm.title ?? ''], ['description', desc], ['body', post.body]]) {
    if (/\bTODO\b/.test(value)) errors.push(`placeholder TODO left in ${where}`);
  }
  if (!/^##\s+The general lesson\s*$/m.test(post.body)) warnings.push('no "## The general lesson" closing section (docs/writing-style.md)');
  return { errors, warnings };
}

export async function approvePost(query, { sourceRoot = root, now = Date.now() } = {}) {
  const post = findPost(await loadPosts(now, { sourceRoot }), query);
  const { errors, warnings } = approvalProblems(post);
  if (errors.length) fail(`${post.id} cannot be approved:\n  - ${errors.join('\n  - ')}`);
  const at = new Date(now).toISOString();
  const print = post.fingerprint;
  const renewed = post.approvalStatus === 'stale';
  const src = await readFile(post.file, 'utf8');
  await writeFile(post.file, editFrontMatter(src, (y) => setMapping(y, 'approval', { at, fingerprint: print })));
  return { post, at, fingerprint: print, renewed, warnings };
}

// ---------------------------------------------------------------------------------------------
// schedule

const tracked = (file) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: path.dirname(file), stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** Quote-delimited id references in src/ (curation, lessons, work...), excluding the posts. */
function idReferences(sourceRoot, id) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (p !== path.join(sourceRoot, 'src/content/posts')) walk(p);
      } else if (/\.(ts|mjs|astro|json)$/.test(e.name) && readFileSync(p, 'utf8').includes(id)) out.push(p);
    }
  };
  walk(path.join(sourceRoot, 'src'));
  return out;
}

/** Refuse to orphan destination records or approval data when an id changes. */
function checkRenameSafe(sourceRoot, oldId) {
  const statePath = path.join(sourceRoot, 'src/data/crosspost-state.json');
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    if (state[oldId]) fail(`${oldId} has cross-post records (${Object.keys(state[oldId]).join(', ')}). Reconcile or remove them before renaming.`);
  }
}

export async function schedulePost(query, opts = {}, { sourceRoot = root, now = Date.now() } = {}) {
  const posts = await loadPosts(now, { sourceRoot });
  const post = findPost(posts, query);
  if (post.live) fail(`${post.id} is live at ${post.urlPath}. Its URL contains the date, so it cannot be moved. If you must, edit it by hand and add a redirect in astro.config.mjs.`);
  if (!post.published) fail(`${post.id} has published: false`);
  if (post.approvalStatus !== 'approved' && post.approvalStatus !== 'baseline') {
    fail(`${post.id} is ${post.approvalStatus === 'stale' ? 'edited since approval' : 'not approved'}. Run: npm run post:approve -- ${post.id}`);
  }
  const time = opts.time ?? post.date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
  if (!/^\d{2}:\d{2}$/.test(time)) fail('--time must be HH:MM (UK local time)');
  const others = posts.filter((p) => p.id !== post.id);
  const date = opts.date ?? (opts.next ? scheduleReport(others, { now, cadence: opts.cadence, weekday: opts.weekday }).nextSlot : null);
  if (!date) fail('Pass --next or --date YYYY-MM-DD');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date must be YYYY-MM-DD');
  const stamp = frontMatterDate(date, time);
  const when = parseDate(stamp);
  if (Number.isNaN(when.valueOf()) || when.valueOf() <= now) fail(`${date} ${time} UK is not in the future. Pick a later date.`);

  const newId = `${date}-${post.slug}`;
  const newFile = path.join(sourceRoot, 'src/content/posts', `${newId}.md`);
  if (newId !== post.id) {
    if (existsSync(newFile)) fail(`${path.relative(sourceRoot, newFile)} already exists.`);
    checkRenameSafe(sourceRoot, post.id);
  }
  const src = await readFile(post.file, 'utf8');
  writeFileSync(post.file, editFrontMatter(src, (y) => setKey(setKey(y, 'date', stamp), 'draft', 'false')));
  let updatedRefs = [];
  if (newId !== post.id) {
    if (tracked(post.file)) execFileSync('git', ['mv', post.file, newFile], { cwd: path.dirname(post.file) });
    else await rename(post.file, newFile);
    updatedRefs = idReferences(sourceRoot, post.id);
    for (const file of updatedRefs) {
      writeFileSync(file, readFileSync(file, 'utf8').replace(new RegExp(`(['"\`])${post.id}\\1`, 'g'), `$1${newId}$1`));
    }
  }
  const nearby = others.filter((p) => p.published && Math.abs(p.date - when) < 7 * 86_400_000).map((p) => p.id);
  const rebuild = scheduleReport(posts, { now }).rebuild;
  const live = goLive(when, rebuild);
  return { id: newId, from: post.id, stamp, when, url: `${SITE}${post.urlPath.replace(/\/\d{4}\/\d{2}\/\d{2}\/.*$/, '')}/${date.replaceAll('-', '/')}/${post.slug}.html`, goLive: live, updatedRefs, nearby };
}

// ---------------------------------------------------------------------------------------------
// status

/** Text status report: editorial state, schedule, cadence and destination state. */
export async function statusReport({ sourceRoot = root, now = Date.now(), cadence = DEFAULT_CADENCE, weekday = DEFAULT_WEEKDAY } = {}) {
  const posts = await loadPosts(now, { sourceRoot });
  const sched = scheduleReport(posts, { now, cadence, weekday });
  const statePath = path.join(sourceRoot, 'src/data/crosspost-state.json');
  let ledger = {};
  let ledgerNote = '';
  if (existsSync(statePath)) {
    try {
      ledger = JSON.parse(readFileSync(statePath, 'utf8'));
    } catch (err) {
      ledgerNote = `! cross-post state unreadable: ${err.message}`;
    }
  }
  const day = (d) => `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })} ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  const dests = (id) => {
    const rec = ledger[id];
    return rec ? Object.entries(rec).map(([k, v]) => `${k}:${v.status}`).join(' ') : '';
  };
  const out = [];
  const pending = posts.filter((p) => p.published && !p.live).sort((a, b) => a.date - b.date);
  out.push(`Not yet live (${pending.length})`);
  for (const p of pending) {
    const gl = p.scheduled ? sched.goLive(p) : null;
    const note = p.approvalStatus === 'stale' ? '  ! edited since approval' : '';
    out.push(`  ${day(p.date).padEnd(17)} ${editorialState(p, now).padEnd(22)} ${p.id.slice(11)}${gl ? `  live ${ukDateTime(gl)} UK` : ''}${note}`);
  }
  const recent = sched.live.slice(-3).reverse();
  out.push('', 'Recently live');
  for (const p of recent) out.push(`  ${day(p.date).padEnd(17)} ${p.id.slice(11).padEnd(50)} ${dests(p.id)}`);
  const unresolved = Object.entries(ledger).flatMap(([id, rec]) => Object.entries(rec).filter(([, v]) => v.status === 'needs-review').map(([a, v]) => `${id} ${a} attempt ${v.attemptId}`));
  out.push('', `Cross-posting: ${unresolved.length ? `${unresolved.length} attempt(s) need review` : 'no unresolved attempts'}`);
  for (const u of unresolved) out.push(`  ! ${u}`);
  if (ledgerNote) out.push(`  ${ledgerNote}`);
  out.push('', `Cadence (every ${cadence} days)`);
  if (!sched.issues.length) out.push('  OK');
  for (const i of sched.issues) {
    out.push(i.type === 'clash' ? `  ! ${i.between.join(' and ')} are ${i.days} day(s) apart` : `  ! ${i.days}-day gap after ${i.between[0]}${i.suggest ? ` (fill on ${i.suggest})` : ''}`);
  }
  out.push('', `Next free slot: ${sched.nextSlot}`);
  return { text: out.join('\n'), posts, sched };
}
