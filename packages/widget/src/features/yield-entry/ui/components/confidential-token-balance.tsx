import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChipButton } from "../../../../shared/ui/components/chip-button";
import { Box } from "../../../../shared/ui/primitives/box";

const BalanceRow = ({ children }: { readonly children: ReactNode }) => (
  <Box
    as="span"
    display="flex"
    flexWrap="wrap"
    alignItems="center"
    justifyContent="flex-end"
    gap="2"
  >
    {children}
  </Box>
);

/**
 * Entry token balance with the reveal and hide controls of a confidential
 * asset. `children` renders the balance once it is known.
 */
export const ConfidentialTokenBalance = ({
  children,
  hidden,
  onHide,
  onReveal,
  revealed,
  revealStatus,
  symbol,
}: {
  readonly children: ReactNode;
  readonly hidden: boolean;
  readonly onHide: () => void;
  readonly onReveal: () => void;
  readonly revealed: boolean;
  readonly revealStatus: Readonly<{ failed: boolean; revealing: boolean }>;
  readonly symbol: string;
}) => {
  const { t } = useTranslation();

  if (hidden) {
    const getRevealLabel = () => {
      if (revealStatus.revealing) return t("shared.confidential.revealing");
      if (revealStatus.failed) return t("shared.confidential.retry");
      return t("shared.confidential.reveal_short");
    };
    return (
      <BalanceRow>
        <span>{t("shared.confidential.masked_amount", { symbol })}</span>
        <ChipButton
          disabled={revealStatus.revealing}
          label={getRevealLabel()}
          onClick={onReveal}
        />
      </BalanceRow>
    );
  }

  if (!revealed) return children;

  return (
    <BalanceRow>
      {children}
      <ChipButton
        label={t("shared.confidential.hide_short")}
        onClick={onHide}
      />
    </BalanceRow>
  );
};
