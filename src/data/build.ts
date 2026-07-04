/**
 * Build-time provenance — REAL data only, never faked.
 *
 * The relaunch's meta-story is that the site itself is the demo of an
 * AI-run business ("this site is maintained by AI agents"). The proof
 * strip renders these values, so they must be genuine build-time facts:
 *   - `buildTime`  : the moment `astro build` ran (Astro evaluates module
 *                    frontmatter at build for static output).
 *   - `commit`     : the short git SHA the build was produced from.
 *   - `commitFull` : the full SHA, for anyone who wants to verify.
 *
 * If git isn't available (e.g. a source tarball with no .git), we degrade
 * honestly to `unknown` rather than inventing a value.
 */
import { execSync } from 'node:child_process';

function readGit(args: string): string | null {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const commitFull = readGit('rev-parse HEAD');
const commit = readGit('rev-parse --short HEAD');

export const build = {
  /** ISO timestamp of when this build was produced. */
  time: new Date(),
  /** Short git SHA, or null if git was unavailable. */
  commit: commit,
  /** Full git SHA, or null if git was unavailable. */
  commitFull: commitFull,
} as const;

/** e.g. "3 Jul 2026, 22:56 UTC" — stable, locale-fixed, honest. */
export function formatBuildStamp(d: Date = build.time): string {
  const date = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
  return `${date}, ${time} UTC`;
}
