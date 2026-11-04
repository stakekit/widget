import type { PropsWithChildren } from "react";
import { Button, Stack } from "../../../ui/index";

export type PageCta = {
  disabled: boolean;
  hide?: boolean;
  isLoading: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
} | null;

/** Places a page's call-to-action at the foot of the page. */
export const PageCtaSlot = ({ children }: PropsWithChildren) => (
  <Stack grow justify="end">
    {children}
  </Stack>
);

export const PageCtaButton = ({ cta }: { readonly cta: PageCta }) => {
  if (!cta || cta.hide) return null;
  const variant = cta.variant ?? "primary";

  return (
    <PageCtaSlot>
      <Button
        hostHook={`footer-button-${variant}`}
        disabled={cta.disabled}
        loading={cta.isLoading}
        onClick={cta.onClick}
        size="cta"
        variant={variant}
      >
        {cta.label}
      </Button>
    </PageCtaSlot>
  );
};
