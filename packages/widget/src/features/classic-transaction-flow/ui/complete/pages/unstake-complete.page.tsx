import { useTranslation } from "react-i18next";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { getClassicFlowExitCompletion } from "../../../model/classic-transaction-flow";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

export const UnstakeCompletePage = () => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const exitFlow = useClassicFlowIntake("Exit");
  const integrationData = exitFlow.integration;
  const completion = getClassicFlowExitCompletion(exitFlow);
  const amount = formatTokenAmount(completion.amount, locale, "down");

  useTrackPage("unstakeComplete");

  return (
    <CompletePage
      amount={
        completion.approximate
          ? t("complete.approximate_amount", { amount })
          : amount
      }
      batched={
        completion.batched
          ? { side: "redemption", yieldDto: integrationData }
          : null
      }
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={completion.token.symbol}
      providersDetails={exitFlow.providersDetails}
      token={completion.token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
