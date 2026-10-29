import { Option, Schema, SchemaTransformation } from "effect";
import {
  type SKTheme,
  type ThemeContractNode,
  themeContract,
} from "../../public-api/theme";

type ThemeSchema = Schema.Codec<unknown, unknown, never, never>;

const makeThemeSchema = (
  contract: Readonly<Record<string, ThemeContractNode>>
): ThemeSchema =>
  Schema.Struct(
    Object.fromEntries(
      Object.entries(contract).map(([key, value]) => [
        key,
        Schema.optionalKey(
          typeof value === "string" ? Schema.String : makeThemeSchema(value)
        ),
      ])
    )
  );

const makeResilientThemeSchema = (
  contract: Readonly<Record<string, ThemeContractNode>>
): ThemeSchema =>
  Schema.Struct(
    Object.fromEntries(
      Object.entries(contract).map(([key, value]) => {
        const target =
          typeof value === "string"
            ? Schema.String
            : makeResilientThemeSchema(value);
        const field = Schema.optionalKey(Schema.Unknown).pipe(
          Schema.decodeTo(
            Schema.optionalKey(target),
            SchemaTransformation.transformOptional({
              decode: Option.flatMap((input) =>
                Schema.decodeUnknownOption(target)(input)
              ),
              encode: (input) => input,
            })
          )
        );

        return [key, field];
      })
    )
  );

const Theme = makeThemeSchema(themeContract);

const ResilientTheme = makeResilientThemeSchema(themeContract);

// The theme schema is built from the contract `SKTheme` is derived from, so a
// value it accepts is an `SKTheme`.
const isThemeShape = Schema.is(Theme);
const isTheme = (value: unknown): value is SKTheme => isThemeShape(value);

export type ThemeDecodeWarning = "invalid-theme-root" | "invalid-theme-token";

type ThemeDecodeResult = Readonly<{
  theme: SKTheme | undefined;
  warnings: ReadonlyArray<ThemeDecodeWarning>;
}>;

export const decodeTheme = (input: unknown): ThemeDecodeResult => {
  const strict = Schema.decodeUnknownOption(Theme)(input).pipe(
    Option.filter(isTheme)
  );
  if (Option.isSome(strict)) {
    return { theme: strict.value, warnings: [] };
  }

  const resilient = Schema.decodeUnknownOption(ResilientTheme)(input).pipe(
    Option.filter(isTheme)
  );
  if (Option.isSome(resilient)) {
    return {
      theme: resilient.value,
      warnings: ["invalid-theme-token"],
    };
  }

  return { theme: undefined, warnings: ["invalid-theme-root"] };
};
