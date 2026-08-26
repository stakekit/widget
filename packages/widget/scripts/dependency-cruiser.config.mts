import type { IConfiguration, IForbiddenRuleType } from "dependency-cruiser";

const layerNames = [
  "app",
  "features",
  "resources",
  "services",
  "domain",
  "shared",
  "generated",
  "public-api",
] as const;
const ambientSourceDirectories = ["types"] as const;
type LayerName = (typeof layerNames)[number];
type InterfaceName = "index" | "composition" | "views" | "runtime";
type AudienceName =
  | "app-composition"
  | "app-runtime"
  | "borrow-composition"
  | "borrow-runtime";

type LayerDeclaration = Readonly<{
  name: LayerName;
  mayImport: ReadonlyArray<LayerName>;
  additionalTargets?: ReadonlyArray<"app-runtime">;
}>;

export type ModuleCollectionDeclaration = Readonly<{
  kind: "feature" | "nested-feature" | "resource";
  root: string;
  interfaces: ReadonlyArray<InterfaceName>;
  interfaceAudiences?: Partial<
    Readonly<Record<InterfaceName, ReadonlyArray<AudienceName>>>
  >;
  excludedChildren?: ReadonlyArray<string>;
  parent?: string;
}>;

export type OwnedModuleDeclaration = Readonly<{
  kind: "api";
  root: string;
  interfaces: Readonly<
    Record<"resource-sources" | "operations" | "runtime", ReadonlyArray<string>>
  >;
}>;

type GeneratedRuntimeDeclaration = Readonly<{
  files: ReadonlyArray<string>;
  importers: ReadonlyArray<string>;
  root: string;
}>;

const defineLayer = (declaration: LayerDeclaration) => declaration;
const moduleCollection = (declaration: ModuleCollectionDeclaration) =>
  declaration;
const ownedModule = (declaration: OwnedModuleDeclaration) => declaration;

export const architecturePolicy = {
  layers: [
    defineLayer({
      name: "app",
      mayImport: [
        "app",
        "features",
        "resources",
        "services",
        "domain",
        "shared",
        "public-api",
      ],
    }),
    defineLayer({
      name: "features",
      mayImport: [
        "features",
        "resources",
        "services",
        "domain",
        "shared",
        "public-api",
      ],
      additionalTargets: ["app-runtime"],
    }),
    defineLayer({
      name: "resources",
      mayImport: ["resources", "services", "domain", "shared", "public-api"],
      additionalTargets: ["app-runtime"],
    }),
    defineLayer({
      name: "services",
      mayImport: ["services", "domain", "shared", "generated", "public-api"],
    }),
    defineLayer({
      name: "domain",
      mayImport: ["domain", "generated"],
    }),
    defineLayer({
      name: "shared",
      mayImport: ["shared", "domain", "public-api"],
    }),
    defineLayer({ name: "generated", mayImport: ["generated"] }),
    defineLayer({
      name: "public-api",
      mayImport: ["domain", "public-api"],
    }),
  ],
  moduleCollections: [
    moduleCollection({
      kind: "feature",
      root: "src/features",
      interfaces: ["index", "composition", "views", "runtime"],
      interfaceAudiences: {
        composition: ["app-composition"],
        runtime: ["app-runtime"],
      },
    }),
    moduleCollection({
      kind: "nested-feature",
      root: "src/features/borrow",
      interfaces: ["index", "composition", "views", "runtime"],
      interfaceAudiences: {
        composition: ["borrow-composition"],
        runtime: ["borrow-runtime"],
      },
      excludedChildren: ["model", "react", "state", "ui"],
      parent: "src/features/borrow",
    }),
    moduleCollection({
      kind: "resource",
      root: "src/resources",
      interfaces: ["index"],
    }),
  ],
  ownedModules: [
    ownedModule({
      kind: "api",
      root: "src/services/api",
      interfaces: {
        "resource-sources": ["src/resources"],
        operations: [
          "src/features/*/state/orchestration",
          "src/services/transaction-workflow/internal",
        ],
        runtime: ["src/app/runtime"],
      },
    }),
  ],
  generatedRuntime: {
    root: "src/generated/api",
    files: ["borrow-client", "legacy", "yield"],
    importers: ["src/services/api"],
  } satisfies GeneratedRuntimeDeclaration,
} as const;

const layerRoot = `^src/(?:${layerNames.join("|")})/`;
const declaredSourceDirectories = [
  ...layerNames,
  ...ambientSourceDirectories,
] as const;
const undeclaredLayerPath = `^src/(?!(?:${declaredSourceDirectories.join("|")})(?:/|$))[^/]+/`;
const layerPath = (name: LayerName) => `^src/${name}/`;
const audiencePaths: Readonly<Record<AudienceName, ReadonlyArray<string>>> = {
  "app-composition": ["^src/app/(?!runtime/)", "^src/App\\.tsx$"],
  "app-runtime": ["^src/app/runtime/"],
  "borrow-composition": ["^src/features/borrow/composition\\.ts$"],
  "borrow-runtime": ["^src/features/borrow/runtime\\.ts$"],
};
const ownedModulePath =
  "^(?:src/features/[^/]+/|src/resources/[^/]+/|src/services/api/)";

const makeLayerRules = (): IForbiddenRuleType[] =>
  architecturePolicy.layers.map((layer) => ({
    name: `layer-${layer.name}`,
    severity: "error",
    comment: `${layer.name} dependencies follow the default-deny layer matrix.`,
    from: { path: layerPath(layer.name) },
    to: {
      path: layerRoot,
      pathNot: [
        ...layer.mayImport.map(layerPath),
        ...(layer.additionalTargets?.map((target) =>
          target === "app-runtime" ? "^src/app/runtime/" : target
        ) ?? []),
      ],
    },
  }));

const makeGeneratedRuntimeRules = (): IForbiddenRuleType[] => {
  const declaration = architecturePolicy.generatedRuntime;
  return [
    {
      name: "generated-runtime-clients-private",
      severity: "error",
      from: {
        pathNot: declaration.importers.map(directoryPattern),
      },
      to: {
        path: `^${declaration.root}/(?:${declaration.files.join("|")})\\.ts$`,
      },
    },
  ];
};

type CompiledCollection = Readonly<{
  kind: ModuleCollectionDeclaration["kind"];
  path: string;
  anyPath: string;
  sameOwnerPath: string;
  interfacePath: string;
  interfaceCapturePath: string;
  sameOwnerInterfacePath: string;
  interfacePaths: Readonly<Partial<Record<InterfaceName, string>>>;
  interfaceImporters: Readonly<Partial<Record<InterfaceName, string[]>>>;
  parentInterfacePath?: string;
}>;

const compileCollection = (
  declaration: ModuleCollectionDeclaration
): CompiledCollection => {
  const excluded = declaration.excludedChildren?.join("|");
  const child = excluded ? `(?!(?:${excluded})(?:/|$))[^/]+` : "[^/]+";
  const interfacePattern = `(?:${declaration.interfaces.join("|")})`;
  const interfacePaths = Object.fromEntries(
    declaration.interfaces.map((name) => [
      name,
      `^${declaration.root}/${child}/${name}\\.ts$`,
    ])
  );
  const interfaceImporters = Object.fromEntries(
    Object.entries(declaration.interfaceAudiences ?? {}).map(
      ([name, audiences]) => [
        name,
        audiences.flatMap((audience) => audiencePaths[audience]),
      ]
    )
  );

  return {
    kind: declaration.kind,
    path: `^${declaration.root}/(${child})/`,
    anyPath: `^${declaration.root}/${child}/`,
    sameOwnerPath: `^${declaration.root}/$1/`,
    interfacePath: `^${declaration.root}/${child}/${interfacePattern}\\.ts$`,
    interfaceCapturePath: `^${declaration.root}/(${child})/${interfacePattern}\\.ts$`,
    sameOwnerInterfacePath: `^${declaration.root}/$1/${interfacePattern}\\.ts$`,
    interfacePaths,
    interfaceImporters,
    parentInterfacePath:
      declaration.parent === undefined
        ? undefined
        : `^${declaration.parent}/${interfacePattern}\\.ts$`,
  };
};

const makeCollectionRules = (
  collection: CompiledCollection
): IForbiddenRuleType[] => {
  const prefix = collection.kind;
  const rules: IForbiddenRuleType[] = [
    {
      name: `${prefix}-cross-module-internals-private`,
      severity: "error",
      from: { path: collection.path, pathNot: "\\.css\\.ts$" },
      to: {
        path: collection.anyPath,
        pathNot: [collection.sameOwnerPath, collection.interfacePath],
      },
    },
    {
      name: `${prefix}-internals-private`,
      severity: "error",
      from: {
        pathNot: [collection.anyPath, "\\.css\\.ts$"],
      },
      to: {
        path: collection.anyPath,
        pathNot: collection.interfacePath,
      },
    },
    {
      name: `${prefix}-no-self-interface-imports`,
      severity: "error",
      from: {
        path: collection.path,
        pathNot: collection.interfacePath,
      },
      to: { path: collection.sameOwnerInterfacePath },
    },
    {
      name: `${prefix}-no-cross-module-reexports`,
      severity: "error",
      from: { path: collection.interfaceCapturePath },
      to: {
        path: ownedModulePath,
        pathNot: collection.sameOwnerPath,
        dependencyTypes: ["export"],
      },
    },
  ];

  if (collection.kind !== "resource") {
    const compositionPath = collection.interfacePaths.composition;
    const runtimePath = collection.interfacePaths.runtime;
    const viewsPath = collection.interfacePaths.views;
    const indexPath = collection.interfacePaths.index;
    if (
      compositionPath === undefined ||
      runtimePath === undefined ||
      viewsPath === undefined ||
      indexPath === undefined
    ) {
      throw new Error(`${collection.kind} is missing a Feature interface role`);
    }

    rules.push(
      {
        name: `${prefix}-composition-importers`,
        severity: "error",
        from: {
          pathNot: collection.interfaceImporters.composition ?? [],
        },
        to: { path: compositionPath },
      },
      {
        name: `${prefix}-runtime-importers`,
        severity: "error",
        from: { pathNot: collection.interfaceImporters.runtime ?? [] },
        to: { path: runtimePath },
      },
      {
        name: `${prefix}-views-stay-out-of-runtimes`,
        severity: "error",
        from: {
          path: "^(?:src/app/runtime/|src/features/.+/runtime\\.ts$|src/features/.+/state/orchestration/)",
        },
        to: { path: viewsPath },
      },
      {
        name: `${prefix}-index-is-headless`,
        severity: "error",
        from: { path: indexPath },
        to: { path: "/ui/", dependencyTypes: ["export"] },
      }
    );
  }

  rules.push(
    {
      name:
        collection.kind === "feature"
          ? "style-imports-only-target-styles"
          : `${prefix}-style-imports-only-target-styles`,
      severity: "error",
      from: { path: `${collection.path.slice(0, -1)}.*\\.css\\.ts$` },
      to: {
        path: collection.anyPath,
        pathNot: [
          collection.sameOwnerPath,
          collection.interfacePath,
          "\\.css\\.ts$",
        ],
      },
    },
    {
      name: `${prefix}-external-style-imports-only-target-styles`,
      severity: "error",
      from: { path: "\\.css\\.ts$", pathNot: collection.anyPath },
      to: {
        path: collection.anyPath,
        pathNot: [collection.interfacePath, "\\.css\\.ts$"],
      },
    }
  );

  if (collection.parentInterfacePath !== undefined) {
    rules.push({
      name: `${prefix}-no-parent-reexports`,
      severity: "error",
      from: { path: collection.parentInterfacePath },
      to: { path: collection.anyPath, dependencyTypes: ["export"] },
    });
  }

  return rules;
};

const directoryPattern = (path: string) => `^${path.replaceAll("*", "[^/]+")}/`;

const makeOwnedModuleRules = (
  declaration: OwnedModuleDeclaration
): IForbiddenRuleType[] => {
  const interfacePaths = Object.fromEntries(
    Object.keys(declaration.interfaces).map((name) => [
      name,
      `^${declaration.root}/${name}\\.ts$`,
    ])
  ) as Record<keyof OwnedModuleDeclaration["interfaces"], string>;
  const allInterfaces = `^${declaration.root}/(?:${Object.keys(
    declaration.interfaces
  ).join("|")})\\.ts$`;

  return [
    {
      name: `${declaration.kind}-internals-private`,
      severity: "error",
      from: { pathNot: `^${declaration.root}/` },
      to: { path: `^${declaration.root}/`, pathNot: allInterfaces },
    },
    {
      name: `${declaration.kind}-no-cross-module-reexports`,
      severity: "error",
      from: { path: allInterfaces },
      to: {
        path: ownedModulePath,
        pathNot: `^${declaration.root}/`,
        dependencyTypes: ["export"],
      },
    },
    ...Object.entries(declaration.interfaces).map(
      ([name, importers]): IForbiddenRuleType => ({
        name: `${declaration.kind}-${name}-importers`,
        severity: "error",
        from: {
          pathNot: [
            directoryPattern(declaration.root),
            ...importers.map(directoryPattern),
          ],
        },
        to: {
          path: interfacePaths[
            name as keyof OwnedModuleDeclaration["interfaces"]
          ],
        },
      })
    ),
  ];
};

const configuration: IConfiguration = {
  forbidden: [
    {
      name: "undeclared-layer-imports",
      severity: "error",
      from: {},
      to: { path: undeclaredLayerPath },
    },
    {
      name: "undeclared-layer-dependencies",
      severity: "error",
      from: { path: undeclaredLayerPath },
      to: {},
    },
    ...makeLayerRules(),
    {
      name: "public-api-domain-contracts-only",
      severity: "error",
      comment:
        "Host declarations may import Domain only through explicit contract.ts files.",
      from: { path: "^src/public-api/" },
      to: {
        path: "^src/domain/",
        pathNot: "^src/domain/.+/contract\\.ts$",
      },
    },
    {
      name: "shared-public-theme-contract-only",
      severity: "error",
      comment:
        "Only shared theme implementation modules may implement the host-facing theme contract.",
      from: {
        path: "^src/shared/",
        pathNot: "^src/shared/styles/(?:theme|tokens)/",
      },
      to: { path: "^src/public-api/" },
    },
    {
      name: "shared-theme-imports-only-theme-contract",
      severity: "error",
      comment:
        "Shared theme implementation may depend only on the exact host-facing theme contract.",
      from: { path: "^src/shared/styles/(?:theme|tokens)/" },
      to: {
        path: "^src/public-api/",
        pathNot: "^src/public-api/theme\\.ts$",
      },
    },
    ...makeGeneratedRuntimeRules(),
    ...architecturePolicy.moduleCollections
      .map(compileCollection)
      .flatMap(makeCollectionRules),
    ...architecturePolicy.ownedModules.flatMap(makeOwnedModuleRules),
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: { path: "node_modules" },
    includeOnly: ["^src/"],
    moduleSystems: ["es6", "cjs"],
    progress: { type: "none" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
  },
};

export default configuration;
