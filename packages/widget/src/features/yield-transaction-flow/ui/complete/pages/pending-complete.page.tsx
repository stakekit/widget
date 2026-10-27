import { getPendingActionLabelContext } from "../../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const PendingCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const manageFlow = useYieldFlowIntake("Manage");
  const integrationData = manageFlow.integration;
  const token = manageFlow.cancelReturn?.token ?? manageFlow.interactedToken;

  useTrackPage("pendingActionCompelete");
  const rawAmount = manageFlow.request.arguments?.amount;
  // An encrypted balance's amount is unknown, not zero.
  const getAmount = () => {
    if (manageFlow.balanceHidden) return null;
    if (manageFlow.cancelReturn) return manageFlow.cancelReturn.amount;
    return rawAmount ? exactDecimal(rawAmount) : null;
  };
  const amount = getAmount();

  return (
    <CompletePage
      amount={amount ? formatTokenAmount(amount, locale, "down") : ""}
      integrationId={integrationData.id}
      metadata={{
        logoURI: integrationData.metadata.logoURI,
        name: integrationData.metadata.name,
        provider: integrationData.provider,
      }}
      network={token.symbol}
      pendingActionLabelContext={getPendingActionLabelContext(
        manageFlow.pendingActionType,
        manageFlow.balanceType,
        { confidential: isConfidentialYield(integrationData) }
      )}
      pendingActionType={manageFlow.pendingActionType}
      providersDetails={manageFlow.providersDetails}
      token={token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
