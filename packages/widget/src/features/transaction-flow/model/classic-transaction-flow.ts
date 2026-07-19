import BigNumber from "bignumber.js";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import { getActionInputToken } from "../../../domain/types/action";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import type { ValidatorKey } from "../../../domain/types/validators";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../services/wallet/domain/scope";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";

declare const classicTransactionFlowIdentityBrand: unique symbol;

export type ClassicTransactionFlowIdentity = string & {
  readonly [classicTransactionFlowIdentityBrand]: true;
};

export const makeClassicTransactionFlowIdentity = (
  value: string
): ClassicTransactionFlowIdentity => value as ClassicTransactionFlowIdentity;

type ClassicTransactionFlowBase = {
  readonly identity: ClassicTransactionFlowIdentity;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly walletScope: WalletScopeKey;
};

type EnterClassicTransactionFlowIntake = {
  readonly _tag: "Enter";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly request: ActionCommand;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: AppToken;
  readonly selectedValidators: ReadonlyMap<ValidatorKey, EarnValidator>;
  readonly walletScope: WalletScopeKey;
};

type ExitClassicTransactionFlowIntake = {
  readonly _tag: "Exit";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly integration: EarnYieldWithProvider;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly request: ActionCommand;
  readonly unstakeAmount: BigNumber;
  readonly unstakeToken: AppToken;
  readonly walletScope: WalletScopeKey;
};

type ManageClassicTransactionFlowIntake = {
  readonly _tag: "Manage";
  readonly gasFeeToken: AppToken;
  readonly integration: EarnYieldWithProvider;
  readonly interactedToken: AppToken;
  readonly pendingActionType: YieldPendingActionType;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly request: ManageActionCommand;
  readonly walletScope: WalletScopeKey;
};

type ActivityResumeClassicTransactionFlowIntake = {
  readonly _tag: "ActivityResume";
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
};

export type ClassicTransactionFlowIntake =
  | EnterClassicTransactionFlowIntake
  | ExitClassicTransactionFlowIntake
  | ManageClassicTransactionFlowIntake
  | ActivityResumeClassicTransactionFlowIntake;

type ReviewableClassicTransactionFlowIntake = Exclude<
  ClassicTransactionFlowIntake,
  ActivityResumeClassicTransactionFlowIntake
>;

type ReviewingClassicTransactionFlow = ReviewableClassicTransactionFlowIntake &
  ClassicTransactionFlowBase & {
    readonly phase: "Reviewing";
  };

type ExecutableClassicTransactionFlow =
  | (ReviewableClassicTransactionFlowIntake &
      ClassicTransactionFlowBase & {
        readonly action: YieldAction;
        readonly phase: "Executable";
      })
  | (ActivityResumeClassicTransactionFlowIntake &
      ClassicTransactionFlowBase & {
        readonly phase: "Executable";
      });

export type ClassicTransactionFlow =
  | ReviewingClassicTransactionFlow
  | ExecutableClassicTransactionFlow;

type ClassicTransactionFlowState = ClassicTransactionFlow | null;

const copyIntake = (
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlowIntake => {
  const providersDetails = [...intake.providersDetails];

  switch (intake._tag) {
    case "Enter":
      return {
        ...intake,
        providersDetails,
        selectedValidators: new Map(intake.selectedValidators),
      };
    case "ActivityResume":
      return {
        ...intake,
        providersDetails,
        selectedValidators: [...intake.selectedValidators],
      };
    case "Exit":
    case "Manage":
      return { ...intake, providersDetails };
  }
};

export const startClassicTransactionFlow = (
  _activeFlow: ClassicTransactionFlowState,
  identity: ClassicTransactionFlowIdentity,
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlow => {
  const facts = copyIntake(intake);

  return facts._tag === "ActivityResume"
    ? { ...facts, identity, phase: "Executable" }
    : { ...facts, identity, phase: "Reviewing" };
};

type AttachClassicTransactionFlowActionResult =
  | {
      readonly _tag: "Attached";
      readonly activeFlow: ExecutableClassicTransactionFlow;
    }
  | {
      readonly _tag: "StaleFlow";
      readonly activeFlow: ClassicTransactionFlowState;
    }
  | {
      readonly _tag: "NotReviewing";
      readonly activeFlow: ExecutableClassicTransactionFlow;
    };

export const attachClassicTransactionFlowAction = (
  activeFlow: ClassicTransactionFlowState,
  identity: ClassicTransactionFlowIdentity,
  action: YieldAction
): AttachClassicTransactionFlowActionResult => {
  if (!activeFlow || activeFlow.identity !== identity) {
    return { _tag: "StaleFlow", activeFlow };
  }

  if (activeFlow.phase === "Executable") {
    return { _tag: "NotReviewing", activeFlow };
  }

  return {
    _tag: "Attached",
    activeFlow: { ...activeFlow, action, phase: "Executable" },
  };
};

type AbandonClassicTransactionFlowResult =
  | { readonly _tag: "Abandoned"; readonly activeFlow: null }
  | {
      readonly _tag: "StaleFlow";
      readonly activeFlow: ClassicTransactionFlowState;
    };

export const abandonClassicTransactionFlow = (
  activeFlow: ClassicTransactionFlowState,
  identity: ClassicTransactionFlowIdentity
): AbandonClassicTransactionFlowResult =>
  activeFlow?.identity === identity
    ? { _tag: "Abandoned", activeFlow: null }
    : { _tag: "StaleFlow", activeFlow };

type ReturnClassicTransactionFlowToReviewResult =
  | {
      readonly _tag: "ReviewingStarted";
      readonly activeFlow: ReviewingClassicTransactionFlow;
    }
  | {
      readonly _tag: "ActivityResumeRetained";
      readonly activeFlow: Extract<
        ExecutableClassicTransactionFlow,
        { readonly _tag: "ActivityResume" }
      >;
    }
  | {
      readonly _tag: "StaleFlow";
      readonly activeFlow: ClassicTransactionFlowState;
    }
  | {
      readonly _tag: "NotExecutable" | "IdentityNotReplaced";
      readonly activeFlow: ClassicTransactionFlow;
    };

export const returnClassicTransactionFlowToReview = (
  activeFlow: ClassicTransactionFlowState,
  identity: ClassicTransactionFlowIdentity,
  nextIdentity: ClassicTransactionFlowIdentity
): ReturnClassicTransactionFlowToReviewResult => {
  if (!activeFlow || activeFlow.identity !== identity) {
    return { _tag: "StaleFlow", activeFlow };
  }

  if (activeFlow.phase !== "Executable") {
    return { _tag: "NotExecutable", activeFlow };
  }

  if (activeFlow._tag === "ActivityResume") {
    return { _tag: "ActivityResumeRetained", activeFlow };
  }

  if (nextIdentity === identity) {
    return { _tag: "IdentityNotReplaced", activeFlow };
  }

  const { action: _action, ...intake } = activeFlow;
  return {
    _tag: "ReviewingStarted",
    activeFlow: {
      ...intake,
      identity: nextIdentity,
      phase: "Reviewing",
    },
  };
};

export type ClassicTransactionFlowActionPreviewIntent =
  | "enter"
  | "exit"
  | "manage";

type ClassicTransactionFlowActionPreviewInput = {
  readonly command: ActionCommand | ManageActionCommand;
  readonly flowIdentity: ClassicTransactionFlowIdentity;
  readonly intent: ClassicTransactionFlowActionPreviewIntent;
};

export const getClassicTransactionFlowActionPreviewInput = (
  activeFlow: ClassicTransactionFlowState
): ClassicTransactionFlowActionPreviewInput | null => {
  if (activeFlow?.phase !== "Reviewing") return null;

  switch (activeFlow._tag) {
    case "Enter":
      return {
        command: activeFlow.request,
        flowIdentity: activeFlow.identity,
        intent: "enter",
      };
    case "Exit":
      return {
        command: activeFlow.request,
        flowIdentity: activeFlow.identity,
        intent: "exit",
      };
    case "Manage":
      return {
        command: activeFlow.request,
        flowIdentity: activeFlow.identity,
        intent: "manage",
      };
  }
};

type ClassicTransactionFlowReviewPricingInput = {
  readonly token: AppToken;
  readonly yield: EarnYieldWithProvider;
};

export const getClassicTransactionFlowReviewPricingInput = (
  activeFlow: ClassicTransactionFlowState
): ClassicTransactionFlowReviewPricingInput | null => {
  if (!activeFlow) return null;

  switch (activeFlow._tag) {
    case "Enter":
      return {
        token: activeFlow.selectedToken,
        yield: activeFlow.selectedStake,
      };
    case "Exit":
      return { token: activeFlow.unstakeToken, yield: activeFlow.integration };
    case "Manage":
      return {
        token: activeFlow.interactedToken,
        yield: activeFlow.integration,
      };
    case "ActivityResume": {
      const token = getActionInputToken({
        actionDto: activeFlow.action,
        yieldDto: activeFlow.selectedYield,
      });
      return token ? { token, yield: activeFlow.selectedYield } : null;
    }
  }
};

type ClassicTransactionFlowGasWarningInput = {
  readonly gasFeeToken: AppToken;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: AppToken | null;
  readonly walletScope: WalletScopeKey;
};

export const getClassicTransactionFlowGasWarningInput = (
  activeFlow: ClassicTransactionFlowState
): ClassicTransactionFlowGasWarningInput | null => {
  if (!activeFlow) return null;

  return activeFlow._tag === "Enter"
    ? {
        gasFeeToken: activeFlow.gasFeeToken,
        stakeAmount: new BigNumber(activeFlow.request.arguments?.amount ?? 0),
        stakeToken: activeFlow.selectedToken,
        walletScope: activeFlow.walletScope,
      }
    : {
        gasFeeToken:
          activeFlow._tag === "ActivityResume"
            ? activeFlow.selectedYield.mechanics.gasFeeToken
            : activeFlow.gasFeeToken,
        stakeAmount: null,
        stakeToken: null,
        walletScope: activeFlow.walletScope,
      };
};

export const isClassicTransactionFlowWalletScopeValid = (
  activeFlow: ClassicTransactionFlowState,
  currentWalletScope: WalletScopeKey | null
): boolean =>
  activeFlow !== null &&
  currentWalletScope !== null &&
  sameWalletScopeOwner(activeFlow.walletScope, currentWalletScope);

type ClassicTransactionFlowVariant = ClassicTransactionFlow["_tag"];

export const getClassicTransactionFlowVariant = <
  Variant extends ClassicTransactionFlowVariant,
>(
  activeFlow: ClassicTransactionFlowState,
  variant: Variant
): Extract<ClassicTransactionFlow, { readonly _tag: Variant }> | null =>
  activeFlow?._tag === variant
    ? (activeFlow as Extract<
        ClassicTransactionFlow,
        { readonly _tag: Variant }
      >)
    : null;

type ClassicTransactionFlowWorkflowHandoff = {
  readonly flowIdentity: ClassicTransactionFlowIdentity;
  readonly workflowKey: ClassicTransactionWorkflowKey;
};

export const getClassicTransactionFlowWorkflowHandoff = (
  activeFlow: ClassicTransactionFlowState
): ClassicTransactionFlowWorkflowHandoff | null => {
  if (activeFlow?.phase !== "Executable") return null;

  const inputToken =
    activeFlow._tag === "Enter"
      ? activeFlow.selectedToken
      : activeFlow._tag === "Exit"
        ? activeFlow.unstakeToken
        : activeFlow._tag === "Manage"
          ? activeFlow.interactedToken
          : getActionInputToken({
              actionDto: activeFlow.action,
              yieldDto: activeFlow.selectedYield,
            });

  return {
    flowIdentity: activeFlow.identity,
    workflowKey: makeClassicTransactionWorkflowKey({
      action: activeFlow.action,
      inputToken,
      providersDetails: activeFlow.providersDetails,
      walletScope: activeFlow.walletScope,
    }),
  };
};
