import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { getYieldFlowExitCompletion } from "../../../model/yield-transaction-flow";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const UnstakeCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const exitFlow = useYieldFlowIntake("Exit");
  const integrationData = exitFlow.integration;
  const completion = getYieldFlowExitCompletion(exitFlow);
  const amount = formatTokenAmount(completion.amount, locale, "down");

  useTrackPage("unstakeComplete");

  return (
    <CompletePage
      amount={amount}
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
      receiveToken={completion.receiveToken}
      token={completion.token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
