import { Option, Schema, SchemaTransformation } from "effect";
import {
  type SKTheme,
  type ThemeContractNode,
  themeContract,
} from "../../public-api/theme";

const makeThemeSchema = (
  contract: Readonly<Record<string, ThemeContractNode>>
): Schema.Codec<unknown, unknown, never, never> => {
  const fields = Object.fromEntries(
    Object.entries(contract).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, Schema.optionalKey(Schema.String)];
      }

      return [key, Schema.optionalKey(makeThemeSchema(value))];
    })
  );

  return Schema.Struct(fields) as unknown as Schema.Codec<
    unknown,
    unknown,
    never,
    never
  >;
};

const makeResilientThemeSchema = (
  contract: Readonly<Record<string, ThemeContractNode>>
): Schema.Codec<unknown, unknown, never, never> => {
  const fields = Object.fromEntries(
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
  );

  return Schema.Struct(fields) as unknown as Schema.Codec<
    unknown,
    unknown,
    never,
    never
  >;
};

const Theme = makeThemeSchema(themeContract) as unknown as Schema.Codec<
  SKTheme,
  unknown,
  never,
  never
>;

const ResilientTheme = makeResilientThemeSchema(
  themeContract
) as unknown as Schema.Codec<SKTheme, unknown, never, never>;

export type ThemeDecodeWarning = "invalid-theme-root" | "invalid-theme-token";

type ThemeDecodeResult = Readonly<{
  theme: SKTheme | undefined;
  warnings: ReadonlyArray<ThemeDecodeWarning>;
}>;

export const decodeTheme = (input: unknown): ThemeDecodeResult => {
  const strict = Schema.decodeUnknownOption(Theme)(input);
  if (Option.isSome(strict)) {
    return { theme: strict.value, warnings: [] };
  }

  const resilient = Schema.decodeUnknownOption(ResilientTheme)(input);
  if (Option.isSome(resilient)) {
    return {
      theme: resilient.value,
      warnings: ["invalid-theme-token"],
    };
  }

  return { theme: undefined, warnings: ["invalid-theme-root"] };
};
