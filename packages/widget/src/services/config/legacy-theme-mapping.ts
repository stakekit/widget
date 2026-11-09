import type { SKAppearance, SKColorRole } from "../../public-api/appearance";
import type { CompleteTheme, SKTheme } from "../../public-api/theme";
import { legacyThemeDefaults } from "./legacy-theme-defaults";
import type { WidgetAppearance } from "./widget-config-model";

type ColorScheme = keyof typeof legacyThemeDefaults;
type ValueGroup = "radius" | "controlHeight" | "font" | "fontWeight";
type GroupKey<Group extends ValueGroup> = keyof NonNullable<
  SKAppearance[Group]
>;

/** Where a legacy value lands in `appearance`. */
type Target =
  | readonly ["colors", SKColorRole]
  | {
      readonly [Group in ValueGroup]: readonly [Group, GroupKey<Group>];
    }[ValueGroup];

/** A legacy theme leaf's dotted path. */
type LeafPath<Node> = {
  readonly [Key in keyof Node & string]: Node[Key] extends string
    ? Key
    : `${Key}.${LeafPath<Node[Key]>}`;
}[keyof Node & string];

/**
 * Legacy leaves by dotted path, in priority order per target: when several
 * are customized, the first wins. Every other leaf no longer applies.
 */
const legacyThemeTable: ReadonlyArray<
  readonly [target: Target, sources: ReadonlyArray<LeafPath<CompleteTheme>>]
> = [
  [
    ["colors", "background"],
    [
      "color.background",
      "color.primary",
      "color.modalBodyBackground",
      "color.secondaryButtonBackground",
    ],
  ],
  [
    ["colors", "surface"],
    [
      "color.backgroundMuted",
      "color.stakeSectionBackground",
      "color.tokenSelectBackground",
      "color.summaryItemBackground",
      "color.dashboardDetailsSectionBackground",
      "color.skeletonLoaderBase",
    ],
  ],
  [
    ["colors", "surfaceHover"],
    ["color.tokenSelectHoverBackground", "color.skeletonLoaderHighlight"],
  ],
  [["colors", "surfaceRaised"], ["color.dropdownBackground"]],
  [["colors", "border"], ["color.tabBorder"]],
  [["colors", "borderStrong"], ["color.tokenSelectBorder"]],
  [
    ["colors", "text"],
    [
      "color.text",
      "color.tokenSelect",
      "color.secondaryButtonColor",
      "color.smallButtonColor",
    ],
  ],
  [["colors", "textMuted"], ["color.textMuted"]],
  [
    ["colors", "accent"],
    ["color.primaryButtonBackground", "color.accent"],
  ],
  [["colors", "onAccent"], ["color.primaryButtonColor"]],
  [["colors", "accentSoft"], ["color.smallLightButtonBackground"]],
  [["colors", "accentText"], ["color.smallLightButtonColor"]],
  [
    ["colors", "success"],
    [
      "color.statusSuccess",
      "color.positionsRewardRate",
      "color.positionsClaimRewardsBackground",
      "color.selectValidatorMultiSelectedBackground",
    ],
  ],
  [
    ["colors", "warning"],
    ["color.statusWarning", "color.positionsPendingBackground"],
  ],
  [["colors", "warningSoft"], ["color.warningBoxBackground"]],
  [
    ["colors", "danger"],
    [
      "color.textDanger",
      "color.errorBoxBackground",
      "color.positionsActionRequiredBackground",
    ],
  ],
  [["colors", "scrim"], ["color.modalOverlayBackground"]],
  [["font", "sans"], ["font.body"]],
  [["fontWeight", "regular"], ["fontWeight.normal"]],
  [["fontWeight", "medium"], ["fontWeight.medium"]],
  [["fontWeight", "semibold"], ["fontWeight.semibold"]],
  [
    ["radius", "control"],
    [
      "borderRadius.baseContract.primaryButton",
      "borderRadius.baseContract.secondaryButton",
    ],
  ],
  [["radius", "card"], ["borderRadius.baseContract.xl"]],
  [["radius", "overlay"], ["borderRadius.baseContract.2xl"]],
  [["radius", "shell"], ["borderRadius.baseContract.widgetBorderRadius"]],
  [["controlHeight", "lg"], ["space.buttonMinHeight"]],
];

/** Every string leaf of a decoded theme, by dotted path. */
const leaves = (node: unknown, path = ""): ReadonlyArray<[string, string]> => {
  if (typeof node === "string") return [[path, node]];
  if (typeof node !== "object" || node === null) return [];

  return Object.entries(node).flatMap(([key, child]) =>
    leaves(child, path === "" ? key : `${path}.${key}`)
  );
};

const defaultLeaves = {
  light: new Map(leaves(legacyThemeDefaults.light)),
  dark: new Map(leaves(legacyThemeDefaults.dark)),
};

/**
 * Dark when more leaves match the dark defaults than the light ones, among
 * the leaves where the two differ; light otherwise.
 */
const inferColorScheme = (theme: ReadonlyMap<string, string>): ColorScheme => {
  const votes = [...theme].reduce((total, [path, value]) => {
    const light = defaultLeaves.light.get(path);
    const dark = defaultLeaves.dark.get(path);
    if (light === dark) return total;
    if (value === dark) return total + 1;
    if (value === light) return total - 1;
    return total;
  }, 0);
  return votes > 0 ? "dark" : "light";
};

type LegacyThemeMapping = Readonly<{
  /** The legacy theme's scheme and customized values but colors. */
  appearance: SKAppearance;
  /** The legacy theme's customized colors, in the scheme it was inferred as. */
  colors: WidgetAppearance["legacyColors"];
  /** Customized legacy leaves that no longer apply, by dotted path. */
  droppedKeys: ReadonlyArray<string>;
}>;

type CssValues = Readonly<Record<string, string>>;

const nonEmpty = <Key extends string>(
  key: Key,
  values: CssValues
): Partial<Record<Key, CssValues>> => {
  const record: Partial<Record<Key, CssValues>> = {};
  if (Object.keys(values).length > 0) record[key] = values;
  return record;
};

/**
 * Maps a decoded legacy theme onto an Appearance. Leaves equal to the
 * inferred scheme's legacy default are dropped, so an unchanged `lightTheme`
 * or `darkTheme` gives the new default design in that scheme.
 */
export const mapLegacyTheme = (theme: SKTheme): LegacyThemeMapping => {
  const values = new Map(leaves(theme));
  const colorScheme = inferColorScheme(values);
  const defaults = defaultLeaves[colorScheme];
  const customized = new Map(
    [...values].filter(([path, value]) => defaults.get(path) !== value)
  );
  const mapped = legacyThemeTable.flatMap(([target, sources]) => {
    const source = sources.find((path) => customized.has(path));
    const value = source === undefined ? undefined : customized.get(source);
    return source === undefined || value === undefined
      ? []
      : [{ source, target, value }];
  });
  const group = (name: Target[0]): CssValues =>
    Object.fromEntries(
      mapped.flatMap(({ target, value }) =>
        target[0] === name ? [[target[1], value]] : []
      )
    );
  const applied: ReadonlySet<string> = new Set(
    mapped.map(({ source }) => source)
  );
  const colors = group("colors");

  const appearance: SKAppearance = {
    colorScheme,
    ...nonEmpty("radius", group("radius")),
    ...nonEmpty("controlHeight", group("controlHeight")),
    ...nonEmpty("font", group("font")),
    ...nonEmpty("fontWeight", group("fontWeight")),
  };

  return {
    appearance,
    colors:
      Object.keys(colors).length === 0
        ? undefined
        : { colorScheme, values: colors },
    droppedKeys: [...customized.keys()].filter((path) => !applied.has(path)),
  };
};

/**
 * The Widget's Appearance: `appearance` over a mapped legacy theme, key by
 * key, over the light scheme with no values. The legacy colors stay apart,
 * since they apply in other schemes than the host's colors do (see
 * `appearanceProperties`).
 */
export const resolveWidgetAppearance = (
  legacy: LegacyThemeMapping | undefined,
  host: SKAppearance | undefined
): WidgetAppearance => ({
  colorScheme: host?.colorScheme ?? legacy?.appearance.colorScheme ?? "light",
  colors: {
    light: { ...host?.colors?.light },
    dark: { ...host?.colors?.dark },
  },
  legacyColors: legacy?.colors,
  radius: { ...legacy?.appearance.radius, ...host?.radius },
  controlHeight: {
    ...legacy?.appearance.controlHeight,
    ...host?.controlHeight,
  },
  font: { ...legacy?.appearance.font, ...host?.font },
  fontWeight: { ...legacy?.appearance.fontWeight, ...host?.fontWeight },
});
