import { Option, Schema, SchemaTransformation } from "effect";

type ThemeContractNode = string | ThemeContractObject;

interface ThemeContractObject {
  readonly [key: string]: ThemeContractNode;
}

export const themeContract = {
  color: {
    white: "",
    transparent: "",
    primary: "",
    accent: "",
    disabled: "",
    text: "",
    textMuted: "",
    textDanger: "",
    background: "",
    backgroundMuted: "",
    tokenSelectBackground: "",
    tokenSelectHoverBackground: "",
    tokenSelectBorder: "",
    tokenSelect: "",
    skeletonLoaderBase: "",
    skeletonLoaderHighlight: "",
    tabBorder: "",
    stakeSectionBackground: "",
    dropdownBackground: "",
    selectValidatorMultiSelectedBackground: "",
    selectValidatorMultiDefaultBackground: "",
    warningBoxBackground: "",
    errorBoxBackground: "",
    positionsClaimRewardsBackground: "",
    positionsActionRequiredBackground: "",
    positionsPendingBackground: "",
    positionsRewardRate: "",
    modalOverlayBackground: "",
    modalBodyBackground: "",
    tooltipBackground: "",
    primaryButtonColor: "",
    primaryButtonBackground: "",
    secondaryButtonColor: "",
    secondaryButtonBackground: "",
    smallButtonColor: "",
    smallButtonBackground: "",
    smallLightButtonColor: "",
    smallLightButtonBackground: "",
    disabledButtonColor: "",
    disabledButtonBackground: "",
    dashboardDetailsSectionBackground: "",
    summaryItemBackground: "",
    summaryLabelStakedBackground: "",
    summaryLabelStakedColor: "",
    summaryLabelApyBackground: "",
    summaryLabelApyColor: "",
    summaryLabelAvailableBackground: "",
    summaryLabelAvailableColor: "",
    connectKit: {
      accentColor: "",
      accentColorForeground: "",
      actionButtonBorder: "",
      actionButtonBorderMobile: "",
      actionButtonSecondaryBackground: "",
      closeButton: "",
      closeButtonBackground: "",
      connectButtonBackground: "",
      connectButtonBackgroundError: "",
      connectButtonInnerBackground: "",
      connectButtonText: "",
      connectButtonTextError: "",
      connectionIndicator: "",
      downloadBottomCardBackground: "",
      downloadTopCardBackground: "",
      error: "",
      generalBorder: "",
      generalBorderDim: "",
      menuItemBackground: "",
      modalBackdrop: "",
      modalBackground: "",
      modalBorder: "",
      modalText: "",
      modalTextDim: "",
      modalTextSecondary: "",
      profileAction: "",
      profileActionHover: "",
      profileForeground: "",
      selectedOptionBorder: "",
      standby: "",
    },
  },
  fontSize: {
    xs: "",
    sm: "",
    md: "",
    lg: "",
    lgx: "",
    xl: "",
    "2xl": "",
    "3xl": "",
    "4xl": "",
    "5xl": "",
    "6xl": "",
  },
  letterSpacing: {
    tighter: "",
    tight: "",
    normal: "",
    wide: "",
    wider: "",
    widest: "",
  },
  lineHeight: {
    none: "",
    shorter: "",
    short: "",
    base: "",
    tall: "",
    taller: "",
    xs: "",
    sm: "",
    md: "",
    lg: "",
    xl: "",
    "2xl": "",
    "3xl": "",
    "4xl": "",
    "5xl": "",
    "6xl": "",
  },
  fontWeight: {
    normal: "",
    medium: "",
    semibold: "",
    bold: "",
    extrabold: "",
    modalHeading: "",
    tokenSelect: "",
    primaryButton: "",
    secondaryButton: "",
  },
  borderRadius: {
    baseContract: {
      none: "",
      sm: "",
      base: "",
      md: "",
      lg: "",
      xl: "",
      "2xl": "",
      "3xl": "",
      full: "",
      half: "",
      widgetBorderRadius: "",
      primaryButton: "",
      secondaryButton: "",
      smallButton: "",
    },
    connectKit: {
      actionButton: "",
      connectButton: "",
      menuButton: "",
      modal: "",
      modalMobile: "",
    },
  },
  space: {
    full: "",
    unset: "",
    auto: "",
    "0": "",
    "1": "",
    "2": "",
    "3": "",
    "4": "",
    "5": "",
    "6": "",
    "7": "",
    "8": "",
    "9": "",
    "10": "",
    "12": "",
    "14": "",
    "16": "",
    "20": "",
    "24": "",
    "28": "",
    "32": "",
    "36": "",
    "40": "",
    "44": "",
    "48": "",
    px: "",
    buttonMinHeight: "",
  },
  heading: {
    h1: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
    h2: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
    h3: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
    h4: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
  },
  text: {
    large: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
    medium: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
    small: {
      mobile: { fontSize: "" },
      tablet: { fontSize: "" },
    },
  },
  zIndices: {
    hide: "",
    auto: "",
    simple: "",
    base: "",
    docked: "",
    dropdown: "",
    sticky: "",
    banner: "",
    overlay: "",
    modal: "",
    skipLink: "",
  },
  font: {
    body: "",
  },
} satisfies Readonly<Record<string, ThemeContractNode>>;

type CompleteThemeNode<Node> = Node extends string
  ? string
  : {
      readonly [Key in keyof Node]: CompleteThemeNode<Node[Key]>;
    };

type PartialThemeNode<Node> = Node extends string
  ? string
  : {
      readonly [Key in keyof Node]?: PartialThemeNode<Node[Key]>;
    };

export type CompleteTheme = CompleteThemeNode<typeof themeContract>;
export type SKTheme = PartialThemeNode<typeof themeContract>;

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

export type ThemeDecodeResult = Readonly<{
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
