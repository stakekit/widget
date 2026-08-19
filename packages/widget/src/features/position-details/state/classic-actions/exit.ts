import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import type { TokenAddress } from "../../../../domain/identity/identifiers";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { startClassicTransactionFlowAtom } from "../../../classic-transaction-flow/index";
import { resolvePositionDetailsExitSubmission } from "../../model/classic-flow-actions";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "../classic-view";
import type { PositionDetailsWorkflowKey } from "../workflow";
import { positionDetailsFlowFactsAtom } from "./facts";

const exitSubmittedAtom = Atom.family((_key: PositionDetailsWorkflowKey) =>
  Atom.make(false).pipe(Atom.withLabel("positionDetailsExitSubmittedAtom"))
);

const positionDetailsExitActionViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => ({
      submissionError:
        get(exitSubmittedAtom(key)) &&
        !get(positionDetailsFlowFactsAtom(key)).amountValid,
    })).pipe(Atom.withLabel("positionDetailsExitActionViewAtom"))
);

type PositionDetailsExitOutcome =
  | Readonly<{ readonly _tag: "Invalid" }>
  | Readonly<{ readonly _tag: "Started" }>
  | Readonly<{ readonly _tag: "Rejected"; readonly reason: "RejectedOwner" }>;

const submitPositionDetailsExitAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn((_input: undefined, context) => {
        const facts = context(positionDetailsFlowFactsAtom(key));
        const exitFacts =
          facts.wallet.status === "connected" &&
          facts.integration &&
          facts.stakedOrLiquidBalances
            ? {
                additionalAddresses: facts.wallet.additionalAddresses,
                address: facts.wallet.address,
                amount: facts.amount,
                integration: facts.integration,
                receiveToken: facts.receiveToken,
                stakedOrLiquidBalances: facts.stakedOrLiquidBalances,
                useMaxAmount:
                  facts.workflow.unstakeUseMaxAmount ||
                  facts.workflow.unstakeForceMaxAmount,
              }
            : null;
        const decision = resolvePositionDetailsExitSubmission({
          amountValid: facts.amountValid,
          canMount: Boolean(key.integrationId && key.balanceId),
          facts: exitFacts,
          kycBlocking: facts.kycBlocking,
          token: facts.token,
        });
        if (decision._tag === "Invalid") {
          context.set(exitSubmittedAtom(key), true);
          return Effect.succeed<PositionDetailsExitOutcome>({
            _tag: "Invalid",
          });
        }
        if (!facts.integration || !key.integrationId || !key.balanceId) {
          return Effect.succeed<PositionDetailsExitOutcome>({
            _tag: "Invalid",
          });
        }

        return context
          .setResult(startClassicTransactionFlowAtom, {
            intake: {
              _tag: "Exit",
              gasFeeToken: decision.prepared.gasFeeToken,
              integration: facts.integration,
              providersDetails: facts.providers,
              receiveToken: facts.receiveToken,
              request: decision.prepared.request,
              unstakeAmount: facts.amount,
              unstakeToken: decision.token,
              walletScope: key.scope,
            },
            mount: {
              _tag: "PositionExit",
              balanceId: key.balanceId,
              integrationId: key.integrationId,
            },
          })
          .pipe(
            Effect.map(
              (outcome): PositionDetailsExitOutcome =>
                outcome._tag === "Started"
                  ? { _tag: "Started" }
                  : { _tag: "Rejected", reason: outcome._tag }
            )
          );
      })
      .pipe(Atom.withLabel("submitPositionDetailsExitAtom"))
);

const setPositionDetailsExitReceiveTokenAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((address: TokenAddress, context) =>
      context.set(dispatchPositionDetailsWorkflowAtom(key), {
        type: "unstake/receive-token/change",
        data: address,
      })
    )
);

const setPositionDetailsExitMaxAmountAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn((_input: undefined, context) => {
        const integration = context(
          positionDetailsWorkflowViewAtom(key)
        ).integrationData;
        if (!integration) return Effect.void;

        context.set(dispatchPositionDetailsWorkflowAtom(key), {
          type: "unstake/amount/max",
        });
        return TrackingService.use((tracking) =>
          tracking.trackEvent("positionDetailsPageMaxClicked", {
            yieldId: integration.id,
          })
        );
      })
      .pipe(Atom.withLabel("setPositionDetailsExitMaxAmountAtom"))
);

export const positionDetailsExitActions = {
  setMaxAmount: setPositionDetailsExitMaxAmountAtom,
  setReceiveToken: setPositionDetailsExitReceiveTokenAtom,
  submit: submitPositionDetailsExitAtom,
  view: positionDetailsExitActionViewAtom,
} as const;
