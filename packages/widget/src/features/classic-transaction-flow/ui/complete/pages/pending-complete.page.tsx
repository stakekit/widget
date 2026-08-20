import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useTrackPage } from "../../../../tracking/index";
import { useClassicFlowIntake } from "../../../react/classic-flow-route";
import { CompletePage } from "./common.page.tsx";

export const PendingCompletePage = () => {
  const manageFlow = useClassicFlowIntake("Manage");
  const integrationData = manageFlow.integration;
  const token = manageFlow.interactedToken;

  useTrackPage("pendingActionCompelete");
  const rawAmount = manageFlow.request.arguments?.amount;

  return (
    <CompletePage
      amount={rawAmount ? defaultFormattedNumber(exactDecimal(rawAmount)) : ""}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      pendingActionType={manageFlow.pendingActionType}
      providersDetails={manageFlow.providersDetails}
      token={token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
