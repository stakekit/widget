/**
 * The `data-sk-*` attributes the Widget's own elements carry, each with the
 * values it takes (none: it is present or absent) and, when a StyleX
 * condition reads it, the marker on the element that carries it. Styles,
 * scripts and tests select by these; `design-system/known-sk-attribute`
 * checks every `data-sk-*` name and value written in source and tests
 * against this list, and `design-system/sk-attribute-marker` the marker a
 * `stylex.when` condition names. A new attribute or value joins it.
 */
export const skAttributes = {
  "data-sk-root": { values: [] },
  "data-sk-portal": { values: [] },
  "data-sk-frame": { values: [] },
  "data-sk-split": { values: [], marker: "splitMarker" },
  "data-sk-surface-style": {
    values: ["filled", "elevated", "outlined"],
    marker: "presentationMarker",
  },
  "data-sk-tabs-indicator": {
    values: ["underline", "pill", "tint"],
    marker: "presentationMarker",
  },
} as const satisfies Readonly<
  Record<
    `data-sk-${string}`,
    Readonly<{ values: ReadonlyArray<string>; marker?: string }>
  >
>;

export type SkAttribute = keyof typeof skAttributes;

/** The values `attribute` takes; `never` for one that is present or absent. */
export type SkAttributeValue<Attribute extends SkAttribute> =
  (typeof skAttributes)[Attribute]["values"][number];

/**
 * `data-sk-*` attributes as element props: a listed value, or `""` for one
 * that is present or absent.
 */
export type SkAttributeProps = {
  readonly [Attribute in SkAttribute]?: [SkAttributeValue<Attribute>] extends [
    never,
  ]
    ? ""
    : SkAttributeValue<Attribute>;
};

/**
 * The selector for elements carrying `attribute`, or carrying it with
 * `value`, for scripts and tests. StyleX conditions write theirs as literals,
 * which the compiler reads in place.
 */
export const skSelector = <Attribute extends SkAttribute>(
  attribute: Attribute,
  value?: SkAttributeValue<Attribute>
): string =>
  value === undefined ? `[${attribute}]` : `[${attribute}="${value}"]`;
