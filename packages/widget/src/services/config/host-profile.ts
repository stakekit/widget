export type WidgetVariant = "default" | "finery" | "porto" | "utila" | "zerion";

/**
 * Earn presentation. Compact is the dashboard, Utila, and Porto layout. Zerion
 * covers the Classic Earn adjustments, the positions-list presentation, the
 * stake Review meta information, and the yearly-reward label. A Zerion host
 * with the dashboard flag gets both.
 */
type EarnPresentation = Readonly<{
  compact: boolean;
  zerion: boolean;
}>;

/**
 * Named capabilities a host variant enables, resolved once from `variant` and
 * `dashboardVariant`. Features, services, and wallet adapters read these rather
 * than the variant name. The host chain modal is the `chainModal` Widget
 * Configuration field, which only Zerion hosts supply.
 */
export type HostProfile = Readonly<{
  earnPresentation: EarnPresentation;
  forcesInstitutionalWallets: boolean;
  hidesEarnLoadingSpinner: boolean;
  hidesHeaderWalletControl: boolean;
  hostTokenIconMapping: boolean;
  hostTracking: boolean;
  requiresTermsAcknowledgement: boolean;
  showsPendingApprovalsNotice: boolean;
  translationOverlay: "none" | "utila";
  /** Captured at Wallet Bootstrap as part of Wallet Topology. */
  walletCatalogue: "default" | "porto";
}>;

const standardProfile: HostProfile = {
  earnPresentation: { compact: false, zerion: false },
  forcesInstitutionalWallets: false,
  hidesEarnLoadingSpinner: false,
  hidesHeaderWalletControl: false,
  hostTokenIconMapping: false,
  hostTracking: false,
  requiresTermsAcknowledgement: false,
  showsPendingApprovalsNotice: false,
  translationOverlay: "none",
  walletCatalogue: "default",
};

const variantProfiles: Readonly<Record<WidgetVariant, HostProfile>> = {
  default: standardProfile,
  finery: { ...standardProfile, forcesInstitutionalWallets: true },
  porto: {
    ...standardProfile,
    earnPresentation: { compact: true, zerion: false },
    walletCatalogue: "porto",
  },
  utila: {
    ...standardProfile,
    earnPresentation: { compact: true, zerion: false },
    requiresTermsAcknowledgement: true,
    showsPendingApprovalsNotice: true,
    translationOverlay: "utila",
  },
  zerion: {
    ...standardProfile,
    earnPresentation: { compact: false, zerion: true },
    hidesEarnLoadingSpinner: true,
    hidesHeaderWalletControl: true,
    hostTokenIconMapping: true,
    hostTracking: true,
  },
};

export const resolveHostProfile = (
  variant: WidgetVariant,
  dashboardVariant: boolean
): HostProfile => {
  const profile = variantProfiles[variant];

  return dashboardVariant && !profile.earnPresentation.compact
    ? {
        ...profile,
        earnPresentation: { ...profile.earnPresentation, compact: true },
      }
    : profile;
};
