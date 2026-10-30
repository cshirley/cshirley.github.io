// Git persistence for the ledger: commit only the state file, push with bounded retries, and
// confirm the exact records on the remote before the caller continues. Git is injected so tests
// can use a temporary bare remote. Nothing here talks to a destination.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';

export class PersistError extends Error {}

/**
 * Git runner for a working directory. Inherited GIT_* variables (set when running inside a git
 * hook) are removed so the repository is always the one found from cwd.
 */
export const cleanGitEnv = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !k.startsWith('GIT_') || k === 'GIT_SSH_COMMAND' || k === 'GIT_TERMINAL_PROMPT'));
export const realGit = (cwd) => (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: cleanGitEnv() });

const remoteState = (git, remote, branch, file) => {
  git('fetch', remote, branch);
  return JSON.parse(git('show', `${remote}/${branch}:${file}`));
};

/** Every manifest attempt must appear on the remote identical to the local record. */
export function confirmed(local, remote, attempts, { requireStatus } = {}) {
  return attempts.every(({ id, adapter }) => {
    const a = remote?.[id]?.[adapter];
    const b = local?.[id]?.[adapter];
    if (requireStatus && a?.status !== requireStatus) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  });
}

/**
 * phase "reserve" or "results". attempts: [{ id, adapter, attemptId }]. readLocal returns the
 * current ledger object. Returns { committed, pushed }. Throws PersistError on any doubt.
 */
export async function persist({ git, file, message, attempts, readLocal, remote = 'origin', branch = 'master', retries = 3, requireStatus }) {
  const rel = path.isAbsolute(file) ? path.relative(realpathSync(git('rev-parse', '--show-toplevel').trim()), realpathSync(file)) : file;
  git('add', '--', rel);
  const dirty = git('status', '--porcelain', '--', rel).trim();
  if (!dirty) {
    // Nothing to commit: the remote must already hold these records.
    if (!confirmed(await readLocal(), remoteState(git, remote, branch, rel), attempts, { requireStatus })) throw new PersistError('ledger unchanged locally but remote does not hold the expected records');
    return { committed: false, pushed: false };
  }
  git('commit', '-m', message, '--', rel);
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      git('push', remote, `HEAD:${branch}`);
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      // The push result may be unknown: check the remote before deciding anything.
      let remoteNow;
      try {
        remoteNow = remoteState(git, remote, branch, rel);
      } catch {
        /* fall through to rebase */
      }
      if (remoteNow && confirmed(await readLocal(), remoteNow, attempts, { requireStatus })) {
        lastErr = undefined;
        break;
      }
      try {
        git('fetch', remote, branch);
        git('rebase', `${remote}/${branch}`);
      } catch (rebaseErr) {
        try { git('rebase', '--abort'); } catch { /* none in progress */ }
        throw new PersistError(`ledger conflict with remote ${branch}; reconcile manually (${rebaseErr.message.split('\n')[0]})`);
      }
    }
  }
  if (lastErr) throw new PersistError(`push failed after ${retries} attempts: ${lastErr.message.split('\n')[0]}`);
  if (!confirmed(await readLocal(), remoteState(git, remote, branch, rel), attempts, { requireStatus })) {
    throw new PersistError('remote ledger does not contain the expected records after push');
  }
  return { committed: true, pushed: true };
}
