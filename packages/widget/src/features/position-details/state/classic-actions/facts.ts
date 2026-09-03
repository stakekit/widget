import * as Atom from "effect/unstable/reactivity/Atom";
import { walletConnectionStateAtom } from "../../../wallet/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../yield-summary/index";
import { positionDetailsWorkflowViewAtom } from "../classic-view";
import type { PositionDetailsWorkflowKey } from "../workflow";

export const positionDetailsFlowFactsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const workflow = get(positionDetailsWorkflowViewAtom(key));
      const integration = workflow.integrationData;
      const wallet = get(walletConnectionStateAtom);
      const providers = get(
        yieldSummaryAtom(
          new YieldSummaryKey({
            selectedProviderYieldId: null,
            validators:
              workflow.positionBalances?.type === "validators"
                ? workflow.positionBalances.validators
                : null,
            yield: integration,
          })
        )
      ).providers;
      const kyc = get(
        currentYieldKycGateAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: integration,
          })
        )
      );

      return {
        amount: workflow.unstakeAmount,
        amountValid: workflow.unstakeAmountValid,
        integration,
        kycBlocking: kyc.isBlocking,
        positionBalancesByType: workflow.positionBalancesByType,
        providers: providers ?? [],
        receiveToken: workflow.exitReceiveTokenSelection?.selected ?? null,
        stakedOrLiquidBalances: workflow.stakedOrLiquidBalances,
        token: workflow.unstakeToken,
        wallet,
        workflow,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsFlowFactsAtom"))
);
