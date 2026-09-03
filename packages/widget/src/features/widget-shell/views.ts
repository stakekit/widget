// Shell views other features render inside: page framing, the shell's back
// button and CTA footer, and the shell layout styles. Kept separate from
// `composition.ts` so consumers do not pull the shell page graph. Generic UI kit
// components live in `shared/ui/components` and are imported directly.

export { headerContainer } from "./classic-layout/styles.css";
export {
  BackButton,
  BackButtonProvider,
} from "./dashboard/components/back-button";
export { SplitView } from "./dashboard/components/split-view";
export {
  outletWrapper as dashboardOutletWrapper,
  wrapper as dashboardWrapper,
} from "./dashboard/components/styles.css";
export { AnimationPage } from "./ui/animation-page";
export { FallbackContent } from "./ui/fallback-content";
export { container } from "./ui/layout.css";
export { PageContainer } from "./ui/page-container";
export type { PageCta } from "./ui/page-cta";
export { PageCtaButton } from "./ui/page-cta";
export { default as UnderMaintenance } from "./ui/under-maintenance";
