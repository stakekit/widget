/**
 * The JavaScript a host downloads before an entry runs, read from the Vite
 * build manifest (`dist/<build>/.vite/manifest.json`). Library builds list the
 * stylesheet under its own key, unlinked from the entry, so it is not counted.
 */

type ManifestChunk = Readonly<{
  file: string;
  imports?: ReadonlyArray<string>;
}>;

export type BuildManifest = Readonly<Record<string, ManifestChunk>>;

/**
 * The entry's file and every chunk it reaches through static imports. Chunks
 * behind `import()` load on demand, so they are left out.
 */
export const entryLoadFiles = (
  manifest: BuildManifest,
  entry: string
): ReadonlySet<string> => {
  if (manifest[entry] === undefined) {
    throw new Error(`The build manifest has no chunk for ${entry}.`);
  }
  const files = new Set<string>();
  const visited = new Set<string>();
  const pending = [entry];
  for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
    const chunk = manifest[key];
    if (chunk === undefined || visited.has(key)) continue;
    visited.add(key);
    files.add(chunk.file);
    pending.push(...(chunk.imports ?? []));
  }
  return files;
};
