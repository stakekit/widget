import { findYieldToken } from "../../../../../domain/action/rules";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { useTrackPage } from "../../../../tracking/index";
import { getYieldFlowExitCompletion } from "../../../model/yield-transaction-flow";
import { useYieldFlowIntake } from "../../../react/yield-flow-route";
import { useExitSummary } from "../hooks/use-exit-summary.hook";
import { CompletePage } from "./common.page.tsx";

export const ExitCompletePage = () => {
  const { locale } = useWidgetPresentation();
  const exitFlow = useYieldFlowIntake("Exit");
  const integrationData = exitFlow.integration;
  const completion = getYieldFlowExitCompletion(exitFlow);
  const amount = formatTokenAmount(completion.amount, locale, "down");

  useTrackPage("unstakeComplete");

  // A cooldown holds the funds until they unlock; the user then withdraws
  // them from the position. A batched exit says when its batch runs instead.
  const { note, rows } = useExitSummary({
    amount,
    batched: completion.batched,
    receiveSymbol: completion.receiveToken?.symbol ?? null,
    symbol: completion.token.symbol,
  });
  // A payout in another token shows that token, when the yield lists it.
  const receivedToken = completion.receiveToken
    ? (findYieldToken(integrationData, completion.receiveToken.address) ?? null)
    : completion.token;

  return (
    <CompletePage
      amount={amount}
      batched={
        completion.batched
          ? { side: "redemption", yieldDto: integrationData }
          : null
      }
      integrationId={integrationData.id}
      network={completion.token.symbol}
      note={note}
      providersDetails={exitFlow.providersDetails}
      receivedToken={receivedToken}
      rows={rows}
      yieldType={getExtendedYieldType(integrationData)}
    />
  );
};
