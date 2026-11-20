/**
 * Host translation keys the Widget renamed: copy under `dashboard.*` moved to
 * the namespace of the Feature that shows it, as both Layouts show most of it.
 * A host's `customTranslations` still reach their copy under the old keys
 * until the next major version; each such key is reported once.
 *
 * A prefix ending in "." renames a subtree; any other renames one key and its
 * plural and context forms (`_one`, `_other`, `_ethena_usde`, ...).
 */
const renamedKeyPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["dashboard.details.tabs.", "tabs."],
  ["dashboard.details.positions_sections.", "positions.sections."],
  ["dashboard.details.my_positions", "positions.my_positions"],
  ["dashboard.details.positions_active", "positions.active"],
  [
    "dashboard.details.positions_connect_wallet",
    "positions.connect_wallet_prompt",
  ],
  ["dashboard.details.positions_partial_error", "positions.partial_error"],
  ["dashboard.details.activity_connect_wallet", "activity.connect_wallet"],
  ["dashboard.borrow.", "borrow."],
  ["dashboard.activity_details.", "activity_details."],
  ["dashboard.earn_details.", "earn_details."],
  ["dashboard.overview.", "portfolio."],
  ["dashboard.position_details.", "position_details."],
  ["dashboard.split_view.", "split_view."],
];

const renamedKey = (key: string): string | null => {
  for (const [from, to] of renamedKeyPrefixes) {
    const matches = from.endsWith(".")
      ? key.startsWith(from)
      : key === from || key.startsWith(`${from}_`);
    if (matches) return to + key.slice(from.length);
  }
  return null;
};

interface TranslationTree {
  readonly [key: string]: string | TranslationTree;
}

type LanguageTranslations = Readonly<{
  readonly translation: TranslationTree;
}>;

type CustomTranslations = Readonly<{
  readonly en?: LanguageTranslations;
  readonly fr?: LanguageTranslations;
}>;

export type RenamedTranslationKey = Readonly<{
  readonly from: string;
  readonly to: string;
}>;

const toLeaves = (
  tree: TranslationTree,
  prefix = ""
): ReadonlyArray<readonly [string, string]> =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string"
      ? [[path, value] as const]
      : toLeaves(value, path);
  });

type MutableTree = { [key: string]: string | MutableTree };

/** Builds a tree from leaves; a leaf whose path an earlier one blocks is dropped. */
const fromLeaves = (
  leaves: ReadonlyArray<readonly [string, string]>
): TranslationTree => {
  const tree: MutableTree = {};
  for (const [path, value] of leaves) {
    const keys = path.split(".");
    const last = keys.pop();
    if (last === undefined) continue;
    let node: MutableTree | undefined = tree;
    for (const key of keys) {
      const child: string | MutableTree = node[key] ?? {};
      if (typeof child === "string") {
        node = undefined;
        break;
      }
      node[key] = child;
      node = child;
    }
    if (node && !(last in node)) node[last] = value;
  }
  return tree;
};

const migrateTree = (tree: TranslationTree) => {
  const leaves = toLeaves(tree);
  const ownKeys = new Set(leaves.map(([path]) => path));
  const renamed: Array<RenamedTranslationKey> = [];
  const migrated = leaves.flatMap(([path, value]) => {
    const to = renamedKey(path);
    if (to === null) return [[path, value] as const];
    renamed.push({ from: path, to });
    // The host's own translation for the new key wins over its old one.
    return ownKeys.has(to) ? [] : [[to, value] as const];
  });
  return { renamed, translation: fromLeaves(migrated) };
};

/**
 * `customTranslations` with copy set under renamed keys moved to their new
 * keys, and every renamed key the host set, each once.
 */
export const migrateLegacyTranslationKeys = (
  customTranslations: CustomTranslations | undefined
): Readonly<{
  customTranslations: CustomTranslations | undefined;
  renamed: ReadonlyArray<RenamedTranslationKey>;
}> => {
  if (!customTranslations) return { customTranslations, renamed: [] };
  const en = customTranslations.en
    ? migrateTree(customTranslations.en.translation)
    : null;
  const fr = customTranslations.fr
    ? migrateTree(customTranslations.fr.translation)
    : null;
  const renamed = new Map(
    [...(en?.renamed ?? []), ...(fr?.renamed ?? [])].map((key) => [
      key.from,
      key,
    ])
  );
  return {
    customTranslations: {
      ...(en ? { en: { translation: en.translation } } : {}),
      ...(fr ? { fr: { translation: fr.translation } } : {}),
    },
    renamed: [...renamed.values()],
  };
};
