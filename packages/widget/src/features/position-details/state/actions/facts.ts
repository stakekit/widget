import * as Atom from "effect/reactivity/Atom";

import { walletConnectionStateAtom } from "../../../wallet/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../yield-summary/index";
import type { PositionDetailsWorkflowKey } from "../workflow";
import { positionDetailsWorkflowViewAtom } from "../workflow-view";

export const positionDetailsFlowFactsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const workflow = get(positionDetailsWorkflowViewAtom(key));
      const integration = workflow.integrationData;
      const wallet = get(walletConnectionStateAtom);
      const providers = get(
        yieldSummaryAtom(
          new YieldSummaryKey({
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
      const receiveToken = workflow.exitReceiveTokenSelection?.selected ?? null;
      const stakedOrLiquidBalances = workflow.stakedOrLiquidBalances;
      const token = workflow.unstakeToken;

      return {
        amount: workflow.unstakeAmount,
        amountValid: workflow.unstakeAmountValid,
        /** The exit the connected wallet would submit, once it has one. */
        exit:
          wallet.status === "connected" &&
          integration &&
          stakedOrLiquidBalances &&
          token
            ? {
                additionalAddresses: wallet.additionalAddresses,
                address: wallet.address,
                amount: workflow.unstakeAmount,
                integration,
                receiveToken,
                stakedOrLiquidBalances,
                token,
                useMaxAmount:
                  workflow.unstakeUseMaxAmount ||
                  workflow.unstakeForceMaxAmount,
              }
            : null,
        integration,
        kycBlocking: kyc.isBlocking,
        positionBalancesByType: workflow.positionBalancesByType,
        providers: providers ?? [],
        receiveToken,
        stakedOrLiquidBalances,
        token,
        wallet,
        workflow,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsFlowFactsAtom"))
);
