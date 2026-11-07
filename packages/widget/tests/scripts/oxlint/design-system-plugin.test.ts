import plugin from "../../../scripts/oxlint/design-system-plugin";
import widgetPlugin from "../../../scripts/oxlint/widget-plugin";
import { ruleRunner, tester, widget } from "./rule-tester";

const run = ruleRunner(plugin.rules);

const feature = `${widget}src/features/earn/ui/page.tsx`;
const part = `${widget}src/ui/components/button.tsx`;

const htmlElementMessage =
  "Features and application composition render no HTML or SVG elements. Compose a part from the Design System (`src/ui/index.ts`); if none fits, extend the Design System instead of working around it.";

run("no-html-element-outside-design-system", {
  filename: feature,
  message: htmlElementMessage,
  valid: [
    'const row = <Box gap="8"><Text variant="label">Label</Text></Box>',
    'const action = <Button variant="primary" size="cta" />',
    'const field = <Form.Field name="amount" />',
    "const fragment = <><Text>One</Text><Text>Two</Text></>",
    'const message = t("html.div")',
    'const box = createElement(Box, { gap: "8" })',
    'const node = document.createElement("div")',
  ],
  invalid: [
    'const box = <div className="x" />',
    "const box = <div>content</div>",
    'const action = <button type="button">Go</button>',
    'const link = <a href="https://yield.xyz">Docs</a>',
    "const label = <Text><span>nested</span></Text>",
    "const custom = <sk-widget />",
    'const box = createElement("div", null, "content")',
    'const icon = React.createElement("svg", { viewBox: "0 0 24 24" })',
  ],
  outOfScope: [
    `${widget}src/ui/components/button.tsx`,
    `${widget}src/services/config/widget-config.tsx`,
  ],
});

tester.run(
  "no-html-element-outside-design-system nested",
  plugin.rules["no-html-element-outside-design-system"],
  {
    valid: [],
    invalid: ["src/app/layouts/shell.tsx", "src/App.tsx"].map((file) => ({
      code: 'const icon = <svg viewBox="0 0 24 24"><path d="M0 0" /></svg>',
      filename: `${widget}${file}`,
      errors: [
        { message: htmlElementMessage },
        { message: htmlElementMessage },
      ],
    })),
  }
);

run("no-class-name-or-style-outside-design-system", {
  filename: feature,
  message:
    "Features and application composition pass no `className` or `style`. Choose a Design System prop (a tone, size, variant or spacing value); if none fits, extend the Design System instead of styling the screen.",
  valid: [
    'const row = <Box gap="8" width="full" />',
    'const label = <Text variant="label" tone="muted">Fee</Text>',
    'const styled = { className: "x", style: {} }',
    'const action = <Button styleVariant="primary" />',
    'const box = <Box {...{ gap: "8", width: "full" }} />',
    'const props = { ...{ className: "x" } }',
  ],
  invalid: [
    "const box = <Box className={styles.row} />",
    'const box = <Box className="x" />',
    'const label = <Text style={{ color: "red" }}>Fee</Text>',
    'const box = <div className="x" />',
    "const box = <Box style={dynamicStyle}><Text>Fee</Text></Box>",
    "const box = <Box {...{ className }} />",
    "const box = <Box {...{ style: dynamicStyle }} />",
    'const box = <Box {...{ "className": "x" }}><Text>Fee</Text></Box>',
  ],
  outOfScope: [part],
});

run("no-color-literal-in-design-system", {
  filename: part,
  message:
    "Design System parts read colors from Color Roles (`tokens/color.stylex.ts`), never from color literals. Add or derive a Color Role in the token definitions when none fits; brand artwork lives in `ui/artwork/`.",
  valid: [
    "const styles = stylex.create({ root: { color: color.text, backgroundColor: color.surface } })",
    'const styles = stylex.create({ root: { borderColor: "transparent", color: "currentColor" } })',
    'const styles = stylex.create({ root: { color: "inherit" } })',
    'const label = "red"',
    'const anchor = "https://yield.xyz/docs#fees"',
    'const icon = <path fill="currentColor" d="M0 0" />',
    'const tone = { danger: "danger", success: "success" }',
    'const icon = <path fill={"white"} d="M0 0" />',
  ],
  invalid: [
    'const styles = stylex.create({ root: { color: "#FFF" } })',
    'const styles = stylex.create({ root: { color: "#4A60FF" } })',
    'const styles = stylex.create({ root: { color: { default: "#4a60ff80", ":hover": color.text } } })',
    'const styles = stylex.create({ root: { backgroundColor: "rgb(0 0 0 / 0.5)" } })',
    'const styles = stylex.create({ root: { backgroundColor: "rgba(0, 0, 0, 0.5)" } })',
    'const styles = stylex.create({ root: { color: "hsl(230 100% 65%)" } })',
    'const styles = stylex.create({ root: { color: "oklch(0.6 0.2 260)" } })',
    'const styles = stylex.create({ root: { boxShadow: "0 0 0 1px #2C2C31" } })',
    'const styles = stylex.create({ root: { color: "white" } })',
    'const styles = stylex.create({ root: { color: { default: "Red", ":hover": color.text } } })',
    'const spin = stylex.keyframes({ from: { color: "black" } })',
    'const icon = <path fill="#000" d="M0 0" />',
    'const icon = <circle stroke="white" r="4" />',
    'const shadow = `0 0 0 1px ${"#fff"}`',
    "const ring = `0 0 0 2px rgba(0,0,0,.2)`",
  ],
  outOfScope: [
    `${widget}src/ui/tokens/color.stylex.tsx`,
    `${widget}src/ui/artwork/logo.tsx`,
    {
      code: 'const theme = stylex.createTheme(vars, { text: "#fff" })',
      filename: `${widget}src/ui/theme/finery.ts`,
    },
    feature,
  ],
});

const rawDesignValueMessage =
  "Design System styles read sizes, type, radii, shadows, layers and durations from tokens, never from raw values. Use the matching token or add one to the token definitions (`ui/tokens/`).";

run("no-raw-design-value", {
  filename: part,
  message: rawDesignValueMessage,
  valid: [
    "const styles = stylex.create({ root: { fontSize: fontSize.body, lineHeight: lineHeight.body, fontWeight: fontWeight.semibold } })",
    "const styles = stylex.create({ root: { borderRadius: radius.control, boxShadow: elevation.raised, zIndex: layer.overlay } })",
    "const styles = stylex.create({ root: { transitionDuration: motion.fast, animationDuration: motion.spin } })",
    "const styles = stylex.create({ root: { margin: 0, paddingBlock: 0, flexShrink: 0, flexGrow: 1, opacity: 0.5, order: 2 } })",
    'const styles = stylex.create({ root: { width: "100%", height: "1em", transform: "rotate(360deg)" } })',
    'const styles = stylex.create({ root: { boxShadow: "none", zIndex: "auto", lineHeight: "normal", fontSize: "inherit" } })',
    'const styles = stylex.create({ root: { gap: space[8], ":hover": { opacity: 0.8 } } })',
    'const styles = stylex.create({ root: { animationIterationCount: "infinite", gridColumnStart: 2 } })',
    'const styles = stylex.create({ root: { borderWidth: borderWidth.thin, transitionDuration: "0ms" } })',
    'const styles = stylex.create({ root: { width: "100vw", maxHeight: "100vh", height: "1em", minWidth: "1.0em" } })',
    "const styles = stylex.create({ root: { width: `min(${size.dialog}, calc(100vw - 2 * ${size.inset}))` } })",
    "const styles = stylex.create({ root: { borderRadius: { default: 0, [stylex.when.ancestor('[data-sk-tabs-indicator=\"pill\"]', presentationMarker)]: radius.pill } } })",
    // Keys and `stylex.when` arguments are selectors, not values.
    'const styles = stylex.create({ root: { width: { default: "100%", "@container (min-width: 400px)": "50%" } } })',
    'const styles = stylex.create({ root: { width: { default: "100%", [stylex.when.ancestor(\'[data-gap="4px"]\')]: "50%" } } })',
    "const size = 16",
    'const delay = "200ms"',
    "const offset = { top: 12 }",
    "const styles = stylex.create({ root: { boxShadow: { default: null, ':hover': elevation.raised } } })",
  ],
  invalid: [
    "const styles = stylex.create({ root: { borderWidth: 1 } })",
    "const styles = stylex.create({ root: { padding: 12 } })",
    "const styles = stylex.create({ root: { marginTop: -4 } })",
    'const styles = stylex.create({ root: { width: "24px" } })',
    'const styles = stylex.create({ root: { padding: "0 0.5px" } })',
    "const styles = stylex.create({ root: { fontSize: 14 } })",
    'const styles = stylex.create({ root: { fontSize: "1rem" } })',
    "const styles = stylex.create({ root: { fontWeight: 600 } })",
    'const styles = stylex.create({ root: { fontWeight: "bold" } })',
    "const styles = stylex.create({ root: { lineHeight: 1.5 } })",
    'const styles = stylex.create({ root: { borderRadius: "50%" } })',
    "const styles = stylex.create({ root: { borderTopLeftRadius: 8 } })",
    'const styles = stylex.create({ root: { boxShadow: "0 1px 2px var(--shadow)" } })',
    "const styles = stylex.create({ root: { zIndex: 10 } })",
    'const styles = stylex.create({ root: { transitionDuration: "200ms" } })',
    'const styles = stylex.create({ root: { animationDuration: "1s" } })',
    'const styles = stylex.create({ root: { transition: "opacity 0.2s ease" } })',
    'const styles = stylex.create({ root: { width: { default: 320, "@container (min-width: 400px)": "100%" } } })',
    'const styles = stylex.create({ root: { fontSize: { default: fontSize.body, ":hover": 16 } } })',
    'const pulse = stylex.keyframes({ "50%": { transform: "translateY(4px)" } })',
    "const styles = stylex.create({ marker: (left: number) => ({ left, width: 4 }) })",
    "const styles = stylex.create({ root: { gap: space[8], padding: 6 } })",
    'const styles = stylex.create({ root: { padding: "1rem" } })',
    'const styles = stylex.create({ root: { width: "2rem" } })',
    'const styles = stylex.create({ root: { gap: "0.5em" } })',
    'const styles = stylex.create({ root: { height: "2em" } })',
    'const styles = stylex.create({ root: { width: "50vw" } })',
    'const styles = stylex.create({ root: { maxHeight: "80vh" } })',
    'const styles = stylex.create({ root: { maxWidth: "60ch" } })',
    'const styles = stylex.create({ root: { width: "calc(100vw - 1rem)" } })',
    "const styles = stylex.create({ root: { boxShadow: `0 0 0 ${borderWidth.thin}` } })",
  ],
  outOfScope: [
    `${widget}src/ui/tokens/space.stylex.ts`,
    `${widget}src/ui/theme/finery.ts`,
    `${widget}src/ui/artwork/logo.tsx`,
    feature,
  ],
});

tester.run(
  "no-raw-design-value per value",
  plugin.rules["no-raw-design-value"],
  {
    valid: [],
    invalid: [
      {
        code: "const styles = stylex.create({ root: { outlineOffset: 2, outlineWidth: 2 } })",
        filename: part,
        errors: [
          { message: rawDesignValueMessage },
          { message: rawDesignValueMessage },
        ],
      },
    ],
  }
);

// A Design System suppression names its rule and states its reason; the
// widget's blanket-disable rule covers every named oxlint or ESLint disable.
tester.run(
  "no-blanket-disable on Design System suppressions",
  widgetPlugin.rules["no-blanket-disable"],
  {
    valid: [
      "// oxlint-disable-next-line design-system/no-raw-design-value -- hairline divider matches the host's 1px rule\nconst styles = stylex.create({ root: { borderWidth: 1 } })",
      "// oxlint-disable-next-line @stylexjs/sort-keys -- order mirrors the cascade the reset relies on\nconst styles = stylex.create({ root: { width: 1, height: 1 } })",
      "/* oxlint-disable @stylexjs/no-unused -- styles read through a dynamic key */\nconst styles = stylex.create({})",
    ].map((code) => ({ code, filename: part })),
    invalid: [
      "// oxlint-disable-next-line design-system/no-raw-design-value\nconst styles = stylex.create({ root: { borderWidth: 1 } })",
      '// oxlint-disable-next-line design-system/no-html-element-outside-design-system, design-system/no-class-name-or-style-outside-design-system\nconst link = <a className="x" href="/" />',
      '// oxlint-disable-next-line design-system/no-color-literal-in-design-system - forgot the second dash\nconst styles = stylex.create({ root: { color: "#fff" } })',
      "const link = <>{/* oxlint-disable-next-line design-system/no-class-name-or-style-outside-design-system */}</>",
      "// oxlint-disable-next-line @stylexjs/sort-keys\nconst styles = stylex.create({ root: { width: 1, height: 1 } })",
      "/* eslint-disable @stylexjs/valid-styles */\nconst styles = stylex.create({})",
      "// oxlint-disable-next-line\nconst styles = stylex.create({ root: { width: 1 } })",
      "/* oxlint-disable */\nconst styles = stylex.create({})",
    ].map((code) => ({
      code,
      filename: part,
      errors: [
        { message: "Suppress named rules and give the reason after `--`." },
      ],
    })),
  }
);
