/**
 * Design System rules: Features and application composition compose Design
 * System parts instead of markup and styles, and Design System styles read
 * colors and design values from tokens (docs/design-system.md, Enforcement).
 */
import {
  type FileScope,
  hasAncestor,
  isMemberPath,
  memberPath,
  type Node,
  type Rule,
  scopedRule,
} from "./rule.ts";

/** Features and application composition. */
const compositionFiles: FileScope = {
  files: ["src/features/**", "src/app/**", "src/App.tsx"],
};

/** Design System parts outside token definitions and artwork. */
const designSystemStyleFiles: FileScope = {
  files: ["src/ui/**"],
  ignores: ["src/ui/tokens/**", "src/ui/theme/*.ts", "src/ui/artwork/**"],
};

const stylexDefinitions: Record<string, true> = {
  "stylex.create": true,
  "stylex.keyframes": true,
  "stylex.createTheme": true,
  "stylex.defineVars": true,
  "stylex.defineConsts": true,
  "stylex.firstThatWorks": true,
  "stylex.viewTransitionClass": true,
  "stylex.positionTry": true,
};

const isStylexDefinition = (node: Node): boolean =>
  node.type === "CallExpression" &&
  isMemberPath(node.callee, stylexDefinitions);

/** `stylex.when.*(…)`, whose arguments are selectors, not values. */
const isStylexWhen = (node: Node): boolean =>
  node.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  memberPath(node.callee.object) === "stylex.when";

const isString = (node: Node): node is Node & { value: string } =>
  node.type === "Literal" && typeof node.value === "string";

/** An object literal's `key: value` entry, not a shorthand, method or pattern. */
const isPair = (node: Node): node is Node & { type: "Property" } =>
  node.type === "Property" &&
  node.parent.type === "ObjectExpression" &&
  node.kind === "init" &&
  !node.method &&
  !node.shorthand;

/** Whether `node` is a pair whose key, quoted or not, matches `pattern`. */
const isPairKeyed = (node: Node, pattern: RegExp): boolean => {
  if (!isPair(node) || node.computed) {
    return false;
  }
  const { key } = node;
  return (
    (key.type === "Identifier" && pattern.test(key.name)) ||
    (key.type === "Literal" && pattern.test(key.raw ?? ""))
  );
};

/** The cooked text of each string or template literal part. */
const literalTexts = (node: Node): ReadonlyArray<string> => {
  if (isString(node)) {
    return [node.value];
  }
  return node.type === "TemplateLiteral"
    ? node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw)
    : [];
};

/** Features and application composition render no HTML or SVG elements. */
const noHtmlElementOutsideDesignSystem: Rule = scopedRule(
  compositionFiles,
  (context) => {
    const message =
      "Features and application composition render no HTML or SVG elements. Compose a part from the Design System (`src/ui/index.ts`); if none fits, extend the Design System instead of working around it.";
    return {
      JSXOpeningElement(node) {
        if (/^[a-z]/u.test(context.sourceCode.getText(node.name))) {
          context.report({ node, message });
        }
      },
      // `createElement("div")` and `React.createElement("svg", …)`.
      CallExpression(node) {
        const { callee } = node;
        const [tag] = node.arguments;
        if (
          (callee.type === "Identifier"
            ? callee.name === "createElement"
            : memberPath(callee) === "React.createElement") &&
          tag !== undefined &&
          isString(tag) &&
          /^[a-z]/u.test(tag.value)
        ) {
          context.report({ node, message });
        }
      },
    };
  }
);

const classNameOrStyle = /^["']?(?:className|style)["']?$/u;

/** Features and application composition pass no `className` or `style`. */
const noClassNameOrStyleOutsideDesignSystem: Rule = scopedRule(
  compositionFiles,
  (context) => {
    const message =
      "Features and application composition pass no `className` or `style`. Choose a Design System prop (a tone, size, variant or spacing value); if none fits, extend the Design System instead of styling the screen.";
    return {
      JSXAttribute(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          classNameOrStyle.test(node.name.name)
        ) {
          context.report({ node, message });
        }
      },
      // `{...{ className }}` and `{...{ style: value }}` on an element.
      JSXSpreadAttribute({ argument }) {
        if (
          argument.type === "ObjectExpression" &&
          argument.properties.some(
            (property) =>
              (property.type === "Property" &&
                property.shorthand &&
                property.key.type === "Identifier" &&
                classNameOrStyle.test(property.key.name)) ||
              isPairKeyed(property, classNameOrStyle)
          )
        ) {
          context.report({ node: argument, message });
        }
      },
    };
  }
);

const colorLiterals = [
  /(?:^|[\s(,:])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/iu,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/iu,
];

const namedColor =
  /^["'](?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)["']$/iu;

const colorAttribute =
  /^(?:color|fill|stroke|stopColor|floodColor|lightingColor)$/u;

/** A named color in a StyleX definition or a color attribute like `fill="white"`. */
const isNamedColor = (node: Node): boolean => {
  if (node.type !== "Literal" || !namedColor.test(node.raw ?? "")) {
    return false;
  }
  const { parent } = node;
  return (
    (parent.type === "JSXAttribute" &&
      parent.name.type === "JSXIdentifier" &&
      colorAttribute.test(parent.name.name)) ||
    hasAncestor(node, isStylexDefinition)
  );
};

/** Design System parts read colors from Color Roles, never from literals. */
const noColorLiteralInDesignSystem: Rule = scopedRule(
  designSystemStyleFiles,
  (context) => {
    const check = (node: Node) => {
      if (
        literalTexts(node).some((text) =>
          colorLiterals.some((pattern) => pattern.test(text))
        ) ||
        isNamedColor(node)
      ) {
        context.report({
          node,
          message:
            "Design System parts read colors from Color Roles (`tokens/color.stylex.ts`), never from color literals. Add or derive a Color Role in the token definitions when none fits; brand artwork lives in `ui/artwork/`.",
        });
      }
    };
    return { Literal: check, TemplateLiteral: check };
  }
);

const designValueProperty =
  /^["']?(?:fontSize|fontWeight|lineHeight|letterSpacing|border(?:Top|Bottom|Start|End)?(?:Left|Right|Start|End)?Radius|boxShadow|textShadow|zIndex|transition|animation|(?:transition|animation)(?:Duration|Delay))["']?$/u;

const unitlessProperty =
  /^["']?(?:flex|flexGrow|flexShrink|opacity|fillOpacity|strokeOpacity|stopOpacity|order|aspectRatio|animationIterationCount|columnCount|gridColumn(?:Start|End)?|gridRow(?:Start|End)?|scale|lineClamp|WebkitLineClamp|tabSize|widows|orphans)["']?$/u;

const cssKeyword =
  /^["']?(?:0(?:px|m?s)?|inherit|initial|unset|revert|revert-layer|none|normal|auto)["']?$/u;

/** px, rem, ch and durations; em but `1em`; vw and vh but `100vw` and `100vh`. */
const rawUnits = [
  /(?:^|[^\w.-])-?(?:[1-9]\d*(?:\.\d+)?|0?\.\d*[1-9]\d*)(?:px|rem|ch|m?s)\b/u,
  /(?:^|[^\w.-])-?(?:(?:[2-9]|1\d)\d*(?:\.\d+)?|1\.\d*[1-9]\d*|0?\.\d*[1-9]\d*)em\b/u,
  /(?:^|[^\w.-])-?(?:(?:[1-9]\d?|[2-9]\d{2}|1[1-9]\d|10[1-9]|[1-9]\d{3,})(?:\.\d+)?|100\.\d*[1-9]\d*|0?\.\d*[1-9]\d*)v[wh]\b/u,
];

const zero = /^0*\.?0*$/u;

/** A value inside a StyleX definition: not a key, not a `stylex.when` selector. */
const isStylexValue = (node: Node): boolean => {
  const { parent } = node;
  return (
    parent !== null &&
    !(isPair(parent) && !parent.computed && parent.key === node) &&
    hasAncestor(node, isStylexDefinition) &&
    !hasAncestor(node, isStylexWhen)
  );
};

const isInPairKeyed = (node: Node, pattern: RegExp): boolean =>
  hasAncestor(node, (ancestor) => isPairKeyed(ancestor, pattern));

const isNumeric = (value: unknown): boolean =>
  typeof value === "number" || typeof value === "bigint";

/** A non-zero number on a property that takes a length. */
const isRawLength = (node: Node): boolean =>
  node.type === "Literal" &&
  isNumeric(node.value) &&
  !zero.test(node.raw ?? "") &&
  !(node.parent.type === "MemberExpression" && node.parent.computed) &&
  !isInPairKeyed(node, unitlessProperty);

/** A literal font size, weight, line height, radius, shadow, layer or duration. */
const isRawDesignProperty = (node: Node): boolean =>
  (node.type === "TemplateLiteral" ||
    (node.type === "Literal" &&
      (typeof node.value === "string" || isNumeric(node.value)) &&
      !cssKeyword.test(node.raw ?? ""))) &&
  isInPairKeyed(node, designValueProperty);

/** Design System styles read design values from tokens, never raw values. */
const noRawDesignValue: Rule = scopedRule(designSystemStyleFiles, (context) => {
  const check = (node: Node) => {
    if (
      isStylexValue(node) &&
      (isRawLength(node) ||
        literalTexts(node).some((text) =>
          rawUnits.some((pattern) => pattern.test(text))
        ) ||
        isRawDesignProperty(node))
    ) {
      context.report({
        node,
        message:
          "Design System styles read sizes, type, radii, shadows, layers and durations from tokens, never from raw values. Use the matching token or add one to the token definitions (`ui/tokens/`).",
      });
    }
  };
  return { Literal: check, TemplateLiteral: check };
});

export default {
  meta: { name: "design-system" },
  rules: {
    "no-class-name-or-style-outside-design-system":
      noClassNameOrStyleOutsideDesignSystem,
    "no-color-literal-in-design-system": noColorLiteralInDesignSystem,
    "no-html-element-outside-design-system": noHtmlElementOutsideDesignSystem,
    "no-raw-design-value": noRawDesignValue,
  },
};
