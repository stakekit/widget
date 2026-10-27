// Shell views other features render inside: page framing, the shell's back
// button and CTA footer, and the shell layout styles. Kept separate from
// `composition.ts` so consumers do not pull the shell page graph. Generic UI kit
// components live in `shared/ui/components` and are imported directly.

export { AnimationPage } from "./ui/animation-page";
export {
  BackButton,
  BackButtonProvider,
} from "./ui/back-button";
export { headerContainer } from "./ui/compact/compact-layout/styles.css";
export {
  SplitView,
  type SplitViewSide,
} from "./ui/dashboard/split-view";
export {
  outletWrapper as dashboardOutletWrapper,
  wrapper as dashboardWrapper,
} from "./ui/dashboard/styles.css";
export { FallbackContent } from "./ui/fallback-content";
export { container } from "./ui/layout.css";
export { MountAnimatedPage } from "./ui/mount-animated-page";
export { PageContainer } from "./ui/page-container";
export type { PageCta } from "./ui/page-cta";
export { PageCtaButton } from "./ui/page-cta";
export { default as UnderMaintenance } from "./ui/under-maintenance";
