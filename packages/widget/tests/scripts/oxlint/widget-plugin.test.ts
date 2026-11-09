import plugin from "../../../scripts/oxlint/widget-plugin";
import { ruleRunner, tester, widget } from "./rule-tester";

const source = `${widget}src/features/earn/state/page.ts`;
const component = `${widget}src/features/earn/ui/page.tsx`;
const testFile = `${widget}tests/features/earn/page.test.ts`;
const generated = `${widget}src/generated/api/yield.ts`;

const run = ruleRunner(plugin.rules);

run("no-local-storage", {
  filename: source,
  message: "Use the persistence service instead of localStorage.",
  valid: [
    "persistence.get(key)",
    'const order = ["localStorage"]',
    "const storage = injectedStorage",
  ],
  invalid: [
    "localStorage.getItem(key)",
    "window.localStorage.setItem(key, value)",
    "globalThis.localStorage.removeItem(key)",
    'window["localStorage"].clear()',
    "localStorage[key]",
    "const storage = window.localStorage",
  ],
  outOfScope: [
    { code: "localStorage.getItem(key)", filename: testFile },
    { code: "localStorage.getItem(key)", filename: generated },
  ],
});

run("no-direct-bignumber-construction", {
  filename: source,
  message:
    "Construct exact decimals with finance-owned constructors instead of new BigNumber.",
  valid: [
    'const amount = exactDecimal("1.5")',
    "const zero = exactZero()",
    "type Amount = BigNumber",
  ],
  invalid: [
    'const amount = new BigNumber("1.5")',
    "const zero = new BigNumber(0)",
    'const amount = BigNumber("1.5")',
  ],
  outOfScope: [
    {
      code: 'const amount = new BigNumber("1.5")',
      filename: `${widget}src/domain/finance/exact-decimal.ts`,
    },
    { code: 'const amount = new BigNumber("1.5")', filename: testFile },
  ],
});

run("no-direct-date-format", {
  filename: testFile,
  message:
    "Format dates for display with formatDateTime from shared/lib/date, which requires an explicit time zone.",
  valid: [
    "const label = formatDateTime(value, { locale, timeZone })",
    "const wire = DateTime.formatIso(value)",
    "const parts = DateTime.toParts(value)",
  ],
  invalid: [
    "const label = DateTime.format(value, { locale })",
    "const label = DateTime.formatLocal(value, { locale })",
    "const label = DateTime.formatUtc(value, { locale })",
    "const label = DateTime.formatIntl(value, formatter)",
    "const formatter = new Intl.DateTimeFormat(locale, options)",
    "const label = Intl.DateTimeFormat(locale).format(value)",
  ],
  outOfScope: [
    {
      code: "const label = DateTime.format(value, { locale })",
      filename: `${widget}src/shared/lib/date.ts`,
    },
    {
      code: "const label = DateTime.format(value, { locale })",
      filename: `${widget}tests/generated/fixtures.ts`,
    },
  ],
});

run("no-direct-number-format", {
  filename: component,
  message:
    "Format numbers for display with shared/lib/number-format, which takes the Widget language explicitly.",
  valid: [
    "const label = formatNumber(value, locale, 6)",
    "const label = formatUsd(value, locale)",
    "const label = formatPercent(ratio, locale)",
    "const wire = value.toFixed()",
    "const label = DateTime.format(value, { locale })",
  ],
  invalid: [
    "const label = value.toFormat()",
    "const label = exactDecimal(value).toFormat(2)",
    'const label = value.toFormat({ decimalSeparator: "," })',
    'const formatter = new Intl.NumberFormat("en-US", options)',
    "const label = Intl.NumberFormat(locale).format(value)",
  ],
  outOfScope: [
    {
      code: "const label = value.toFormat()",
      filename: `${widget}src/shared/lib/number-format.ts`,
    },
    { code: "const label = value.toFormat()", filename: generated },
  ],
});

run("no-financial-finite-from-string", {
  filename: `${widget}src/domain/borrow/catalog/market.ts`,
  message:
    "Decode financial fields with ExactDecimal or ExactBaseUnitAmount, not Schema.FiniteFromString.",
  valid: [
    "const amount = ExactDecimal",
    "const raw = ExactBaseUnitAmount",
    "const count = Schema.Number",
  ],
  invalid: ["const amount = Schema.FiniteFromString"],
  outOfScope: [
    {
      code: "const amount = Schema.FiniteFromString",
      filename: `${widget}src/domain/settings/model.ts`,
    },
  ],
});

run("no-manual-memo", {
  filename: component,
  message:
    'React Compiler memoizes components and hooks; remove useMemo, useCallback, and memo. Only functions that opt out with a "use no memo" directive may memoize by hand.',
  valid: [
    "const total = items.length * price",
    'const memo = { note: "useMemo" }',
    "transaction.memo(value)",
    `const List = () => {
      "use no memo";
      const end = useMemo(() => items.at(-1), [items]);
      return end;
    };`,
    `function List() {
      "use no memo";
      const onScroll = useCallback(() => load(), [load]);
      return onScroll;
    }`,
  ],
  invalid: [
    "const total = useMemo(() => items.length * price, [items, price])",
    "const total = React.useMemo(() => items.length, [items])",
    "const onClick = useCallback(() => submit(), [submit])",
    "const onClick = React.useCallback(() => submit(), [submit])",
    "export const Row = memo((props: Props) => <div>{props.label}</div>)",
    "export const Row = React.memo(function Row() { return null; })",
    `const List = () => {
      const end = useMemo(() => items.at(-1), [items]);
      return end;
    };`,
    `const List = () => {
      const label = "use no memo";
      return useMemo(() => label, [label]);
    };`,
  ],
  outOfScope: [
    { code: "const total = useMemo(() => 1, [])", filename: testFile },
  ],
});

run("no-source-less-type-export", {
  filename: source,
  message:
    "Export local types at their definition and import external types from their defining module.",
  valid: [
    'export type { Model } from "./model"',
    'export { type Model } from "./model"',
    "export type Model = { readonly id: string }",
    "export type {}",
    "export { value }",
  ],
  invalid: [
    'import type { Model } from "./model"\nexport type { Model }',
    'import { type Model, value } from "./model"\nexport type { Model }',
    'import type { Model } from "./model"\nexport { type Model }',
  ],
  outOfScope: [
    {
      code: 'import type { Model } from "./model"\nexport type { Model }',
      filename: `${widget}src/index.package.ts`,
    },
  ],
});

run("no-tonumber-outside-representation", {
  filename: source,
  message:
    "Convert exact values to number only in representation or chart adapters.",
  valid: [
    "const formatted = formatUsd(amount)",
    "const chart = item.tvl.toFixed()",
  ],
  invalid: [
    "const value = amount.toNumber()",
    "function ltv() { return totals.ltv.toNumber() }",
  ],
  outOfScope: [
    {
      code: "const value = amount.toNumber()",
      filename: `${widget}src/shared/lib/formatters.ts`,
    },
    { code: "const value = amount.toNumber()", filename: testFile },
  ],
});

run("no-unbranded-domain-identifier", {
  filename: `${widget}src/domain/earn/yield.ts`,
  message:
    "Use a brand (`Schema.NonEmptyString.pipe(Schema.brand(...))`) or a literal union for identifier-like domain fields, not an unbranded string schema.",
  valid: [
    "const Model = Schema.Struct({ yieldId: YieldId })",
    "const Model = Schema.Struct({ address: TokenAddress, network: Network })",
    'const Model = Schema.Struct({ id: Schema.NonEmptyString.pipe(Schema.brand("ModelId")) })',
    "const Model = Schema.Struct({ ownerAddress: Schema.optional(WalletAddress) })",
    'const Model = Schema.Struct({ network: Schema.Literals(["ethereum", "solana"]) })',
    "const Model = Schema.Struct({ name: Schema.String, symbol: Schema.NonEmptyString })",
    "const Model = Schema.Struct({ description: Schema.optional(Schema.String) })",
    "const Model = Schema.Struct({ keyboard: Schema.String, identity: Schema.String })",
  ],
  invalid: [
    "const Model = Schema.Struct({ yieldId: Schema.String })",
    "const Model = Schema.Struct({ id: Schema.NonEmptyString })",
    "const Model = Schema.Struct({ address: Schema.String })",
    "const Model = Schema.Struct({ ownerAddress: Schema.NonEmptyString })",
    "const Model = Schema.Struct({ transactionHash: Schema.String })",
    "const Model = Schema.Struct({ hash: Schema.optional(Schema.String) })",
    "const Model = Schema.Struct({ network: Schema.String })",
    "const Model = Schema.Struct({ balanceKey: Schema.NullOr(Schema.String) })",
    'const Model = Schema.Struct({ "validatorAddress": Schema.optionalKey(Schema.NonEmptyString) })',
  ],
  outOfScope: [
    {
      code: "const Model = Schema.Struct({ yieldId: Schema.String })",
      filename: `${widget}src/services/api/yield.ts`,
    },
  ],
});

const moduleInterface = `${widget}src/features/earn/index.ts`;

for (const filename of [
  moduleInterface,
  `${widget}src/domain/wallet/contract.ts`,
  `${widget}src/ui/index.ts`,
  `${widget}src/ui/composition.ts`,
]) {
  run("no-wildcard-module-interface-export", {
    filename,
    message: "Module interfaces must use explicit named exports.",
    valid: [
      'export { Model } from "./model"',
      'export type { Model } from "./model"',
      'export { type Model } from "./model"',
      "export const supportedNetworks = networks",
    ],
    invalid: [
      'export * from "./model"',
      'export * as Model from "./model"',
      'export type * from "./model"',
      'export type * as Model from "./model"',
    ],
    outOfScope: [
      {
        code: 'export * from "./model"',
        filename: `${widget}src/features/earn/state/index.ts`,
      },
    ],
  });
}

run("no-barrel-file", {
  filename: source,
  message:
    "Barrel re-exports are reserved for Module interfaces; import from the defining module.",
  valid: [
    'export type { Model } from "./model"',
    'export { type Model, type Row } from "./model"',
    'export type * from "./model"',
    'export type * as Model from "./model"',
    "export { value }",
    "export const value = 1",
  ],
  invalid: [
    'export * from "./model"',
    'export * as Model from "./model"',
    'export { value } from "./model"',
    'export { type Model, value } from "./model"',
    'export { default } from "./model"',
  ],
  outOfScope: [
    moduleInterface,
    `${widget}src/features/borrow/supply/views.ts`,
    `${widget}src/domain/earn/contract.ts`,
    `${widget}src/public-api/index.bundle.ts`,
    `${widget}src/index.package.ts`,
    `${widget}src/services/api/operations.ts`,
    `${widget}src/resources/yields/index.ts`,
    `${widget}src/ui/index.ts`,
    `${widget}src/ui/composition.ts`,
    testFile,
  ].map((filename) => ({ code: 'export * from "./model"', filename })),
});

run("no-blanket-disable", {
  filename: testFile,
  message: "Suppress named rules and give the reason after `--`.",
  valid: [
    "// oxlint-disable-next-line widget/no-manual-memo -- list virtualizer reads refs\nx()",
    "/* oxlint-disable typescript/no-explicit-any, no-console -- generated shim */",
    "// eslint-disable-line no-console -- debug output",
    "// oxlint-enable",
    "// see the oxlint-disable docs",
    "// oxlint-disable-nextline",
  ],
  invalid: [
    "// oxlint-disable-next-line\nx()",
    "// oxlint-disable-next-line -- reason only\nx()",
    "// oxlint-disable-next-line no-console\nx()",
    "// oxlint-disable-next-line no-console --\nx()",
    "/* oxlint-disable */",
    "x() // oxlint-disable-line",
    "// eslint-disable no-console",
    "{/* eslint-disable-next-line */}",
  ],
  outOfScope: [{ code: "/* oxlint-disable */", filename: generated }],
});

tester.run(
  "no-blanket-disable in .storybook",
  plugin.rules["no-blanket-disable"],
  {
    valid: [],
    invalid: [
      {
        code: "/* oxlint-disable */",
        filename: `${widget}.storybook/preview.tsx`,
        errors: [
          { message: "Suppress named rules and give the reason after `--`." },
        ],
      },
    ],
  }
);
