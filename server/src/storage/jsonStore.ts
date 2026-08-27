import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

const writeQueues = new Map<string, Promise<void>>();

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const prev = writeQueues.get(filePath) || Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  writeQueues.set(filePath, prev.then(() => next));
  await prev;
  try {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmp, filePath);
  } finally {
    resolve();
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath);
  }
}

export function dataPath(baseDir: string, name: string): string {
  return join(baseDir, `${name}.json`);
}
