/**
 * The rules `check-translations` applies to the translation files: English
 * and French hold the same keys with the same placeholders, and every key is
 * read somewhere in `src`.
 */

interface TranslationTree {
  readonly [key: string]: unknown;
}

/** Every string leaf of a translation tree, by dotted path. */
export const translationLeaves = (
  tree: TranslationTree,
  prefix = ""
): ReadonlyMap<string, string> =>
  new Map(
    Object.entries(tree).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") return [[path, value] as const];
      return value !== null && typeof value === "object"
        ? [...translationLeaves(value as TranslationTree, path)]
        : [];
    })
  );

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}|<(\w+)>/g)]
    .map(([, name, tag]) => name ?? tag)
    .sort((a = "", b = "") => a.localeCompare(b))
    .join(",");

/**
 * Keys one language has and the other lacks, and keys whose placeholders or
 * components differ between them.
 */
export const findParityIssues = (
  english: ReadonlyMap<string, string>,
  french: ReadonlyMap<string, string>
): ReadonlyArray<string> => [
  ...[...english.keys()]
    .filter((key) => !french.has(key))
    .map((key) => `French lacks ${key}`),
  ...[...french.keys()]
    .filter((key) => !english.has(key))
    .map((key) => `English lacks ${key}`),
  ...[...english].flatMap(([key, value]) => {
    const other = french.get(key);
    return other !== undefined && placeholders(other) !== placeholders(value)
      ? [`${key} has different placeholders in French`]
      : [];
  }),
];

// i18next appends plural (`_one`) and context (`_ethena_usde`) suffixes to the
// key it is given, so a key is read when any `_`-cut of its last segment is.
const readForms = (key: string) => {
  const dot = key.lastIndexOf(".");
  const parent = key.slice(0, dot + 1);
  const segments = key.slice(dot + 1).split("_");
  return segments.map((_, index) =>
    parent.concat(segments.slice(0, index + 1).join("_"))
  );
};

/**
 * Keys no source reads: neither as a string literal, nor through a template
 * literal's static prefix (`` `borrow.tx_type.${type}` ``), nor through an
 * object an ancestor key returns. `errors.*` holds the API's error catalogue,
 * looked up by the error the API returns.
 */
export const findUnusedKeys = (
  keys: Iterable<string>,
  source: string
): ReadonlyArray<string> => {
  const literals = new Set(
    [...source.matchAll(/["']([a-z0-9_]+(?:\.[\w-]+)+)["']/g)].map(
      ([, key]) => key
    )
  );
  const templatePrefixes = [
    ...source.matchAll(/`([a-z0-9_]+(?:\.[\w-]+)*[._])\$\{/g),
  ].flatMap(([, prefix]) => (prefix ? [prefix] : []));
  return [...keys].filter((key) => {
    const segments = key.split(".");
    // An ancestor below the top level, read whole (`returnObjects`).
    const ancestors = segments
      .slice(2)
      .map((_, index) => segments.slice(0, index + 2).join("."));
    return (
      !key.startsWith("errors.") &&
      !readForms(key).some((form) => literals.has(form)) &&
      !templatePrefixes.some((prefix) => key.startsWith(prefix)) &&
      !ancestors.some((ancestor) => literals.has(ancestor))
    );
  });
};
