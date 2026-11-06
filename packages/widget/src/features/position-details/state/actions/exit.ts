import { Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { appRuntime } from "../../../../app/runtime/app-runtime";
import type { TokenAddress } from "../../../../domain/identity/identifiers";
import {
  ActionSimulationKey,
  actionSimulationResourceAtom,
} from "../../../../resources/action-simulation/index";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { widgetConfigAtom } from "../../../widget-configuration/index";
import { getNetworkFeeEstimate } from "../../../yield-entry/index";
import { startYieldTransactionFlowAtom } from "../../../yield-transaction-flow/index";
import {
  getPositionDetailsExitSimulationCommand,
  resolvePositionDetailsExitSubmission,
} from "../../model/flow-actions";
import type { PositionDetailsWorkflowKey } from "../workflow";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsPricesAtom,
  positionDetailsWorkflowViewAtom,
} from "../workflow-view";
import { positionDetailsFlowFactsAtom } from "./facts";

/**
 * The fee line under the exit amount (see `getNetworkFeeEstimate`); null,
 * with no line, when the host hides gas fees, which are then never asked
 * for, or no wallet is connected.
 */
const positionDetailsExitNetworkFeeAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const hidden = get(widgetConfigAtom).hideGasFee;
      const facts = get(positionDetailsFlowFactsAtom(key));
      const connected = facts.wallet.status === "connected";
      if (hidden || !connected) return null;
      const command = getPositionDetailsExitSimulationCommand({
        amountValid: facts.amountValid,
        facts: facts.exit,
      });
      const result = command
        ? get(
            actionSimulationResourceAtom.local(
              new ActionSimulationKey({ request: { command, intent: "exit" } })
            )
          )
        : null;
      const simulation = result
        ? result.pipe(AsyncResult.value, Option.getOrNull)
        : null;
      return getNetworkFeeEstimate({
        connected,
        hidden,
        pending:
          result !== null &&
          simulation === null &&
          !AsyncResult.isFailure(result),
        prices: get(positionDetailsPricesAtom(key)).pipe(
          AsyncResult.value,
          Option.getOrNull
        ),
        simulation,
      });
    }).pipe(Atom.withLabel("positionDetailsExitNetworkFeeAtom"))
);

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
        const decision = resolvePositionDetailsExitSubmission({
          amountValid: facts.amountValid,
          canMount: Boolean(key.integrationId && key.balanceId),
          facts: facts.exit,
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
          .setResult(startYieldTransactionFlowAtom, {
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
            Effect.map((outcome): PositionDetailsExitOutcome =>
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
  networkFee: positionDetailsExitNetworkFeeAtom,
  setMaxAmount: setPositionDetailsExitMaxAmountAtom,
  setReceiveToken: setPositionDetailsExitReceiveTokenAtom,
  submit: submitPositionDetailsExitAtom,
  view: positionDetailsExitActionViewAtom,
} as const;
