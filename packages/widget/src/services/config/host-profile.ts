export type WidgetVariant = "default" | "finery" | "porto" | "utila" | "zerion";

/**
 * Earn presentation. Condensed is the Dashboard Layout, Utila, and Porto
 * presentation. Zerion covers the Compact Layout Earn adjustments, the
 * positions-list presentation, the stake Review meta information, and the
 * yearly-reward label. A Zerion host in the Dashboard Layout gets both.
 */
type EarnPresentation = Readonly<{
  condensed: boolean;
  zerion: boolean;
}>;

/**
 * The Presentation Settings a Host Profile overrides over the Layout's
 * defaults. Application composition merges them and checks at compile time
 * that the names and values are the Design System's.
 */
type PresentationOverrides = Readonly<{
  callToActionSize?: "md" | "lg";
  gutter?: "md" | "lg";
  surfaceStyle?: "filled" | "elevated" | "outlined";
  tabsIndicator?: "underline" | "pill";
}>;

/**
 * Named capabilities a host variant enables, resolved once from `variant` and
 * the Layout. Features, services, and wallet adapters read these rather
 * than the variant name. The host chain modal is the `chainModal` Widget
 * Configuration field, which only Zerion hosts supply. The Appearance Preset
 * and Presentation Setting overrides give the host its look; only
 * application composition reads them, and the Design System owns the preset's
 * values.
 */
export type HostProfile = Readonly<{
  appearancePreset: "default" | "finery" | "porto" | "utila";
  earnPresentation: EarnPresentation;
  forcesInstitutionalWallets: boolean;
  hidesHeaderWalletControl: boolean;
  hostTokenIconMapping: boolean;
  hostTracking: boolean;
  presentation: PresentationOverrides;
  requiresTermsAcknowledgement: boolean;
  showsPendingApprovalsNotice: boolean;
  translationOverlay: "none" | "utila";
  /** Captured at Wallet Bootstrap as part of Wallet Topology. */
  walletCatalogue: "default" | "porto";
}>;

const standardProfile: HostProfile = {
  appearancePreset: "default",
  earnPresentation: { condensed: false, zerion: false },
  forcesInstitutionalWallets: false,
  hidesHeaderWalletControl: false,
  hostTokenIconMapping: false,
  hostTracking: false,
  presentation: {},
  requiresTermsAcknowledgement: false,
  showsPendingApprovalsNotice: false,
  translationOverlay: "none",
  walletCatalogue: "default",
};

/** Each variant's profile; Widget Configuration adjusts it for the Layout. */
export const variantHostProfiles: Readonly<Record<WidgetVariant, HostProfile>> =
  {
    default: standardProfile,
    finery: {
      ...standardProfile,
      appearancePreset: "finery",
      forcesInstitutionalWallets: true,
      presentation: { surfaceStyle: "elevated", tabsIndicator: "underline" },
    },
    porto: {
      ...standardProfile,
      appearancePreset: "porto",
      earnPresentation: { condensed: true, zerion: false },
      presentation: {
        callToActionSize: "md",
        surfaceStyle: "outlined",
        tabsIndicator: "pill",
      },
      walletCatalogue: "porto",
    },
    utila: {
      ...standardProfile,
      appearancePreset: "utila",
      earnPresentation: { condensed: true, zerion: false },
      presentation: {
        callToActionSize: "md",
        gutter: "md",
        surfaceStyle: "outlined",
        tabsIndicator: "underline",
      },
      requiresTermsAcknowledgement: true,
      showsPendingApprovalsNotice: true,
      translationOverlay: "utila",
    },
    zerion: {
      ...standardProfile,
      earnPresentation: { condensed: false, zerion: true },
      hidesHeaderWalletControl: true,
      hostTokenIconMapping: true,
      hostTracking: true,
    },
  };
