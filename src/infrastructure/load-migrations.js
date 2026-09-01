import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function loadMigrations(directory = "db") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return Promise.all(files.map(async (name) => ({
    name,
    sql: await readFile(path.join(directory, name), "utf8")
  })));
}
