import { Data, Array as EArray, Effect, Option, Result } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../domain";
import {
  ActionCommand,
  type PendingAction,
} from "../../../domain/schema/action-models";
import type {
  EarnBalance,
  EarnValidator,
} from "../../../domain/schema/earn-models";
import { preparePendingActionRequestDto } from "../../../domain/types/pending-action-request";
import { getYieldActionArg } from "../../../domain/types/yields";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { walletScopeOwnerKey } from "../../../services/wallet/domain/scope";
import {
  makeClassicTransactionFlowDestination,
  startClassicFlowSessionAtom,
} from "../../classic-transaction-flow/state";
import { walletConnectionStateAtom } from "../../wallet/state";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  YieldSummaryKey,
} from "../../yield-summary/state";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "./classic-view";
import type { PositionDetailsWorkflowKey } from "./workflow";
import { positionDetailsYieldSummaryAtom } from "./yield-summary";

const positionDetailsFlowFactsAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const workflow = get(positionDetailsWorkflowViewAtom(key));
      const integration = workflow.integrationData;
      const wallet = get(walletConnectionStateAtom);
      const providers = get(
        positionDetailsYieldSummaryAtom(
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
        kycBlocking: kyc.isGateBlocking,
        positionBalancesByType: workflow.positionBalancesByType,
        providers: providers ?? [],
        stakedOrLiquidBalances: workflow.stakedOrLiquidBalances,
        token: workflow.unstakeToken,
        wallet,
        workflow,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsFlowFactsAtom"))
);

const makeExitActionCommand = (
  facts: Atom.Type<ReturnType<typeof positionDetailsFlowFactsAtom>>
) => {
  if (
    facts.wallet.status !== "connected" ||
    !facts.integration ||
    !facts.stakedOrLiquidBalances
  ) {
    return null;
  }

  const validatorArguments = (() => {
    if (
      getYieldActionArg(facts.integration, "exit", "validatorAddresses")
        ?.required
    ) {
      const balance = EArray.findFirst(
        facts.stakedOrLiquidBalances,
        (candidate) => Boolean(candidate.validators?.length)
      ).pipe(Option.getOrNull);
      return {
        validatorAddresses:
          balance?.validators?.map((validator) => validator.address) ?? [],
      };
    }
    if (
      !getYieldActionArg(facts.integration, "exit", "validatorAddress")
        ?.required
    ) {
      return {};
    }

    const balance = EArray.findFirst(
      facts.stakedOrLiquidBalances,
      (candidate) => Boolean(candidate.validator?.address)
    ).pipe(Option.getOrNull);
    if (!balance?.validator?.address) return {};
    const subnetRequired = Boolean(
      getYieldActionArg(facts.integration, "exit", "subnetId")?.required
    );
    const subnetId = subnetRequired ? balance.validator.subnet?.id : undefined;
    if (subnetRequired && subnetId === undefined) return null;
    return {
      validatorAddress: balance.validator.address,
      ...(subnetId === undefined ? {} : { subnetId }),
    };
  })();
  if (!validatorArguments) return null;

  return {
    gasFeeToken: facts.integration.mechanics.gasFeeToken,
    request: ActionCommand.make({
      address: facts.wallet.address,
      arguments: {
        amount: facts.amount.toString(10),
        ...(facts.workflow.unstakeUseMaxAmount ? { useMaxAmount: true } : {}),
        ...validatorArguments,
        ...(facts.wallet.additionalAddresses ?? {}),
      },
      yieldId: facts.integration.id,
    }),
  } as const;
};

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

export const submitPositionDetailsExitAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn((_input: undefined, context) => {
        const facts = context(positionDetailsFlowFactsAtom(key));
        context.set(exitSubmittedAtom(key), true);
        const prepared = makeExitActionCommand(facts);
        if (
          !facts.amountValid ||
          facts.kycBlocking ||
          !facts.integration ||
          !facts.token ||
          !prepared ||
          !key.integrationId ||
          !key.balanceId
        ) {
          return Effect.void;
        }

        const destination = makeClassicTransactionFlowDestination({
          routeBase: `/positions/${key.integrationId}/${key.balanceId}/unstake`,
        });
        return context.setResult(startClassicFlowSessionAtom, {
          destination,
          intake: {
            _tag: "Exit",
            gasFeeToken: prepared.gasFeeToken,
            integration: facts.integration,
            providersDetails: facts.providers,
            request: prepared.request,
            unstakeAmount: facts.amount,
            unstakeToken: facts.token,
            walletScope: key.scope,
          },
          navigation: {
            _tag: "Push",
            path: destination.reviewPath,
          },
        });
      })
      .pipe(Atom.withLabel("submitPositionDetailsExitAtom"))
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

type PendingActionModalState =
  | Readonly<{
      readonly _tag: "Closed";
      readonly multiSelect: false;
      readonly pendingAction: null;
      readonly selectedValidators: Set<EarnValidator["address"]>;
    }>
  | Readonly<{
      readonly _tag: "Open";
      readonly multiSelect: boolean;
      readonly pendingAction: Readonly<{
        readonly pendingActionDto: PendingAction;
        readonly yieldBalance: EarnBalance;
      }>;
      readonly selectedValidators: Set<EarnValidator["address"]>;
    }>;

const closedPendingActionModalState: PendingActionModalState = {
  _tag: "Closed",
  multiSelect: false,
  pendingAction: null,
  selectedValidators: new Set(),
};

const openPendingActionModalState = ({
  pendingActionDto,
  yieldBalance,
}: {
  readonly pendingActionDto: PendingAction;
  readonly yieldBalance: EarnBalance;
}): PendingActionModalState => ({
  _tag: "Open",
  multiSelect: PAMultiValidatorsRequired(pendingActionDto),
  pendingAction: { pendingActionDto, yieldBalance },
  selectedValidators: new Set([
    ...(yieldBalance.validators?.map((validator) => validator.address) ?? []),
    ...(yieldBalance.validator?.address
      ? [yieldBalance.validator.address]
      : []),
  ]),
});

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

const pendingActionModalDecisionAtom = Atom.family(
  (_key: PendingActionModalKey) =>
    Atom.make<PendingActionModalState | null>(null).pipe(
      Atom.withLabel("positionDetailsPendingActionModalDecisionAtom")
    )
);

export const positionPendingActionModalViewAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.make((get) => {
      const decision = get(
        pendingActionModalDecisionAtom(getPendingActionModalKey(key))
      );
      if (decision) return decision;
      if (!key.pendingActionType) return closedPendingActionModalState;

      const positionBalancesByType = get(
        positionDetailsFlowFactsAtom(key)
      ).positionBalancesByType;
      const pendingAction = positionBalancesByType
        ? [...positionBalancesByType.values()]
            .flat()
            .flatMap((balance) =>
              balance.pendingActions.map((pendingActionDto) => ({
                pendingActionDto,
                yieldBalance: balance,
              }))
            )
            .find(
              (candidate) =>
                candidate.pendingActionDto.type === key.pendingActionType &&
                (PAMultiValidatorsRequired(candidate.pendingActionDto) ||
                  PASingleValidatorRequired(candidate.pendingActionDto))
            )
        : null;
      return pendingAction
        ? openPendingActionModalState(pendingAction)
        : closedPendingActionModalState;
    }).pipe(Atom.withLabel("positionPendingActionModalViewAtom"))
);

export const closePositionPendingActionModalAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((_input: undefined, context) =>
      context.set(
        pendingActionModalDecisionAtom(getPendingActionModalKey(key)),
        closedPendingActionModalState
      )
    )
);

export const openPositionPendingActionModalAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync(
      (
        input: {
          readonly pendingActionDto: PendingAction;
          readonly yieldBalance: EarnBalance;
        },
        context
      ) =>
        context.set(
          pendingActionModalDecisionAtom(getPendingActionModalKey(key)),
          openPendingActionModalState(input)
        )
    )
);

export const togglePositionPendingActionValidatorAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    Atom.fnSync((validator: EarnValidator["address"], context) => {
      const current = context(positionPendingActionModalViewAtom(key));
      if (current._tag !== "Open") return;
      const selectedValidators = new Set(current.selectedValidators);
      if (current.multiSelect && selectedValidators.has(validator)) {
        selectedValidators.delete(validator);
      } else {
        if (!current.multiSelect) selectedValidators.clear();
        selectedValidators.add(validator);
      }
      if (selectedValidators.size > 0) {
        context.set(
          pendingActionModalDecisionAtom(getPendingActionModalKey(key)),
          { ...current, selectedValidators }
        );
      }
    })
);

type PositionPendingActionCommand =
  | Readonly<{
      readonly _tag: "Select";
      readonly pendingActionDto: PendingAction;
      readonly yieldBalance: EarnBalance;
    }>
  | Readonly<{ readonly _tag: "SubmitValidators" }>;

export const runPositionPendingActionAtom = Atom.family(
  (key: PositionDetailsWorkflowKey) =>
    appRuntime
      .fn((command: PositionPendingActionCommand, context) => {
        const facts = context(positionDetailsFlowFactsAtom(key));
        if (!facts.integration) return Effect.void;

        const modal = context(positionPendingActionModalViewAtom(key));
        const getSelection = () => {
          if (command._tag === "Select") {
            return {
              pendingActionDto: command.pendingActionDto,
              selectedValidators: [] as EarnValidator["address"][],
              yieldBalance: command.yieldBalance,
            };
          }
          if (modal._tag === "Open") {
            return {
              ...modal.pendingAction,
              selectedValidators: [...modal.selectedValidators],
            };
          }
          return null;
        };
        const selection = getSelection();
        if (!selection) return Effect.void;

        const tracking =
          command._tag === "Select"
            ? TrackingService.use((service) =>
                service.trackEvent("pendingActionClicked", {
                  type: selection.pendingActionDto.type,
                  yieldId: facts.integration!.id,
                })
              )
            : TrackingService.use((service) =>
                service.trackEvent("validatorsSubmitted", {
                  type: selection.pendingActionDto.type,
                  validators: selection.selectedValidators,
                  yieldId: facts.integration!.id,
                })
              );

        if (
          command._tag === "Select" &&
          (PAMultiValidatorsRequired(selection.pendingActionDto) ||
            PASingleValidatorRequired(selection.pendingActionDto))
        ) {
          context.set(
            pendingActionModalDecisionAtom(getPendingActionModalKey(key)),
            openPendingActionModalState({
              pendingActionDto: selection.pendingActionDto,
              yieldBalance: selection.yieldBalance,
            })
          );
          return tracking;
        }

        if (
          facts.wallet.status !== "connected" ||
          !key.integrationId ||
          !key.balanceId
        ) {
          return tracking;
        }

        const prepared = preparePendingActionRequestDto({
          additionalAddresses: facts.wallet.additionalAddresses,
          address: facts.wallet.address,
          integration: facts.integration,
          pendingActionDto: selection.pendingActionDto,
          pendingActionsState: facts.workflow.pendingActions,
          selectedValidators: selection.selectedValidators,
          yieldBalance: selection.yieldBalance,
        });
        if (Result.isFailure(prepared)) return tracking;

        const destination = makeClassicTransactionFlowDestination({
          routeBase: `/positions/${key.integrationId}/${key.balanceId}/pending-action`,
        });
        const value = prepared.success;
        return tracking.pipe(
          Effect.andThen(
            context.setResult(startClassicFlowSessionAtom, {
              destination,
              intake: {
                _tag: "Manage",
                gasFeeToken: value.gasFeeToken,
                integration: value.integrationData,
                interactedToken: selection.yieldBalance.token,
                pendingActionType: selection.pendingActionDto.type,
                providersDetails: facts.providers,
                request: value.requestDto,
                walletScope: key.scope,
              },
              navigation: {
                _tag: "Push",
                path: destination.reviewPath,
              },
            })
          ),
          Effect.tap((outcome) =>
            outcome._tag === "Started"
              ? Effect.sync(() =>
                  context.set(
                    pendingActionModalDecisionAtom(
                      getPendingActionModalKey(key)
                    ),
                    closedPendingActionModalState
                  )
                )
              : Effect.void
          )
        );
      })
      .pipe(Atom.withLabel("runPositionPendingActionAtom"))
);
