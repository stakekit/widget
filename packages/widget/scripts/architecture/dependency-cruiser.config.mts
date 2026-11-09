/**
 * Import rules used by `check-architecture.ts`. Every path comes from the
 * Module map (`module-map.ts`): the layer matrix, Module privacy, interface
 * audiences, Feature tiers, headless code, and the Design System's rules.
 */
import type { IConfiguration, IForbiddenRuleType } from "dependency-cruiser";

import {
  ambientDirectories,
  appCompositionPaths,
  collectionChildPattern,
  featureTiers,
  interfaceRoles,
  layerImports,
  layerNames,
  moduleCollections,
  moduleLayers,
  moduleRootPattern,
  runtimeAssemblyPath,
} from "./module-map.ts";

const layerPath = (name: string) => `^src/${name}/`;
const layerRoot = `^src/(?:${layerNames.join("|")})/`;
const undeclaredLayerPath = `^src/(?!(?:${[...layerNames, ...ambientDirectories].join("|")})(?:/|$))[^/]+/`;

const moduleLayerGroup = `(?:${moduleLayers.join("|")})`;
const roleGroup = `(?:${interfaceRoles.join("|")})`;
/** A Module root directory: a Module layer's child or a collection's child. */
const anyModuleRoot = `(?:${collectionChildPattern}|${moduleRootPattern})`;
const rootFile = (name: string) => `^${anyModuleRoot}/${name}\\.ts$`;
/** Where Feature tiers live: Modules and the application's areas. */
const tieredRoot = `(?:${anyModuleRoot}|src/app/[^/]+)`;

const makeLayerRules = (): IForbiddenRuleType[] =>
  layerNames.map((name) => ({
    name: `layer-${name}`,
    severity: "error",
    comment: `${name} dependencies follow the default-deny layer matrix.`,
    from: { path: layerPath(name) },
    to: { path: layerRoot, pathNot: layerImports[name].map(layerPath) },
  }));

/** Subdirectories are private to their Module, at every Module level. */
const makeModulePrivacyRules = (): IForbiddenRuleType[] => {
  const comment =
    "A Module's root files are its interface; its subdirectories are private.";
  const privatePath = `^src/${moduleLayerGroup}/[^/]+/[^/]+/`;
  return [
    {
      name: "module-subdirectories-private",
      severity: "error",
      comment,
      from: { path: `^(src/${moduleLayerGroup}/[^/]+)/` },
      to: { path: privatePath, pathNot: "^$1/" },
    },
    {
      name: "module-subdirectories-private",
      severity: "error",
      comment,
      from: { pathNot: `^src/${moduleLayerGroup}/[^/]+/` },
      to: { path: privatePath },
    },
    ...moduleCollections.flatMap((collection): IForbiddenRuleType[] => [
      {
        name: "module-subdirectories-private",
        severity: "error",
        comment: `${comment} Each child of ${collection} is a Module.`,
        from: { path: `^(${collection}/[^/]+)/` },
        to: { path: `^${collection}/[^/]+/[^/]+/`, pathNot: "^$1/" },
      },
      {
        name: "module-subdirectories-private",
        severity: "error",
        comment: `${comment} Each child of ${collection} is a Module.`,
        from: { path: `^${collection}/[^/]+$` },
        to: { path: `^${collection}/[^/]+/[^/]+/` },
      },
    ]),
  ];
};

/** Rules for root files whose role fixes their audience or content. */
const makeInterfaceRoleRules = (): IForbiddenRuleType[] => [
  {
    name: "composition-importers",
    severity: "error",
    comment:
      "Only application composition, or a Module Collection's own composition, imports a composition interface.",
    from: { pathNot: [...appCompositionPaths, "^src/ui/"] },
    to: { path: `^(?:src/features/[^/]+|src/ui)/composition\\.ts$` },
  },
  ...moduleCollections.map((collection): IForbiddenRuleType => ({
    name: "composition-importers",
    severity: "error",
    comment:
      "Only application composition, or a Module Collection's own composition, imports a composition interface.",
    from: { pathNot: `^${collection}/composition\\.ts$` },
    to: { path: `^${collection}/[^/]+/composition\\.ts$` },
  })),
  {
    name: "runtime-importers",
    severity: "error",
    comment:
      "Only runtime construction and assembly import a runtime interface.",
    from: { pathNot: runtimeAssemblyPath },
    to: { path: rootFile("runtime") },
  },
  {
    name: "views-stay-out-of-runtimes",
    severity: "error",
    comment: "Runtimes never load rendered views.",
    from: { path: [runtimeAssemblyPath, rootFile("runtime")] },
    to: { path: rootFile("views") },
  },
  {
    name: "index-is-headless",
    severity: "error",
    comment:
      "A main interface re-exports no rendered UI, only hooks from .ts files; views.ts re-exports components.",
    from: { path: rootFile("index") },
    to: { path: "\\.tsx$", dependencyTypes: ["export"] },
  },
  {
    name: "no-self-interface-imports",
    severity: "error",
    comment:
      "A Module's own code imports its implementation, never its role interfaces.",
    from: { path: `^(${anyModuleRoot})/`, pathNot: rootFile(roleGroup) },
    to: { path: `^$1/${roleGroup}\\.ts$` },
  },
  {
    name: "no-cross-module-reexports",
    severity: "error",
    comment:
      "A Module interface re-exports only its own code, or, for a Module Collection, its children's interfaces.",
    from: { path: `^(${anyModuleRoot})/[^/]+\\.tsx?$` },
    to: {
      path: `^src/${moduleLayerGroup}/`,
      pathNot: "^$1/",
      dependencyTypes: ["export"],
    },
  },
];

/** Within a Feature or application Module, tiers depend only downward. */
const makeTierRules = (): IForbiddenRuleType[] =>
  featureTiers.slice(1).map((tier, index) => ({
    name: `tier-${tier}-imports-down`,
    severity: "error",
    comment: `Tiers depend downward (${featureTiers.join(" → ")}); ${tier}/ never imports ${featureTiers
      .slice(0, index + 1)
      .join("/ or ")}/.`,
    from: { path: `^(${tieredRoot})/${tier}/` },
    to: {
      path: `^$1/(?:${featureTiers.slice(0, index + 1).join("|")})/`,
    },
  }));

const reactLibraries = ["react", "react-dom", "@effect/atom-react"];
const routerLibraries = ["react-router"];
const packagePath = (names: ReadonlyArray<string>) =>
  `(?:^|/node_modules/)(?:${names.join("|")})(?:/|$)`;

/**
 * Styling and behavior libraries only the Design System may import.
 * Unresolved specifiers (a library not installed yet) match by name.
 */
const designSystemLibraryPath = packagePath([
  "@stylexjs/[^/]+",
  "@base-ui/react",
  "motion",
  "recharts",
  "@tanstack/react-virtual",
]);
const styleModulePath = "\\.stylex\\.ts$|\\.css$";

const architectureConfiguration: IConfiguration = {
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
    ...makeModulePrivacyRules(),
    ...makeInterfaceRoleRules(),
    ...makeTierRules(),
    {
      name: "package-entries-outbound-only",
      severity: "error",
      comment:
        "Public widget entrypoints are outbound-only; import from the defining module.",
      from: {},
      to: { path: "^src/index\\.(?:package|bundle)\\.ts$" },
    },
    {
      name: "headless-logic-without-react",
      severity: "error",
      comment:
        "Domain, runtime, Resource and service modules are headless; React hooks and components live in a Feature's ui/.",
      from: {
        path: "^src/(?:domain|runtime|resources|services|app/runtime)/",
      },
      to: { path: packagePath(reactLibraries) },
    },
    {
      name: "headless-tiers-without-react",
      severity: "error",
      comment:
        "Feature model/ and state/ are headless; React hooks and components live in ui/.",
      from: { path: `^${tieredRoot}/(?:model|state)/` },
      to: { path: packagePath([...reactLibraries, ...routerLibraries]) },
    },
    {
      name: "generated-runtime-clients-private",
      severity: "error",
      comment: "Generated API clients stay private to services/api.",
      from: { pathNot: "^src/services/api/" },
      to: { path: "^src/generated/api/(?:borrow-client|legacy|yield)\\.ts$" },
    },
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
      name: "public-api-host-boundaries-only",
      severity: "error",
      comment:
        "Host-facing types enter only at host boundaries: raw Host Configuration composition and decoding, host wallet and tracking callbacks. Everything else uses Domain or owner types.",
      from: {
        path: "^src/(?:app|features|runtime|resources|services)/",
        pathNot: [
          "^src/app/composition/providers/(?:atom-runtime/index\\.tsx|widget-config-binding\\.tsx)$",
          "^src/runtime/application-runtime-init\\.ts$",
          "^src/runtime/widget-config\\.ts$",
          "^src/services/config/",
          "^src/services/tracking/tracking-variants\\.ts$",
          "^src/services/wallet/external-provider\\.ts$",
          "^src/services/wallet/internal/adapters/external-provider/driver\\.ts$",
        ],
      },
      to: { path: "^src/public-api/" },
    },
    {
      name: "api-transport-neutral",
      severity: "error",
      comment:
        "API transport only acquires data; Resources and operations decide whether a failure is presented as a Rich Error.",
      from: { path: "^src/services/api/internal/transport\\.ts$" },
      to: { path: "^src/services/errors/" },
    },
    {
      name: "api-operations-importers",
      severity: "error",
      comment:
        "API operations serve Feature state and transaction internals; Resources read through resource-sources.ts.",
      from: {
        pathNot: [
          "^src/services/api/",
          `^(?:${collectionChildPattern}|src/features/[^/]+)/state/`,
          "^src/services/transaction-workflow/internal/",
        ],
      },
      to: { path: "^src/services/api/operations\\.ts$" },
    },
    {
      name: "api-resource-sources-importers",
      severity: "error",
      comment: "Only Resources read API resource sources.",
      from: { pathNot: ["^src/services/api/", "^src/resources/"] },
      to: { path: "^src/services/api/resource-sources\\.ts$" },
    },
    {
      name: "design-system-owns-styling-libraries",
      severity: "error",
      comment:
        "Only the Design System imports StyleX, Base UI, motion, Recharts and TanStack Virtual. Compose a Design System part, or extend the Design System when none fits (docs/design-system.md).",
      from: { pathNot: "^src/ui/" },
      to: { path: designSystemLibraryPath },
    },
    {
      name: "design-system-owns-style-modules",
      severity: "error",
      comment:
        "Only the Design System defines and imports style modules (`*.stylex.ts`, `.css`). Compose a Design System part, or extend the Design System when none fits (docs/design-system.md).",
      from: { pathNot: "^src/ui/" },
      to: { path: styleModulePath },
    },
    {
      name: "design-system-internals-private",
      severity: "error",
      comment:
        "Other owners use the Design System only through its main interface (`ui/index.ts`) or its composition interface (`ui/composition.ts`).",
      from: { pathNot: "^src/ui/" },
      to: {
        path: "^src/ui/",
        pathNot: "^src/ui/(?:index|composition)\\.ts$",
      },
    },
    {
      name: "compact-layout-ui-independent",
      severity: "error",
      comment:
        "A Feature's Compact Layout UI never imports Dashboard Layout UI; components both Layouts render live in the Feature's `ui/`.",
      from: { path: "^src/features/.+/ui/compact/" },
      to: { path: "^src/features/.+/ui/dashboard/" },
    },
    {
      name: "dashboard-layout-ui-independent",
      severity: "error",
      comment:
        "A Feature's Dashboard Layout UI never imports Compact Layout UI; components both Layouts render live in the Feature's `ui/`.",
      from: { path: "^src/features/.+/ui/dashboard/" },
      to: { path: "^src/features/.+/ui/compact/" },
    },
    {
      name: "layout-ui-is-a-leaf",
      severity: "error",
      comment:
        "Layout-specific screens are composed by the application; logic, shared UI, and lower owners never depend on them.",
      from: {
        path: [
          "^src/(?:domain|runtime|resources|services|shared)/",
          "^src/features/.+/(?:model|state)/",
          "^src/features/.+/ui/(?!compact/|dashboard/)",
        ],
      },
      to: { path: "^src/features/.+/ui/(?:compact|dashboard)/" },
    },
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
    includeOnly: [
      "^src/",
      designSystemLibraryPath,
      packagePath([...reactLibraries, ...routerLibraries]),
    ],
    moduleSystems: ["es6", "cjs"],
    progress: { type: "none" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default"],
      exportsFields: ["exports"],
    },
  },
};

export default architectureConfiguration;
