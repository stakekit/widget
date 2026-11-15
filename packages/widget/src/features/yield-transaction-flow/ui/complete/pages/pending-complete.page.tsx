import { getPendingActionLabelContext } from "../../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { useYieldFlowIntake } from "../../yield-flow-session";
import { CompletePage } from "./common.page.tsx";

export const PendingCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const manageFlow = useYieldFlowIntake("Manage");
  const integrationData = manageFlow.integration;
  // The action's amount, or none; an encrypted balance's is unknown, not zero.
  const token = manageFlow.amount?.token ?? manageFlow.interactedToken;

  useTrackPage("pendingActionCompelete");
  const amount = manageFlow.balanceHidden
    ? null
    : (manageFlow.amount?.amount ?? null);

  return (
    <CompletePage
      amount={amount ? formatTokenAmount(amount, locale, "down") : ""}
      integrationId={integrationData.id}
      network={token.symbol}
      pendingActionLabelContext={getPendingActionLabelContext(
        manageFlow.pendingActionType,
        manageFlow.balanceType,
        { confidential: isConfidentialYield(integrationData) }
      )}
      pendingActionType={manageFlow.pendingActionType}
      markToken={token}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
