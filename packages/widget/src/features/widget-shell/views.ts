// Shell views other features render inside: page framing and the
// call-to-action footer. Kept separate from `composition.ts` so
// consumers do not pull the shell page graph.

export { AnimationPage } from "./ui/animation-page";
export { MountAnimatedPage } from "./ui/mount-animated-page";
export { PageContainer } from "./ui/page-container";
export type { PageCta } from "./ui/page-cta";
export { PageCtaButton, PageCtaSlot } from "./ui/page-cta";
export { default as UnderMaintenance } from "./ui/under-maintenance";
