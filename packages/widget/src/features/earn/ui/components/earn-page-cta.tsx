import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { getYieldTypeLabels } from "../../../../domain/earn/yield";
import type { PageCta } from "../../../widget-shell/views";
import { PageCtaButton } from "../../../widget-shell/views";
import type { YieldEntryCtaBlocker } from "../../../yield-entry/index";
import { useEarnEntry, useEarnPageStatus } from "../use-earn-facades";

/** A disabled CTA says what to do next in place of the action. */
const blockerLabel = (
  blocker: YieldEntryCtaBlocker,
  symbol: string,
  t: TFunction
) => {
  switch (blocker) {
    case "AboveMaximum":
      return t("details.cta_blocker.above_maximum");
    case "BelowMinimum":
      return t("details.cta_blocker.below_minimum");
    case "EnterAmount":
      return t("details.cta_blocker.enter_amount");
    case "InsufficientBalance":
      return t("details.cta_blocker.insufficient_token", { symbol });
    case "SelectProvider":
      return t("details.cta_blocker.select_provider");
    case "SelectValidator":
      return t("details.cta_blocker.select_validator");
    case "VerifyIdentity":
      return t("details.cta_blocker.verify_identity");
    case "YieldClosed":
      return t("details.cta_blocker.yield_closed");
  }
};

/** Holds the CTA's place while the page loads what it needs: no action yet. */
export const earnLoadingCta = {
  disabled: true,
  isLoading: false,
  label: "",
  onClick: () => undefined,
  standIn: true,
} satisfies PageCta;

/**
 * The Earn page's call-to-action, in both Layouts. While the page first
 * loads, a neutral stand-in holds its place; when the page failed to load
 * there is nothing to act on, so it is left out.
 */
export const EarnPageCta = ({
  enabled = true,
}: {
  readonly enabled?: boolean;
}) => {
  const { t } = useTranslation();
  const { runPrimaryAction, view } = useEarnEntry();
  const { view: status } = useEarnPageStatus();
  const cta: PageCta = (() => {
    if (!enabled || status.isError || view.cta._tag === "Hidden") return null;
    if (view.appLoading) return earnLoadingCta;
    if (view.cta._tag === "Submit") {
      if (!view.selectedStake) return earnLoadingCta;
      return {
        disabled: view.cta.disabled,
        isLoading: view.cta.loading,
        label: view.cta.blocker
          ? blockerLabel(view.cta.blocker, view.symbol, t)
          : getYieldTypeLabels(view.selectedStake, t).cta,
        onClick: () => runPrimaryAction(undefined),
      };
    }
    return {
      disabled: view.cta.disabled,
      isLoading: view.cta.loading,
      label: t(
        view.cta._tag === "AddLedgerAccount"
          ? "init.ledger_add_account"
          : "init.connect_wallet"
      ),
      onClick: () => runPrimaryAction(undefined),
    };
  })();

  return <PageCtaButton cta={cta} />;
};
