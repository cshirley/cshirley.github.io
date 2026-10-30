// Minimal, line-preserving front matter edits, so authoring commands change only the fields they
// own and leave the rest of a post byte-for-byte as written.
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Apply fn(yamlText) -> yamlText to a post's front matter. Throws if there is none. */
export function editFrontMatter(src, fn) {
  const m = src.match(FRONT);
  if (!m) throw new Error('post has no front matter');
  const closing = m[0].match(/\r?\n---\r?\n?$/)[0];
  return `---\n${fn(m[1])}${closing}${src.slice(m[0].length)}`;
}

const escape = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remove a top-level key and its indented children. */
export const removeKey = (yaml, key) =>
  yaml.replace(new RegExp(`^${escape(key)}:.*(?:\\r?\\n[ \\t]+.*)*(?:\\r?\\n|$)`, 'm'), '').replace(/\r?\n$/, '');

/** Set a top-level key to a raw YAML value (replaces the line, or appends). */
export function setKey(yaml, key, raw) {
  const re = new RegExp(`^${escape(key)}:.*$`, 'm');
  return re.test(yaml) ? yaml.replace(re, `${key}: ${raw}`) : `${yaml}\n${key}: ${raw}`;
}

/** Replace (or append) a top-level mapping with the given scalar children. */
export function setMapping(yaml, key, entries) {
  const without = removeKey(yaml, key);
  const lines = Object.entries(entries).map(([k, v]) => `  ${k}: ${v}`);
  return `${without}\n${key}:\n${lines.join('\n')}`;
}
