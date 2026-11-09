import { Option, Schema } from "effect";

import type { SKAppearance, SKColorRole } from "../../public-api/appearance";
import { exhaustiveLiterals } from "./exhaustive-literals";

type Colors = NonNullable<SKAppearance["colors"]>;

const colorSchemeValues = exhaustiveLiterals<
  NonNullable<SKAppearance["colorScheme"]>
>()(["light", "dark", "system"]);
const colorSchemeKeys = exhaustiveLiterals<keyof Colors>()(["light", "dark"]);

const colorRoles = exhaustiveLiterals<SKColorRole>()([
  "background",
  "surface",
  "surfaceHover",
  "surfaceRaised",
  "border",
  "borderStrong",
  "text",
  "textMuted",
  "textSubtle",
  "accent",
  "accentHover",
  "onAccent",
  "accentSoft",
  "accentText",
  "success",
  "successSoft",
  "warning",
  "warningSoft",
  "danger",
  "dangerSoft",
  "info",
  "infoSoft",
  "focusRing",
  "scrim",
]);

/** The value groups of an Appearance besides its colors, with their keys. */
const valueGroups = {
  radius: exhaustiveLiterals<keyof NonNullable<SKAppearance["radius"]>>()([
    "badge",
    "control",
    "card",
    "overlay",
    "shell",
  ]),
  controlHeight: exhaustiveLiterals<
    keyof NonNullable<SKAppearance["controlHeight"]>
  >()(["sm", "md", "lg"]),
  font: exhaustiveLiterals<keyof NonNullable<SKAppearance["font"]>>()([
    "sans",
    "mono",
  ]),
  fontWeight: exhaustiveLiterals<
    keyof NonNullable<SKAppearance["fontWeight"]>
  >()(["regular", "medium", "semibold"]),
} as const;

export type AppearanceDecodeWarning = Readonly<{
  issue: "invalid-appearance-root" | "invalid-appearance-value";
  /** Where the dropped value sat, from `appearance`. */
  path: string;
}>;

type AppearanceDecodeResult = Readonly<{
  appearance: SKAppearance | undefined;
  warnings: ReadonlyArray<AppearanceDecodeWarning>;
}>;

const decodeRecord = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Unknown)
);
const decodeCssValue = Schema.decodeUnknownOption(Schema.NonEmptyString);
const decodeColorScheme = Schema.decodeUnknownOption(
  Schema.Literals(colorSchemeValues)
);

type Warnings = Array<AppearanceDecodeWarning>;

const invalidValue = (path: string): AppearanceDecodeWarning => ({
  issue: "invalid-appearance-value",
  path,
});

/**
 * The values under `keys` that are CSS values. Each other value, and a group
 * that is not an object, is a warning; unknown keys are ignored.
 */
const decodeValues = <Key extends string>(
  keys: ReadonlyArray<Key>,
  input: unknown,
  path: string,
  warnings: Warnings
): Partial<Record<Key, string>> | undefined => {
  if (input === undefined) return undefined;
  const record = decodeRecord(input);
  if (Option.isNone(record)) {
    warnings.push(invalidValue(path));
    return undefined;
  }

  const values: Partial<Record<Key, string>> = {};
  for (const key of keys) {
    const value = record.value[key];
    if (value === undefined) continue;
    const decoded = decodeCssValue(value);
    if (Option.isNone(decoded)) {
      warnings.push(invalidValue(`${path}.${key}`));
      continue;
    }
    values[key] = decoded.value;
  }
  return values;
};

const present = <Key extends string, Value>(
  key: Key,
  value: Value | undefined
): Partial<Record<Key, Value>> => {
  const record: Partial<Record<Key, Value>> = {};
  if (value !== undefined) record[key] = value;
  return record;
};

/**
 * Decodes a host's `appearance` value by value: an invalid value is dropped
 * with a warning and the rest still applies.
 */
export const decodeAppearance = (input: unknown): AppearanceDecodeResult => {
  const root = decodeRecord(input);
  if (Option.isNone(root)) {
    return {
      appearance: undefined,
      warnings: [{ issue: "invalid-appearance-root", path: "appearance" }],
    };
  }

  const warnings: Warnings = [];
  const { colorScheme: colorSchemeInput, colors: colorsInput } = root.value;
  const colorScheme =
    colorSchemeInput === undefined
      ? undefined
      : Option.getOrUndefined(decodeColorScheme(colorSchemeInput));
  if (colorSchemeInput !== undefined && colorScheme === undefined) {
    warnings.push(invalidValue("colorScheme"));
  }

  const colorsRecord =
    colorsInput === undefined ? undefined : decodeRecord(colorsInput);
  if (colorsRecord !== undefined && Option.isNone(colorsRecord)) {
    warnings.push(invalidValue("colors"));
  }
  const colorEntries =
    colorsRecord === undefined || Option.isNone(colorsRecord)
      ? undefined
      : colorsRecord.value;
  const colors: Colors | undefined =
    colorEntries === undefined
      ? undefined
      : Object.fromEntries(
          colorSchemeKeys.flatMap((scheme) => {
            const values = decodeValues(
              colorRoles,
              colorEntries[scheme],
              `colors.${scheme}`,
              warnings
            );
            return values === undefined ? [] : [[scheme, values]];
          })
        );

  const appearance: SKAppearance = {
    ...present("colorScheme", colorScheme),
    ...present("colors", colors),
    ...present(
      "radius",
      decodeValues(valueGroups.radius, root.value.radius, "radius", warnings)
    ),
    ...present(
      "controlHeight",
      decodeValues(
        valueGroups.controlHeight,
        root.value.controlHeight,
        "controlHeight",
        warnings
      )
    ),
    ...present(
      "font",
      decodeValues(valueGroups.font, root.value.font, "font", warnings)
    ),
    ...present(
      "fontWeight",
      decodeValues(
        valueGroups.fontWeight,
        root.value.fontWeight,
        "fontWeight",
        warnings
      )
    ),
  };

  return { appearance, warnings };
};
