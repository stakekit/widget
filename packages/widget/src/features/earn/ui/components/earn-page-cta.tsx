import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../domain/earn/yield";
import { Button } from "../../../../ui/index";
import type { PageCta } from "../../../widget-shell/views";
import { PageCtaSlot } from "../../../widget-shell/views";
import { useEarnEntry } from "../../react/use-earn-facades";

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

  return <EarnPageCtaButton cta={cta} />;
};
