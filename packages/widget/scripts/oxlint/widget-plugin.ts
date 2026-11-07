/**
 * Widget rules that need no type information: persistence, formatting,
 * finance, React Compiler, Module interface and suppression conventions
 * (ARCHITECTURE.md, Enforcement).
 */
import {
  excluding,
  type FileScope,
  hasAncestor,
  isMemberPath,
  memberName,
  memberPath,
  type Node,
  type Rule,
  scopedRule,
  sourceAndTestFiles,
  sourceFiles,
  type Visitor,
} from "./rule.ts";

const globalObjects: Record<string, true> = { window: true, globalThis: true };

/** `object.name` or `object["name"]`. */
const readsProperty = (node: Node, name: string) =>
  node.type === "MemberExpression" &&
  (node.computed
    ? node.property.type === "Literal" && node.property.value === name
    : node.property.type === "Identifier" && node.property.name === name);

/** The method name of a `<receiver>.<name>(...)` call. */
const calledMethod = (node: Node): string | undefined =>
  node.type === "CallExpression" ? memberName(node.callee) : undefined;

/** A rule that reports each matching node of one type with a fixed message. */
const nodeRule = (
  scope: FileScope,
  message: string,
  visit: (report: (node: Node) => void) => Visitor
): Rule =>
  scopedRule(scope, (context) =>
    visit((node) => context.report({ node, message }))
  );

const noLocalStorage: Rule = nodeRule(
  sourceFiles,
  "Use the persistence service instead of localStorage.",
  (report) => ({
    MemberExpression(node) {
      const { object } = node;
      if (
        object.type === "Identifier" &&
        (object.name === "localStorage" ||
          (globalObjects[object.name] === true &&
            readsProperty(node, "localStorage")))
      ) {
        report(node);
      }
    },
  })
);

/** Exact decimals come from finance-owned constructors, not `BigNumber`. */
const noDirectBignumberConstruction: Rule = nodeRule(
  excluding(sourceFiles, ["src/domain/finance/**"]),
  "Construct exact decimals with finance-owned constructors instead of new BigNumber.",
  (report) => {
    const check = (node: Node & { callee: Node }) => {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "BigNumber"
      ) {
        report(node);
      }
    };
    return { NewExpression: check, CallExpression: check };
  }
);

const dateFormatters: Record<string, true> = {
  "DateTime.format": true,
  "DateTime.formatLocal": true,
  "DateTime.formatUtc": true,
  "DateTime.formatIntl": true,
};

/** Display dates go through `formatDateTime`, which takes an explicit time zone. */
const noDirectDateFormat: Rule = nodeRule(
  excluding(sourceAndTestFiles, ["src/shared/lib/date.ts"]),
  "Format dates for display with formatDateTime from shared/lib/date, which requires an explicit time zone.",
  (report) => ({
    MemberExpression(node) {
      if (
        isMemberPath(node, dateFormatters) ||
        memberPath(node) === "Intl.DateTimeFormat"
      ) {
        report(node);
      }
    },
  })
);

/** Display numbers go through `shared/lib/number-format`, which takes the Widget language. */
const noDirectNumberFormat: Rule = nodeRule(
  excluding(sourceAndTestFiles, ["src/shared/lib/number-format.ts"]),
  "Format numbers for display with shared/lib/number-format, which takes the Widget language explicitly.",
  (report) => ({
    CallExpression(node) {
      if (calledMethod(node) === "toFormat") {
        report(node);
      }
    },
    MemberExpression(node) {
      if (memberPath(node) === "Intl.NumberFormat") {
        report(node);
      }
    },
  })
);

/** Financial domain fields decode with exact schemas, not `Schema.FiniteFromString`. */
const noFinancialFiniteFromString: Rule = nodeRule(
  {
    files: ["earn", "action", "borrow", "portfolio", "finance"].map(
      (domain) => `src/domain/${domain}/**/*.ts`
    ),
  },
  "Decode financial fields with ExactDecimal or ExactBaseUnitAmount, not Schema.FiniteFromString.",
  (report) => ({
    MemberExpression(node) {
      if (memberPath(node) === "Schema.FiniteFromString") {
        report(node);
      }
    },
  })
);

const memoHooks: Record<string, true> = {
  useMemo: true,
  useCallback: true,
  memo: true,
};

const reactMemoHooks: Record<string, true> = {
  "React.useMemo": true,
  "React.useCallback": true,
  "React.memo": true,
};

/** A function whose body holds a `"use no memo"` expression statement. */
const optsOutOfMemo = (node: Node) =>
  (node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression") &&
  node.body?.type === "BlockStatement" &&
  node.body.body.some(
    (statement) =>
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "Literal" &&
      statement.expression.value === "use no memo"
  );

/** React Compiler memoizes; only `"use no memo"` functions call memo hooks. */
const noManualMemo: Rule = nodeRule(
  sourceFiles,
  'React Compiler memoizes components and hooks; remove useMemo, useCallback, and memo. Only functions that opt out with a "use no memo" directive may memoize by hand.',
  (report) => ({
    CallExpression(node) {
      const { callee } = node;
      const memoizes =
        callee.type === "Identifier"
          ? memoHooks[callee.name] === true
          : isMemberPath(callee, reactMemoHooks);
      if (memoizes && !hasAncestor(node, optsOutOfMemo)) {
        report(node);
      }
    },
  })
);

/** `export type { A }` and `export { type A }` without a `from` re-export a type away from its source. */
const noSourceLessTypeExport: Rule = nodeRule(
  {
    files: sourceFiles.files,
    ignores: ["src/index.package.ts", "src/index.bundle.ts"],
  },
  "Export local types at their definition and import external types from their defining module.",
  (report) => ({
    ExportNamedDeclaration(node) {
      const [first] = node.specifiers;
      if (
        node.source === null &&
        first !== undefined &&
        (node.exportKind === "type" || first.exportKind === "type")
      ) {
        report(node);
      }
    },
  })
);

/** `.toNumber()` stays in the representation modules. */
const noTonumberOutsideRepresentation: Rule = nodeRule(
  excluding(sourceFiles, [
    "src/shared/lib/formatters.ts",
    "src/shared/lib/number-format.ts",
  ]),
  "Convert exact values to number only in representation or chart adapters.",
  (report) => ({
    CallExpression(node) {
      if (calledMethod(node) === "toNumber" && node.arguments.length === 0) {
        report(node);
      }
    },
  })
);

const identifierKey =
  /^(?:id|network|hash|address|\w*(?:Id|Key|Address|Hash|Network))$/;

const unbrandedStrings: Record<string, true> = {
  "Schema.String": true,
  "Schema.NonEmptyString": true,
};

const optionalWrappers: Record<string, true> = {
  "Schema.optional": true,
  "Schema.optionalKey": true,
  "Schema.NullOr": true,
  "Schema.UndefinedOr": true,
  "Schema.NullishOr": true,
  "Schema.OptionFromNullOr": true,
  "Schema.OptionFromOptional": true,
  "Schema.OptionFromOptionalKey": true,
  "Schema.OptionFromUndefinedOr": true,
  "Schema.OptionFromNullishOr": true,
};

/** `Schema.String`, or an optional/nullable `Schema` wrapper whose first argument is one. */
const isUnbrandedSchema = (node: Node) =>
  isMemberPath(node, unbrandedStrings) ||
  (node.type === "CallExpression" &&
    isMemberPath(node.callee, optionalWrappers) &&
    node.arguments[0] !== undefined &&
    isMemberPath(node.arguments[0], unbrandedStrings));

const keyName = (key: Node): string | undefined => {
  if (key.type === "Identifier") {
    return key.name;
  }
  return key.type === "Literal" && typeof key.value === "string"
    ? key.value
    : undefined;
};

/** Identifier-like domain fields use a brand or literal union, not a bare string schema. */
const noUnbrandedDomainIdentifier: Rule = nodeRule(
  { files: ["src/domain/**/*.ts"] },
  "Use a brand (`Schema.NonEmptyString.pipe(Schema.brand(...))`) or a literal union for identifier-like domain fields, not an unbranded string schema.",
  (report) => ({
    Property(node) {
      const name = node.computed ? undefined : keyName(node.key);
      if (
        node.parent.type === "ObjectExpression" &&
        name !== undefined &&
        identifierKey.test(name) &&
        isUnbrandedSchema(node.value)
      ) {
        report(node);
      }
    },
  })
);

/** Feature, resource and API Module interface files. */
const moduleInterfaceFiles: ReadonlyArray<string> = [
  ...["src/features/*", "src/features/borrow/*"].flatMap((dir) =>
    ["index", "composition", "views", "runtime"].map(
      (file) => `${dir}/${file}.ts`
    )
  ),
  "src/resources/*/index.ts",
  "src/services/api/operations.ts",
  "src/services/api/resource-sources.ts",
  "src/services/api/runtime.ts",
];

/** Module interfaces list their exports by name. */
const noWildcardModuleInterfaceExport: Rule = nodeRule(
  { files: moduleInterfaceFiles },
  "Module interfaces must use explicit named exports.",
  (report) => ({ ExportAllDeclaration: report })
);

/** Value re-exports stay in Module interfaces and public entrypoints. */
const noBarrelFile: Rule = nodeRule(
  {
    files: ["src/**"],
    ignores: [
      "src/index.package.ts",
      "src/index.bundle.ts",
      "src/public-api/index.package.ts",
      "src/public-api/index.bundle.ts",
      "src/domain/**/contract.ts",
      "src/ui/index.ts",
      "src/ui/composition.ts",
      ...moduleInterfaceFiles,
    ],
  },
  "Barrel re-exports are reserved for Module interfaces; import from the defining module.",
  (report) => ({
    ExportAllDeclaration(node) {
      if (node.exportKind !== "type") {
        report(node);
      }
    },
    ExportNamedDeclaration(node) {
      if (
        node.source !== null &&
        node.exportKind !== "type" &&
        node.specifiers.some((specifier) => specifier.exportKind !== "type")
      ) {
        report(node);
      }
    },
  })
);

const disableDirective =
  /^\s*(?:eslint|oxlint)-disable(?:-line|-next-line)?(?:\s|$)/u;
const reasonSeparator = /\s-{2,}\s/u;

/** A disable directive without named rules or without a `-- reason`. */
const isBlanketDisable = (comment: string) => {
  const directive = disableDirective.exec(comment);
  if (directive === null) {
    return false;
  }
  const separator = reasonSeparator.exec(comment);
  const rules = comment.slice(directive[0].length, separator?.index).trim();
  const reason =
    separator === null
      ? ""
      : comment.slice(separator.index + separator[0].length).trim();
  return rules === "" || reason === "";
};

/** Suppressions name their rules and say why. */
const noBlanketDisable: Rule = scopedRule(
  {
    // `**` skips dot directories, so `.storybook` is listed explicitly.
    files: ["**/*.ts", "**/*.tsx", ".storybook/**/*.ts", ".storybook/**/*.tsx"],
    ignores: ["src/generated/**"],
  },
  (context) => ({
    Program() {
      for (const comment of context.sourceCode.getAllComments()) {
        if (isBlanketDisable(comment.value)) {
          context.report({
            node: comment,
            message: "Suppress named rules and give the reason after `--`.",
          });
        }
      }
    },
  })
);

export default {
  meta: { name: "widget" },
  rules: {
    "no-barrel-file": noBarrelFile,
    "no-blanket-disable": noBlanketDisable,
    "no-direct-bignumber-construction": noDirectBignumberConstruction,
    "no-direct-date-format": noDirectDateFormat,
    "no-direct-number-format": noDirectNumberFormat,
    "no-financial-finite-from-string": noFinancialFiniteFromString,
    "no-local-storage": noLocalStorage,
    "no-manual-memo": noManualMemo,
    "no-source-less-type-export": noSourceLessTypeExport,
    "no-tonumber-outside-representation": noTonumberOutsideRepresentation,
    "no-unbranded-domain-identifier": noUnbrandedDomainIdentifier,
    "no-wildcard-module-interface-export": noWildcardModuleInterfaceExport,
  },
};
