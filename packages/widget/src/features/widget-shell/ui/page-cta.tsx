import type { PropsWithChildren, ReactNode } from "react";

import { Button, Skeleton, Stack } from "../../../ui/index";

export type PageCta = {
  disabled: boolean;
  hide?: boolean;
  isLoading: boolean;
  /**
   * The page is still loading what the action needs: a neutral stand-in the
   * action's size takes its place, so the first load never flashes an
   * accent spinner that turns grey once the action is known.
   */
  standIn?: boolean;
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

const PageCtaAction = ({
  cta,
  fallbackVariant,
}: {
  readonly cta: NonNullable<PageCta>;
  readonly fallbackVariant: "primary" | "secondary";
}) => {
  const variant = cta.variant ?? fallbackVariant;

  if (cta.standIn === true) return <Skeleton shape="rect" height="cta" />;

  return (
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
  );
};

/**
 * A page's call-to-action at the foot of the page, with an optional second
 * action under it, such as Done under View position, and a notice over it
 * that the action answers, such as a warning to confirm anyway.
 */
export const PageCtaButton = ({
  cta,
  secondary = null,
  notice,
}: {
  readonly cta: PageCta;
  readonly secondary?: PageCta;
  readonly notice?: ReactNode;
}) => {
  const primary = cta && !cta.hide ? cta : null;
  const second = secondary && !secondary.hide ? secondary : null;
  if (!primary && !second) return null;

  return (
    <PageCtaSlot>
      <Stack gap={12}>
        {notice}
        <Stack gap={8}>
          {primary && <PageCtaAction cta={primary} fallbackVariant="primary" />}
          {second && <PageCtaAction cta={second} fallbackVariant="secondary" />}
        </Stack>
      </Stack>
    </PageCtaSlot>
  );
};
