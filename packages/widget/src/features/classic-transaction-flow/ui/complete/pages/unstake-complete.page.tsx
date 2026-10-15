import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

export const UnstakeCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const exitFlow = useClassicFlowIntake("Exit");
  const integrationData = exitFlow.integration;
  const token = exitFlow.unstakeToken;

  useTrackPage("unstakeComplete");

  return (
    <CompletePage
      amount={formatTokenAmount(
        exitFlow.request.arguments?.amount ?? 0,
        locale
      )}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      providersDetails={exitFlow.providersDetails}
      token={token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
