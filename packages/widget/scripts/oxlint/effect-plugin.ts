/**
 * Effect and Effect Atom rules: runtime ownership, typed failure channels,
 * DateTime boundaries and feature layering (ARCHITECTURE.md, Enforcement).
 */
import {
  excluding,
  type FileScope,
  findAncestor,
  hasAncestor,
  isMemberPath,
  memberName,
  memberPath,
  type Node,
  type Rule,
  scopedRule,
  sourceAndTestFiles,
  sourceFiles,
} from "./rule.ts";

type NodeOf<Type extends Node["type"]> = Extract<Node, { type: Type }>;
type Call = NodeOf<"CallExpression">;

const testFiles: FileScope = { files: ["tests/**/*.ts", "tests/**/*.tsx"] };
const widgetFiles: FileScope = { files: ["**/*.ts", "**/*.tsx"] };

/** A dotted type name such as `Effect.fn.Return`. */
const typeNamePath = (node: NodeOf<"TSTypeReference">["typeName"]): string => {
  if (node.type === "TSQualifiedName") {
    return `${typeNamePath(node.left)}.${node.right.name}`;
  }
  return node.type === "Identifier" ? node.name : "this";
};

const keyOwners: Record<string, true> = {
  Property: true,
  MethodDefinition: true,
  PropertyDefinition: true,
  AccessorProperty: true,
  TSPropertySignature: true,
  TSMethodSignature: true,
};

/** A non-computed member, key or enum member name, as opposed to a reference. */
const isPropertyName = (node: Node): boolean => {
  const { parent } = node;
  if (!parent) return false;
  if (parent.type === "MemberExpression") {
    return parent.property === node && !parent.computed;
  }
  if (parent.type === "TSEnumMember") return parent.id === node;
  return (
    keyOwners[parent.type] === true &&
    "key" in parent &&
    parent.key === node &&
    !("computed" in parent && parent.computed) &&
    !("shorthand" in parent && parent.shorthand)
  );
};

/** Reports every call expression `matches` accepts. */
const callRule = (
  scope: FileScope,
  message: string,
  matches: (node: Call) => boolean
): Rule =>
  scopedRule(scope, (context) => ({
    CallExpression(node) {
      if (matches(node)) context.report({ node, message });
    },
  }));

/** Reports calls to `path` (e.g. `"Effect.fail"`) that `matches` accepts. */
const callsTo = (
  scope: FileScope,
  message: string,
  path: string,
  matches: (args: Call["arguments"]) => boolean = () => true
): Rule =>
  callRule(
    scope,
    message,
    (node) => memberPath(node.callee) === path && matches(node.arguments)
  );

/** Reports every member expression `matches` accepts. */
const memberRule = (
  scope: FileScope,
  message: string,
  matches: (node: Node) => boolean
): Rule =>
  scopedRule(scope, (context) => ({
    MemberExpression(node) {
      if (matches(node)) context.report({ node, message });
    },
  }));

/** Reports every string literal `matches` accepts. */
const stringRule = (
  scope: FileScope,
  message: string,
  matches: (node: Node, value: string) => boolean
): Rule =>
  scopedRule(scope, (context) => ({
    Literal(node) {
      if (typeof node.value === "string" && matches(node, node.value)) {
        context.report({ node, message });
      }
    },
  }));

/** `Effect.runPromise`, `Effect.runSyncExit`, `Effect.runForkWith`, … */
const effectRunner =
  /^Effect\.run(?:Promise|PromiseExit|Fork|Sync|SyncExit|Callback)(?:With)?$/;

const isEffectRunner = (node: Node) =>
  effectRunner.test(memberPath(node) ?? "");

/** The call's argument when it has exactly one. */
const onlyArgument = (args: Call["arguments"]) =>
  args.length === 1 ? args[0] : undefined;

/** Forbids `Atom.runtime(...)` outside runtime construction and assembly. */
const noAdHocAtomRuntime = callsTo(
  excluding(sourceFiles, ["src/runtime/**", "src/app/runtime/**"]),
  "Widget runtimes are built in src/runtime, or assembled in src/app/runtime.",
  "Atom.runtime"
);

const moduleDeclarations: Record<string, true> = {
  ImportDeclaration: true,
  ExportNamedDeclaration: true,
  ExportAllDeclaration: true,
  ExportDefaultDeclaration: true,
  TSImportEqualsDeclaration: true,
  TSExportAssignment: true,
};

/** Forbids importing or re-exporting `effect/reactivity/AsyncResult` in feature UI. */
const noAsyncResultInFeatureUi = stringRule(
  { files: ["src/features/**/ui/**/*.ts", "src/features/**/ui/**/*.tsx"] },
  "Feature UI presents view states, never raw async results. Publish a Presentable (shared/effect/async-result) or a plain value from the feature's state read model.",
  (node, value) =>
    value === "effect/reactivity/AsyncResult" &&
    hasAncestor(node, (ancestor) => moduleDeclarations[ancestor.type] === true)
);

const defaultIdleTtl = "defaultIdleTTL";

/** Forbids a `defaultIdleTTL` key, member or JSX prop on the Atom registry. */
const noDefaultAtomIdleTtl: Rule = scopedRule(widgetFiles, (context) => {
  const message =
    "The application Atom registry must use native immediate disposal without a default idle TTL.";
  return {
    Identifier(node) {
      if (node.name === defaultIdleTtl && isPropertyName(node)) {
        context.report({ node, message });
      }
    },
    JSXAttribute(node) {
      if (
        node.name.type === "JSXIdentifier" &&
        node.name.name === defaultIdleTtl
      ) {
        context.report({ node, message });
      }
    },
  };
});

/** Forbids `Atom.setIdleTTL(ttl)` outside the shared API resource policy. */
const noDirectAtomIdleTtl = callsTo(
  excluding(widgetFiles, ["src/shared/effect/api-resource.ts"]),
  "Atom retention is transient by default; only the shared API resource policy may configure a finite idle TTL.",
  "Atom.setIdleTTL",
  (args) => onlyArgument(args) !== undefined
);

/** Forbids `x.registry`, `x.mount(atom)` and `x.subscribe(...)` in features. */
const noDirectAtomLifecycleInFeatures: Rule = scopedRule(
  { files: ["src/features/**/*.ts", "src/features/**/*.tsx"] },
  (context) => {
    const message =
      "Feature modules must use the shared app-runtime lifecycle adapters instead of accessing Atom registry lifecycle operations directly.";
    const calledWith = (
      node: Node,
      matches: (args: Call["arguments"]) => boolean
    ) =>
      node.parent?.type === "CallExpression" &&
      node.parent.callee === node &&
      matches(node.parent.arguments);
    return {
      MemberExpression(node) {
        const name = memberName(node);
        if (name === undefined) return;
        if (name === "registry") context.report({ node, message });
        if (
          (name === "mount" &&
            calledWith(node, (args) => onlyArgument(args) !== undefined)) ||
          (name === "subscribe" && calledWith(node, () => true))
        ) {
          context.report({ node: node.parent, message });
        }
      },
    };
  }
);

/** Forbids `Effect.runPromise(...)` and the other `Effect.run*` calls in `src`. */
const noDirectEffectRuntimeExecution = callRule(
  sourceFiles,
  "Run Effects through the scoped Atom runtime or an injected scoped runner.",
  (node) => isEffectRunner(node.callee)
);

const atomModules: Record<string, true> = {
  "effect/reactivity/Atom": true,
  "effect/reactivity/AtomRegistry": true,
};

/** Forbids Effect Atom module specifiers in feature models. */
const noEffectAtomInFeatureLogic = stringRule(
  { files: ["src/features/**/model/**/*.ts"] },
  "Feature models must stay independent of Effect Atom.",
  (_node, value) => atomModules[value] === true
);

const isKey = (node: Node | undefined, name: string) =>
  node?.type === "Property" &&
  !node.computed &&
  !node.shorthand &&
  node.key.type === "Identifier" &&
  node.key.name === name;

const isTagProperty = (node: Node) =>
  isKey(node, "_tag") && node.type === "Property" && !node.method;

/** A primitive, template, array or untagged object literal. */
const isLiteralFailure = (node: Node): boolean => {
  switch (node.type) {
    case "Literal":
      return !("regex" in node);
    case "Identifier":
      return node.name === "undefined";
    case "TemplateLiteral":
    case "ArrayExpression":
      return true;
    case "ObjectExpression":
      return !node.properties.some(isTagProperty);
    default:
      return false;
  }
};

/** Forbids `Effect.fail` with a primitive, template, array or untagged object. */
const noLiteralEffectFailure = callsTo(
  sourceFiles,
  "Pass a tagged domain error to Effect.fail.",
  "Effect.fail",
  (args) => {
    const failure = onlyArgument(args);
    return failure !== undefined && isLiteralFailure(failure);
  }
);

/** Forbids `Date`, `globalThis.Date` and the Date-bridging DateTime/Schema APIs. */
const noNativeDate: Rule = scopedRule(sourceAndTestFiles, (context) => {
  const message =
    "Use Effect DateTime at application boundaries instead of native Date.";
  const dateMembers: Record<string, true> = {
    "globalThis.Date": true,
    "window.Date": true,
    "DateTime.fromDateUnsafe": true,
    "DateTime.nowAsDate": true,
    "DateTime.toDate": true,
    "DateTime.toDateUtc": true,
    "Schema.Date": true,
    "Schema.DateFromString": true,
    "Schema.DateTimeUtcFromDate": true,
    "Schema.DateValid": true,
  };
  return {
    Identifier(node) {
      if (node.name === "Date" && !isPropertyName(node)) {
        context.report({ node, message });
      }
    },
    MemberExpression(node) {
      if (isMemberPath(node, dateMembers)) {
        context.report({ node, message });
      }
    },
  };
});

const nativeErrors: Record<string, true> = {
  Error: true,
  TypeError: true,
  RangeError: true,
  ReferenceError: true,
  SyntaxError: true,
  URIError: true,
  EvalError: true,
  AggregateError: true,
};
const errorGlobals: Record<string, true> = { globalThis: true, window: true };

/** `Error`, `globalThis.TypeError`, `window.RangeError`, … */
const isNativeError = (node: Node): boolean => {
  if (node.type === "Identifier") return nativeErrors[node.name] === true;
  const [object = "", property = ""] = (memberPath(node) ?? "").split(".");
  return errorGlobals[object] === true && nativeErrors[property] === true;
};

const constructsNativeError = (node: Node) =>
  node.type === "NewExpression" && isNativeError(node.callee);

/** `(cause) => new Error(...)` with exactly one parameter. */
const mapsToNativeError = (node: Node) =>
  node.type === "ArrowFunctionExpression" &&
  node.expression &&
  node.params.length === 1 &&
  constructsNativeError(node.body);

/** `{ try: $TRY, catch: (cause) => new Error(...) }`. */
const catchesAsNativeError = (node: Node) =>
  node.type === "ObjectExpression" &&
  node.properties.length === 2 &&
  isKey(node.properties[0], "try") &&
  isKey(node.properties[1], "catch") &&
  node.properties[1]?.type === "Property" &&
  mapsToNativeError(node.properties[1].value);

const nativeFailureArgument: Record<string, (node: Node) => boolean> = {
  "Effect.fail": (node) =>
    (node.type === "NewExpression" || node.type === "CallExpression") &&
    isNativeError(node.callee),
  "Effect.mapError": mapsToNativeError,
  "Effect.try": catchesAsNativeError,
  "Effect.tryPromise": catchesAsNativeError,
};

/** Forbids native `Error` classes as Effect failures. */
const noNativeEffectFailure = callRule(
  sourceFiles,
  "Map expected Effect failures to a tagged domain error.",
  (node) => {
    const matches = nativeFailureArgument[memberPath(node.callee) ?? ""];
    const argument = onlyArgument(node.arguments);
    return matches !== undefined && argument !== undefined && matches(argument);
  }
);

/** Forbids `Effect.run*` in tests outside documented non-Effect boundaries. */
const noRunEffectInTest = memberRule(
  testFiles,
  "Return Effect test programs from it.effect or it.live; run Effects directly only at documented non-Effect boundaries.",
  isEffectRunner
);

/** Forbids `Effect.provideService(...)`. */
const noRuntimeProvideService = callsTo(
  sourceFiles,
  "Resolve static Effect dependencies during Layer construction instead of locally re-providing a captured service while an operation runs.",
  "Effect.provideService"
);

const functionTypes: Record<string, true> = {
  ArrowFunctionExpression: true,
  FunctionExpression: true,
  FunctionDeclaration: true,
};

/** `Effect.gen(...)` or `Effect.fn(...)(...)`. */
const isEffectGenerator = (node: Node) =>
  node.type === "CallExpression" &&
  (memberPath(node.callee) === "Effect.gen" ||
    (node.callee.type === "CallExpression" &&
      memberPath(node.callee.callee) === "Effect.fn"));

/** Forbids `throw` directly inside an Effect.gen / Effect.fn generator. */
const noThrowInEffectGenerator: Rule = scopedRule(sourceFiles, (context) => ({
  ThrowStatement(node) {
    const fn = findAncestor(
      node,
      (ancestor) => functionTypes[ancestor.type] === true
    );
    if (
      fn?.type === "FunctionExpression" &&
      fn.generator &&
      hasAncestor(fn, isEffectGenerator)
    ) {
      context.report({
        node,
        message: "Use yield* for expected failures or Effect.die for defects.",
      });
    }
  },
}));

/** Reports `Name<A, unknown, …>` type references for the given names and arities. */
const unknownFailureRule = (
  message: string,
  typeNames: Record<string, true>,
  arities: Record<number, true>
): Rule =>
  scopedRule(sourceFiles, (context) => ({
    TSTypeReference(node) {
      const params = node.typeArguments?.params ?? [];
      if (
        typeNames[typeNamePath(node.typeName)] === true &&
        arities[params.length] === true &&
        params[1]?.type === "TSUnknownKeyword"
      ) {
        context.report({ node, message });
      }
    },
  }));

/** Forbids `AsyncResult.AsyncResult<A, unknown>`. */
const noUnknownAsyncResultFailure = unknownFailureRule(
  "Use a tagged domain error in the AsyncResult failure channel instead of unknown.",
  { "AsyncResult.AsyncResult": true },
  { 2: true }
);

/** Forbids `Effect.Effect<A, unknown, R?>` and `Effect.fn.Return<A, unknown, R?>`. */
const noUnknownEffectFailure = unknownFailureRule(
  "Use a tagged domain error in the Effect failure channel instead of unknown.",
  { "Effect.Effect": true, "Effect.fn.Return": true },
  { 2: true, 3: true }
);

const unsafeDateTimeMembers: Record<string, true> = {
  "DateTime.isFutureUnsafe": true,
  "DateTime.isPastUnsafe": true,
  "DateTime.nowUnsafe": true,
};

/** Forbids the unsafe wall-clock DateTime APIs. */
const noUnsafeDateTime = memberRule(
  sourceAndTestFiles,
  "Use Effect Clock or DateTime.now; unsafe wall-clock access is reserved for the synchronous WalletConnect adapter.",
  (node) => isMemberPath(node, unsafeDateTimeMembers)
);

const presentableResourceFactories: Record<string, true> = {
  makePresentableResource: true,
  makePresentableResourceFamily: true,
};

/** Requires Resources importing a `*ResourceSource` to use a presentable resource factory. */
const presentableResourceSources: Rule = scopedRule(
  { files: ["src/resources/**/*.ts"] },
  (context) => {
    const sourceImports: Array<Node> = [];
    const factoryReferences: Array<Node> = [];
    return {
      ImportDeclaration(node) {
        if (
          node.specifiers.some(
            (specifier) =>
              specifier.type === "ImportSpecifier" &&
              specifier.local.name.endsWith("ResourceSource")
          )
        ) {
          sourceImports.push(node);
        }
      },
      Identifier(node) {
        if (
          presentableResourceFactories[node.name] === true &&
          !isPropertyName(node)
        ) {
          factoryReferences.push(node);
        }
      },
      "Program:exit"() {
        if (factoryReferences.length > 0) return;
        for (const node of sourceImports) {
          context.report({
            node,
            message:
              "A Resource that reads an API ResourceSource must publish it through makePresentableResource or makePresentableResourceFamily, so failures are presented only while a foreground observer is mounted.",
          });
        }
      },
    };
  }
);

export default {
  meta: { name: "effect" },
  rules: {
    "no-ad-hoc-atom-runtime": noAdHocAtomRuntime,
    "no-async-result-in-feature-ui": noAsyncResultInFeatureUi,
    "no-default-atom-idle-ttl": noDefaultAtomIdleTtl,
    "no-direct-atom-idle-ttl": noDirectAtomIdleTtl,
    "no-direct-atom-lifecycle-in-features": noDirectAtomLifecycleInFeatures,
    "no-direct-effect-runtime-execution": noDirectEffectRuntimeExecution,
    "no-effect-atom-in-feature-logic": noEffectAtomInFeatureLogic,
    "no-literal-effect-failure": noLiteralEffectFailure,
    "no-native-date": noNativeDate,
    "no-native-effect-failure": noNativeEffectFailure,
    "no-run-effect-in-test": noRunEffectInTest,
    "no-runtime-provide-service": noRuntimeProvideService,
    "no-throw-in-effect-generator": noThrowInEffectGenerator,
    "no-unknown-async-result-failure": noUnknownAsyncResultFailure,
    "no-unknown-effect-failure": noUnknownEffectFailure,
    "no-unsafe-date-time": noUnsafeDateTime,
    "presentable-resource-sources": presentableResourceSources,
  },
};
