/**
 * Layout and Host Profile rules: Features stay Layout-agnostic, read Host
 * Profile capabilities instead of variant names, and build Widget paths from
 * the route registry (ADR 0013; ARCHITECTURE.md, Enforcement).
 */
import {
  excluding,
  type FileScope,
  memberName,
  type Node,
  type Rule,
  scopedRule,
  sourceFiles,
} from "./rule.ts";

type Predicate = (node: Node) => boolean;

const equalityOperators: Record<string, true> = {
  "==": true,
  "===": true,
  "!=": true,
  "!==": true,
};

const isStringMatching = (node: Node, pattern: RegExp): boolean =>
  node.type === "Literal" &&
  typeof node.value === "string" &&
  pattern.test(node.value);

const isIdentifierMatching = (node: Node, pattern: RegExp): boolean =>
  node.type === "Identifier" && pattern.test(node.name);

/** `object.name` (not computed) whose property matches `pattern`. */
const isPropertyReadMatching = (node: Node, pattern: RegExp): boolean => {
  const name = memberName(node);
  return name !== undefined && pattern.test(name);
};

/** `name(…)` or `object.name(…)` whose name matches `pattern`. */
const isCalleeNamed = (callee: Node, pattern: RegExp): boolean =>
  isIdentifierMatching(callee, pattern) ||
  isPropertyReadMatching(callee, pattern);

/** `a === b` (or `==`, `!=`, `!==`) with one side `value` and the other `reference`. */
const comparesWith = (
  node: Node,
  value: Predicate,
  reference: Predicate
): boolean =>
  node.type === "BinaryExpression" &&
  equalityOperators[node.operator] === true &&
  ((value(node.left) && reference(node.right)) ||
    (value(node.right) && reference(node.left)));

const hostVariantLiteral = /^(?:default|finery|porto|utila|zerion)$/;
const variantName = /^(?:[a-z][A-Za-z]*V|v)ariant$/;

const isHostVariantLiteral: Predicate = (node) =>
  isStringMatching(node, hostVariantLiteral);

const isVariantReference: Predicate = (node) =>
  isIdentifierMatching(node, variantName) ||
  isPropertyReadMatching(node, variantName);

/** Host variants are read as Host Profile capabilities, not compared with variant names. */
const noHostVariantComparison: Rule = scopedRule(
  excluding(sourceFiles, ["src/services/config/**"]),
  (context) => {
    const message =
      "Read a Host Profile capability from Widget Configuration instead of comparing the host variant with a string literal. Only the configuration Module may branch on variant names.";
    return {
      BinaryExpression(node) {
        if (comparesWith(node, isHostVariantLiteral, isVariantReference)) {
          context.report({ node, message });
        }
      },
      SwitchCase(node) {
        const { parent, test } = node;
        if (
          test !== null &&
          isHostVariantLiteral(test) &&
          parent.type === "SwitchStatement" &&
          isVariantReference(parent.discriminant)
        ) {
          context.report({ node, message });
        }
      },
    };
  }
);

const layoutName = /dashboard|compact/i;
/** Compact number notation is a number format, not the Layout. */
const compactNumberFormat = /Compact(?:Number|Usd)$/;

/** Logic Modules name what they model, never the Layout that shows it. */
const noLayoutNameInLogic: Rule = scopedRule(
  {
    files: [
      "src/domain/**/*.ts",
      "src/resources/**/*.ts",
      "src/services/**/*.ts",
      "src/features/**/model/**/*.ts",
      "src/features/**/state/**/*.ts",
    ],
    // Decodes the public `dashboardVariant` Host Configuration flag.
    ignores: ["src/services/config/widget-config-boundary.ts"],
  },
  (context) => {
    // A shorthand property or import names one source token with two nodes.
    const reported: Record<number, true> = {};
    return {
      Identifier(node) {
        if (
          layoutName.test(node.name) &&
          !compactNumberFormat.test(node.name) &&
          reported[node.start] !== true
        ) {
          reported[node.start] = true;
          context.report({
            node,
            message:
              "Logic is Layout-agnostic. Name what the code models, not the Layout that shows it; Layout names belong to the application composition and Feature `ui/compact` or `ui/dashboard`.",
          });
        }
      },
    };
  }
);

const layoutPathScope: FileScope = {
  files: [
    "src/**/*[Cc][Oo][Mm][Pp][Aa][Cc][Tt]*",
    "src/**/*[Cc][Oo][Mm][Pp][Aa][Cc][Tt]*/**",
    "src/**/*[Dd][Aa][Ss][Hh][Bb][Oo][Aa][Rr][Dd]*",
    "src/**/*[Dd][Aa][Ss][Hh][Bb][Oo][Aa][Rr][Dd]*/**",
  ],
  ignores: ["src/**/ui/**", "src/app/layouts/**"],
};

/** Only Layout `ui/` directories and `src/app/layouts` name a Layout in their path. */
const noLayoutPathOutsideLayoutUi: Rule = scopedRule(
  layoutPathScope,
  (context) => ({
    Program(node) {
      context.report({
        node,
        message:
          "A path naming a Layout belongs under a `ui/compact` or `ui/dashboard` directory or `src/app/layouts`. Elsewhere, name the file or directory after what it holds, not the Layout.",
      });
    },
  })
);

const layoutKey = /^layout$/;

/** `config`, `useWidgetPresentation()`, or a call reading `widgetConfigAtom`. */
const isLayoutSource: Predicate = (node) =>
  isIdentifierMatching(node, /^(?:config|widgetConfig|settings)$/) ||
  (node.type === "CallExpression" &&
    (isIdentifierMatching(node.callee, /^useWidgetPresentation$/) ||
      node.arguments.some((argument) =>
        isIdentifierMatching(argument, /^widgetConfigAtom$/)
      )));

/** `{ layout }` or `{ layout: name }`. */
const destructuresLayout = (node: Node): boolean =>
  node.type === "ObjectPattern" &&
  node.properties.some(
    (property) =>
      property.type === "Property" &&
      !property.computed &&
      isIdentifierMatching(property.key, layoutKey)
  );

/** Only the application composition and Widget Configuration read the Layout. */
const noLayoutReadInFeatures: Rule = scopedRule(
  {
    files: sourceFiles.files,
    ignores: [
      "src/App.tsx",
      "src/app/**",
      "src/services/config/**",
      "src/features/widget-configuration/**",
    ],
  },
  (context) => {
    const message =
      "Features are Layout-agnostic; the application composes each Layout. Put a Layout-specific screen under `ui/compact` or `ui/dashboard`, or take a prop the Layout composition supplies.";
    return {
      CallExpression(node) {
        if (
          isIdentifierMatching(node.callee, /^useWidgetConfig$/) &&
          node.arguments.some((argument) =>
            isStringMatching(argument, layoutKey)
          )
        ) {
          context.report({ node, message });
        }
      },
      MemberExpression(node) {
        if (
          isPropertyReadMatching(node, layoutKey) &&
          isLayoutSource(node.object)
        ) {
          context.report({ node, message });
        }
      },
      VariableDeclarator(node) {
        if (
          node.init !== null &&
          destructuresLayout(node.id) &&
          isLayoutSource(node.init)
        ) {
          context.report({ node, message });
        }
      },
    };
  }
);

/** A relative `..` redirect or a `*` catch-all. */
const literalRoute = /^(?:\.\.(?:\/\.\.)*|\*)$/;

const isRawPath: Predicate = (node) =>
  node.type === "TemplateLiteral" ||
  (node.type === "Literal" &&
    typeof node.value === "string" &&
    !literalRoute.test(node.value));

const isAbsolutePathLiteral: Predicate = (node) =>
  (node.type === "TemplateLiteral" &&
    node.quasis[0]?.value.raw.startsWith("/") === true) ||
  isStringMatching(node, /^\//);

const isPathnameReference: Predicate = (node) =>
  isIdentifierMatching(node, /[Pp]athname$/) ||
  isPropertyReadMatching(node, /^pathname$/);

const routerAttributes: Record<string, RegExp> = {
  to: /^(?:Navigate|Link|NavLink|SKLink|WidgetNavigate|WidgetLink)$/,
  path: /^Route$/,
};

/** `<Link to="…">` or `<Route path="…">` given a string or template literal. */
const isRawRouterAttribute = (node: Node): boolean => {
  if (
    node.type !== "JSXAttribute" ||
    node.name.type !== "JSXIdentifier" ||
    node.value === null ||
    node.parent.type !== "JSXOpeningElement" ||
    node.parent.name.type !== "JSXIdentifier"
  ) {
    return false;
  }
  const element = routerAttributes[node.name.name];
  const { value } = node;
  return (
    element !== undefined &&
    element.test(node.parent.name.name) &&
    (isRawPath(value) ||
      (value.type === "JSXExpressionContainer" && isRawPath(value.expression)))
  );
};

/** Widget paths, route patterns and matchers come from the route registry. */
const noRawWidgetPath: Rule = scopedRule(
  excluding(sourceFiles, ["src/services/navigation/widget-routes.ts"]),
  (context) => {
    const message =
      "Build Widget paths, route patterns, and route matchers from the route registry (`services/navigation/widget-routes.ts`) instead of string literals. Only relative `..` redirects and `*` catch-alls may stay literal.";
    const report = (node: Node) => context.report({ node, message });
    return {
      CallExpression(node) {
        const { callee } = node;
        const [first] = node.arguments;
        // navigate("/…"), useMatch("…"), matchPath("…")
        const takesPath =
          isCalleeNamed(callee, /^navigate$/) ||
          isIdentifierMatching(callee, /^(?:useMatch|matchPath)$/);
        // pathname.startsWith("/…"), startsWith("/…")
        const testsPrefix = isCalleeNamed(callee, /^startsWith$/);
        if (
          first !== undefined &&
          ((takesPath && isRawPath(first)) ||
            (testsPrefix && isAbsolutePathLiteral(first)))
        ) {
          report(node);
        }
      },
      BinaryExpression(node) {
        if (comparesWith(node, isAbsolutePathLiteral, isPathnameReference)) {
          report(node);
        }
      },
      JSXAttribute(node) {
        if (isRawRouterAttribute(node)) {
          report(node);
        }
      },
    };
  }
);

export default {
  meta: { name: "layout" },
  rules: {
    "no-host-variant-comparison": noHostVariantComparison,
    "no-layout-name-in-logic": noLayoutNameInLogic,
    "no-layout-path-outside-layout-ui": noLayoutPathOutsideLayoutUi,
    "no-layout-read-in-features": noLayoutReadInFeatures,
    "no-raw-widget-path": noRawWidgetPath,
  },
};
