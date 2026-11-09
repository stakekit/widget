import { useTranslation } from "react-i18next";

/** A balance as `AmountPanel` shows it. */
type AmountPanelBalance = {
  readonly short: string;
  readonly full?: string;
  readonly fill?: {
    readonly label: string;
    readonly onClick: () => void;
  };
  readonly action?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
  };
};

/**
 * The entry token's balance for `AmountPanel`, with the reveal and hide
 * actions of a confidential asset: masked with "Reveal" while hidden, and
 * with "Hide" once revealed. `balance` is the known balance, if any.
 */
export const useConfidentialTokenBalance = ({
  balance,
  hidden,
  onHide,
  onReveal,
  revealed,
  revealStatus,
  symbol,
}: {
  readonly balance: Omit<AmountPanelBalance, "action"> | null;
  readonly hidden: boolean;
  readonly onHide: () => void;
  readonly onReveal: () => void;
  readonly revealed: boolean;
  readonly revealStatus: Readonly<{ failed: boolean; revealing: boolean }>;
  readonly symbol: string;
}): AmountPanelBalance | undefined => {
  const { t } = useTranslation();

  if (hidden) {
    const getRevealLabel = () => {
      if (revealStatus.revealing) return t("shared.confidential.revealing");
      if (revealStatus.failed) return t("shared.confidential.retry");
      return t("shared.confidential.reveal_short");
    };
    return {
      short: t("shared.confidential.masked_amount", { symbol }),
      action: {
        label: getRevealLabel(),
        onClick: onReveal,
        disabled: revealStatus.revealing,
      },
    };
  }

  if (!balance) return undefined;
  if (!revealed) return balance;

  return {
    ...balance,
    action: { label: t("shared.confidential.hide_short"), onClick: onHide },
  };
};
