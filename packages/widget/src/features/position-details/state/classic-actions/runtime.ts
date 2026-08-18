import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import type { PendingAction } from "../../../../domain/action/models";
import type {
  EarnBalance,
  EarnValidator,
} from "../../../../domain/earn/models";
import type { TokenAddress } from "../../../../domain/identity/identifiers";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { walletScopeOwnerKey } from "../../../../services/wallet/wallet-scope";
import { startClassicTransactionFlowAtom } from "../../../classic-transaction-flow/index";
import { walletConnectionStateAtom } from "../../../wallet/index";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  YieldSummaryKey,
  yieldSummaryAtom,
} from "../../../yield-summary/index";
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
  resolvePositionDetailsExitSubmission,
  resolvePositionPendingActionDecision,
  togglePendingActionValidator,
} from "../../model/classic-flow-actions";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "../classic-view";
import type { PositionDetailsWorkflowKey } from "../workflow";

const positionDetailsFlowFactsAtom = Atom.family(
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

const exitSubmittedAtom = Atom.family((_key: PositionDetailsWorkflowKey) =>
  Atom.make(false).pipe(Atom.withLabel("positionDetailsExitSubmittedAtom"))
);

export const positionDetailsExitActionViewAtom = Atom.family(
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

export const submitPositionDetailsExitAtom = Atom.family(
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

export const setPositionDetailsExitReceiveTokenAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((address: TokenAddress, context) =>
      context.set(dispatchPositionDetailsWorkflowAtom(key), {
        type: "unstake/receive-token/change",
        data: address,
      })
    )
);

export const setPositionDetailsExitMaxAmountAtom = Atom.family(
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

export const positionPendingActionModalViewAtom = Atom.family(
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

export const closePositionPendingActionModalAtom = Atom.family(
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

export const openPositionPendingActionModalAtom = Atom.family(
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

export const togglePositionPendingActionValidatorAtom = Atom.family(
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

export const runPositionPendingActionAtom = Atom.family(
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
