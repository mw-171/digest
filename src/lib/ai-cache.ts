import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Claude's answers, kept on disk between dev-server restarts.
 *
 * Every key carries a prompt version and the exact inputs it was computed
 * from, so a hit is only ever the same question asked twice. That is what lets
 * the digest recompute from Gmail on every reload without re-billing triage.
 */
function cacheDir() {
  return path.join(process.cwd(), ".cache", "digest");
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(cacheDir(), key), "utf8")) as T;
  } catch {
    return null; // no entry yet, or an unreadable one — the caller recomputes
  }
}

export async function writeCache(key: string, value: unknown) {
  try {
    await mkdir(cacheDir(), { recursive: true });
    await writeFile(path.join(cacheDir(), key), JSON.stringify(value), "utf8");
  } catch (error) {
    console.warn("Could not write the AI cache", error);
  }
}

/** Every cached file whose name starts with `prefix`. */
export async function listCache(prefix: string) {
  try {
    return (await readdir(cacheDir())).filter((name) => name.startsWith(prefix));
  } catch {
    return [];
  }
}
