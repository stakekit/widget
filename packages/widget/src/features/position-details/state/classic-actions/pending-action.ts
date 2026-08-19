import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import type { PendingAction } from "../../../../domain/action/models";
import type {
  EarnBalance,
  EarnValidator,
} from "../../../../domain/earn/models";
import { walletScopeOwnerKey } from "../../../../domain/wallet/wallet-scope";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { startClassicTransactionFlowAtom } from "../../../classic-transaction-flow/index";
import {
  closedPendingActionModalState,
  closePendingActionModal,
  makeAutomaticPendingActionModalState,
  makePendingActionModalStore,
  openPendingActionModal,
  type PendingActionModalState,
  type PendingActionModalStore,
  type PendingActionSubmissionReceipt,
  type PendingActionTelemetry,
  type PositionPendingActionCommand,
  pendingActionNeedsValidatorSelection,
  reconcilePendingActionModalReceipt,
  resolvePositionPendingActionDecision,
  togglePendingActionValidator,
} from "../../model/classic-flow-actions";
import type { PositionDetailsWorkflowKey } from "../workflow";
import { positionDetailsFlowFactsAtom } from "./facts";

class PendingActionModalKey extends Data.Class<{
  readonly balanceId: string | null;
  readonly integrationId: string | null;
  readonly owner: ReturnType<typeof walletScopeOwnerKey>;
  readonly pendingActionType: PositionDetailsWorkflowKey["pendingActionType"];
}> {}

const getPendingActionModalKey = (key: PositionDetailsWorkflowKey) =>
  new PendingActionModalKey({
    balanceId: key.balanceId,
    integrationId: key.integrationId,
    owner: walletScopeOwnerKey(key.scope),
    pendingActionType: key.pendingActionType,
  });

const pendingActionModalStoreAtom = Atom.family((_key: PendingActionModalKey) =>
  Atom.make<PendingActionModalStore>(makePendingActionModalStore()).pipe(
    Atom.withLabel("positionDetailsPendingActionModalStoreAtom")
  )
);

type ReadAtom = <A>(atom: Atom.Atom<A>) => A;

const getAutomaticPendingActionModalState = (
  get: ReadAtom,
  key: PositionDetailsWorkflowKey
): PendingActionModalState => {
  if (!key.pendingActionType) return closedPendingActionModalState;

  const positionBalancesByType = get(
    positionDetailsFlowFactsAtom(key)
  ).positionBalancesByType;
  const pendingAction = positionBalancesByType
    ? [...positionBalancesByType.values()]
        .flat()
        .flatMap((balance) =>
          balance.pendingActions.map((pendingAction) => ({
            pendingAction,
            yieldBalance: balance,
          }))
        )
        .find(
          (candidate) =>
            candidate.pendingAction.type === key.pendingActionType &&
            pendingActionNeedsValidatorSelection(candidate.pendingAction)
        )
    : null;
  return pendingAction
    ? makeAutomaticPendingActionModalState(pendingAction)
    : closedPendingActionModalState;
};

const getPendingActionSubmissionReceipt = (
  get: ReadAtom,
  key: PositionDetailsWorkflowKey
): PendingActionSubmissionReceipt | null =>
  get(runPositionPendingActionAtom(key)).pipe(
    AsyncResult.value,
    Option.flatMap((outcome) =>
      outcome._tag === "Started" && outcome.attemptId
        ? Option.some({
            _tag: "Started" as const,
            attemptId: outcome.attemptId,
          })
        : Option.none()
    ),
    Option.getOrNull
  );

const pendingActionModalCandidateAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const store = get(
        pendingActionModalStoreAtom(getPendingActionModalKey(key))
      );
      return store.explicit
        ? store.state
        : getAutomaticPendingActionModalState(get, key);
    }).pipe(Atom.withLabel("positionDetailsPendingActionModalCandidateAtom"))
);

const positionPendingActionModalViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const store = get(
        pendingActionModalStoreAtom(getPendingActionModalKey(key))
      );
      const state = get(pendingActionModalCandidateAtom(key));
      return reconcilePendingActionModalReceipt({
        receipt: getPendingActionSubmissionReceipt(get, key),
        store: { ...store, state },
      }).state;
    }).pipe(Atom.withLabel("positionPendingActionModalViewAtom"))
);

const closePositionPendingActionModalAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((_input: undefined, context) =>
      context.set(
        pendingActionModalStoreAtom(getPendingActionModalKey(key)),
        closePendingActionModal(
          context(pendingActionModalStoreAtom(getPendingActionModalKey(key)))
        )
      )
    )
);

const openPositionPendingActionModalAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (
        input: {
          readonly pendingAction: PendingAction;
          readonly yieldBalance: EarnBalance;
        },
        context
      ) => {
        const storeAtom = pendingActionModalStoreAtom(
          getPendingActionModalKey(key)
        );
        context.set(
          storeAtom,
          openPendingActionModal({ input, store: context(storeAtom) })
        );
      }
    )
);

const togglePositionPendingActionValidatorAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((validator: EarnValidator["address"], context) => {
      const storeAtom = pendingActionModalStoreAtom(
        getPendingActionModalKey(key)
      );
      const store = context(storeAtom);
      const state = context(pendingActionModalCandidateAtom(key));
      context.set(
        storeAtom,
        togglePendingActionValidator({
          store: { ...store, explicit: true, state },
          validator,
        })
      );
    })
);

type PositionPendingActionOutcome =
  | Readonly<{ readonly _tag: "Opened" }>
  | Readonly<{
      readonly _tag: "Rejected";
      readonly attemptId: PendingActionSubmissionReceipt["attemptId"] | null;
      readonly reason: "RejectedOwner";
    }>
  | Readonly<{
      readonly _tag: "Started";
      readonly attemptId: PendingActionSubmissionReceipt["attemptId"] | null;
    }>
  | Readonly<{ readonly _tag: "Unavailable" }>;

const trackPendingAction = (telemetry: PendingActionTelemetry) =>
  TrackingService.use((tracking) => {
    switch (telemetry._tag) {
      case "PendingActionClicked":
        return tracking.trackEvent("pendingActionClicked", {
          type: telemetry.pendingActionType,
          yieldId: telemetry.yieldId,
        });
      case "ValidatorsSubmitted":
        return tracking.trackEvent("validatorsSubmitted", {
          type: telemetry.pendingActionType,
          validators: telemetry.validators,
          yieldId: telemetry.yieldId,
        });
    }
  });

const runPositionPendingActionAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn((command: PositionPendingActionCommand, context) => {
        const facts = context(positionDetailsFlowFactsAtom(key));
        const modal = context(pendingActionModalCandidateAtom(key));
        const decision = resolvePositionPendingActionDecision({
          canMount: Boolean(key.integrationId && key.balanceId),
          command,
          integration: facts.integration,
          modal,
          pendingActionsState: facts.workflow.pendingActions,
          wallet:
            facts.wallet.status === "connected"
              ? {
                  additionalAddresses: facts.wallet.additionalAddresses,
                  address: facts.wallet.address,
                }
              : null,
        });
        const tracking =
          "telemetry" in decision && decision.telemetry
            ? trackPendingAction(decision.telemetry)
            : Effect.void;

        if (decision._tag === "Open") {
          const storeAtom = pendingActionModalStoreAtom(
            getPendingActionModalKey(key)
          );
          context.set(
            storeAtom,
            openPendingActionModal({
              input: decision.input,
              store: context(storeAtom),
            })
          );
          return tracking.pipe(
            Effect.as<PositionPendingActionOutcome>({ _tag: "Opened" })
          );
        }

        if (decision._tag === "Unavailable") {
          return tracking.pipe(
            Effect.as<PositionPendingActionOutcome>({ _tag: "Unavailable" })
          );
        }
        if (!key.integrationId || !key.balanceId) {
          return tracking.pipe(
            Effect.as<PositionPendingActionOutcome>({ _tag: "Unavailable" })
          );
        }

        const value = decision.prepared;
        const start = context
          .setResult(startClassicTransactionFlowAtom, {
            intake: {
              _tag: "Manage",
              gasFeeToken: value.gasFeeToken,
              integration: value.integrationData,
              interactedToken: decision.selection.yieldBalance.token,
              pendingActionType: decision.selection.pendingAction.type,
              providersDetails: facts.providers,
              request: value.command,
              walletScope: key.scope,
            },
            mount: {
              _tag: "PositionManage",
              balanceId: key.balanceId,
              integrationId: key.integrationId,
            },
          })
          .pipe(
            Effect.map(
              (outcome): PositionPendingActionOutcome =>
                outcome._tag === "Started"
                  ? { _tag: "Started", attemptId: decision.attemptId }
                  : {
                      _tag: "Rejected",
                      attemptId: decision.attemptId,
                      reason: outcome._tag,
                    }
            )
          );
        const bestEffortTracking = Effect.exit(tracking).pipe(
          Effect.andThen(Effect.never)
        );
        return Effect.raceFirst(start, bestEffortTracking);
      })
      .pipe(Atom.withLabel("runPositionPendingActionAtom"))
);

export const positionDetailsPendingActions = {
  closeModal: closePositionPendingActionModalAtom,
  modalView: positionPendingActionModalViewAtom,
  openModal: openPositionPendingActionModalAtom,
  run: runPositionPendingActionAtom,
  toggleValidator: togglePositionPendingActionValidatorAtom,
} as const;
