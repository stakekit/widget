import { getPendingActionLabelContext } from "../../../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../../../domain/earn/confidential";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { CompletePage } from "./common.page.tsx";

export const PendingCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const manageFlow = useYieldFlowIntake("Manage");
  const integrationData = manageFlow.integration;
  const rawAmount = manageFlow.request.arguments?.amount;
  // An entered amount is in the balance's Value Token; without one a cancel
  // shows what it returns.
  const returned = rawAmount ? null : (manageFlow.cancelReturn ?? null);
  const token = returned?.token ?? manageFlow.interactedToken;

  useTrackPage("pendingActionCompelete");
  // An encrypted balance's amount is unknown, not zero.
  const getAmount = () => {
    if (manageFlow.balanceHidden) return null;
    if (rawAmount) return exactDecimal(rawAmount);
    return returned?.amount ?? null;
  };
  const amount = getAmount();

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
