/**
 * The widget's Module map: the layers under `src`, what each may import, and
 * where Modules start. Every architecture check derives its paths from here:
 * the dependency-cruiser rules, the Module cycle check, and the oxlint rules
 * that apply to Module interfaces.
 *
 * A Module is an immediate child of a Module layer (a directory or a single
 * file), a child of a Module Collection, or a whole other layer. Its root
 * files are its interface; its subdirectories are private.
 */

export const layerNames = [
  "app",
  "features",
  "runtime",
  "resources",
  "services",
  "domain",
  "shared",
  "generated",
  "public-api",
  "ui",
] as const;

export type LayerName = (typeof layerNames)[number];

/** What each layer may import: a default-deny matrix. */
export const layerImports: Readonly<
  Record<LayerName, ReadonlyArray<LayerName>>
> = {
  app: [
    "app",
    "features",
    "runtime",
    "resources",
    "services",
    "domain",
    "shared",
    "public-api",
    "ui",
  ],
  features: [
    "features",
    "runtime",
    "resources",
    "services",
    "domain",
    "shared",
    "public-api",
    "ui",
  ],
  runtime: ["runtime", "services", "domain", "shared", "public-api"],
  resources: [
    "resources",
    "runtime",
    "services",
    "domain",
    "shared",
    "public-api",
  ],
  services: ["services", "domain", "shared", "generated", "public-api"],
  domain: ["domain", "generated"],
  shared: ["shared", "domain"],
  generated: ["generated"],
  "public-api": ["domain", "public-api"],
  ui: ["ui"],
};

/** Source directories that hold only ambient declarations. */
export const ambientDirectories = ["types"] as const;

/**
 * Layers whose immediate children are Modules; every other layer is one
 * Module. Application composition (`app`) is one Module: it composes the
 * others, and nothing but the package entries and `App.tsx` imports it.
 */
export const moduleLayers = [
  "features",
  "resources",
  "services",
  "domain",
  "shared",
] as const satisfies ReadonlyArray<LayerName>;

/** Modules whose subdirectories are child Modules rather than private code. */
export const moduleCollections = ["src/features/borrow"] as const;

/**
 * Root files with a fixed audience. Any other root file of a Module is part of
 * its main interface.
 */
export const interfaceRoles = [
  "index",
  "composition",
  "views",
  "runtime",
] as const;

/** Feature tiers, from the most to the least dependent. */
export const featureTiers = ["ui", "state", "model"] as const;

/** Application composition: everything in `app` but its runtime assembly. */
export const appCompositionPaths = ["^src/app/(?!runtime/)", "^src/App\\.tsx$"];

/** Runtime construction and assembly. */
export const runtimeAssemblyPath = "^src/(?:app/)?runtime/";

/** A regular expression source matching a Module root directory, unanchored. */
export const moduleRootPattern = `src/(?:${moduleLayers.join("|")})/[^/]+`;

/** A regular expression source matching a collection child Module root. */
export const collectionChildPattern = `(?:${moduleCollections.join("|")})/[^/]+`;

/** The Module that owns `path`, a `src`-relative POSIX path. */
export const resolveModule = (path: string): string | null => {
  const segments = path.split("/");
  if (segments[0] !== "src" || segments.length < 2) return null;
  if (segments.length === 2) return path;

  const layer = segments[1] ?? "";
  if (!(moduleLayers as ReadonlyArray<string>).includes(layer)) {
    return `src/${layer}`;
  }

  const owner = segments.slice(0, 3).join("/");
  const isCollection = (moduleCollections as ReadonlyArray<string>).includes(
    owner
  );
  return isCollection && segments.length > 4
    ? segments.slice(0, 4).join("/")
    : owner;
};

/** Globs matching every Module interface file, for file-scoped lint rules. */
export const moduleInterfaceGlobs: ReadonlyArray<string> = [
  ...moduleLayers.flatMap((layer) => [
    `src/${layer}/*.ts`,
    `src/${layer}/*/*.ts`,
  ]),
  ...moduleCollections.map((collection) => `${collection}/*/*.ts`),
  "src/ui/index.ts",
  "src/ui/composition.ts",
];
