import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../domain/earn/yield";
import { Button } from "../../../../ui/index";
import type { PageCta } from "../../../widget-shell/views";
import { PageCtaSlot } from "../../../widget-shell/views";
import type { YieldEntryCtaBlocker } from "../../../yield-entry/index";
import { useEarnEntry } from "../../react/use-earn-facades";

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
    case "VerifyIdentity":
      return t("details.cta_blocker.verify_identity");
  }
};

/** The Earn page's call-to-action, in both Layouts and the loading skeleton. */
export const EarnPageCtaButton = ({ cta }: { readonly cta: PageCta }) => {
  if (!cta || cta.hide) return null;

  return (
    <PageCtaSlot>
      <Button
        hostHook="footer-button-primary"
        disabled={cta.disabled}
        loading={cta.isLoading}
        onClick={cta.onClick}
        size="cta"
        variant="primary"
      >
        {cta.label}
      </Button>
    </PageCtaSlot>
  );
};

export const EarnPageCta = ({
  enabled = true,
}: {
  readonly enabled?: boolean;
}) => {
  const { t } = useTranslation();
  const { runPrimaryAction, view } = useEarnEntry();
  const cta: PageCta = (() => {
    if (!enabled || view.cta._tag === "Hidden") return null;
    if (view.cta._tag === "Submit") {
      return {
        disabled: view.cta.disabled,
        isLoading: view.cta.loading || !view.selectedStake,
        label: (() => {
          if (!view.selectedStake) return "";
          if (view.cta.blocker) {
            return blockerLabel(view.cta.blocker, view.symbol, t);
          }
          return getYieldTypeLabels(view.selectedStake, t).cta;
        })(),
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

  return <EarnPageCtaButton cta={cta} />;
};
