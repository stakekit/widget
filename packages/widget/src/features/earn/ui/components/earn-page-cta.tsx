import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../domain/types/yields";
import type { PageCta } from "../../../widget-shell/components";
import { PageCtaButton } from "../../../widget-shell/components";
import { useEarnEntry } from "../../react/use-earn-facades";

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
        label: view.selectedStake
          ? getYieldTypeLabels(view.selectedStake, t).cta
          : "",
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
