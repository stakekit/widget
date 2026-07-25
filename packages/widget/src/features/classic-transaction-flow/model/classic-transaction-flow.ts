import BigNumber from "bignumber.js";
import { Match } from "effect";
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
  toWidgetPath,
  type WidgetPath,
  type WidgetPathInput,
} from "../../../services/navigation/widget-navigation";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../services/wallet/domain/scope";
import {
  type ClassicTransactionWorkflowInput,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowInput,
} from "../../../services/workflow/transaction-workflow-model";

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

export type ClassicTransactionFlowDestination = Readonly<{
  readonly completePath: WidgetPath;
  readonly reviewPath: WidgetPath;
  readonly stepsPath: WidgetPath;
}>;

/**
 * Route prefix the flow pages hang off. The widget-root flow lives directly
 * under `/review`, `/steps` and `/complete`, so an empty base is valid.
 */
type ClassicTransactionFlowRouteBase = "" | WidgetPathInput;

export const makeClassicTransactionFlowDestination = ({
  completePath,
  routeBase,
  stepsPath,
}: {
  readonly completePath?: WidgetPathInput;
  readonly routeBase: ClassicTransactionFlowRouteBase;
  readonly stepsPath?: WidgetPathInput;
}): ClassicTransactionFlowDestination => ({
  completePath: toWidgetPath(completePath ?? `${routeBase}/complete`),
  reviewPath: toWidgetPath(`${routeBase}/review`),
  stepsPath: toWidgetPath(stepsPath ?? `${routeBase}/steps`),
});

type ClassicTransactionFlowReviewPricingInput = {
  readonly token: AppToken;
  readonly yield: EarnYieldWithProvider;
};

export const getClassicTransactionFlowReviewPricingInput = (
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlowReviewPricingInput | null => {
  switch (intake._tag) {
    case "Enter":
      return { token: intake.selectedToken, yield: intake.selectedStake };
    case "Exit":
      return { token: intake.unstakeToken, yield: intake.integration };
    case "Manage":
      return { token: intake.interactedToken, yield: intake.integration };
    case "ActivityResume": {
      const token = getActionInputToken({
        actionDto: intake.action,
        yieldDto: intake.selectedYield,
      });
      return token ? { token, yield: intake.selectedYield } : null;
    }
  }
};

export const getClassicTransactionFlowKycYield = (
  intake: ClassicTransactionFlowIntake
): EarnYieldWithProvider | null => {
  switch (intake._tag) {
    case "Enter":
      return intake.selectedStake;
    case "Exit":
      return intake.integration;
    case "Manage":
    case "ActivityResume":
      return null;
  }
};

type ClassicTransactionFlowGasWarningInput = {
  readonly gasFeeToken: AppToken;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: AppToken | null;
  readonly walletScope: WalletScopeKey;
};

export const getClassicTransactionFlowGasWarningInput = (
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlowGasWarningInput =>
  intake._tag === "Enter"
    ? {
        gasFeeToken: intake.gasFeeToken,
        stakeAmount: new BigNumber(intake.request.arguments?.amount ?? 0),
        stakeToken: intake.selectedToken,
        walletScope: intake.walletScope,
      }
    : {
        gasFeeToken:
          intake._tag === "ActivityResume"
            ? intake.selectedYield.mechanics.gasFeeToken
            : intake.gasFeeToken,
        stakeAmount: null,
        stakeToken: null,
        walletScope: intake.walletScope,
      };

export const isClassicTransactionFlowWalletScopeValid = (
  intake: ClassicTransactionFlowIntake,
  currentWalletScope: WalletScopeKey | null
): boolean =>
  currentWalletScope !== null &&
  sameWalletScopeOwner(intake.walletScope, currentWalletScope);

export const getClassicTransactionFlowIntakeVariant = <
  Variant extends ClassicTransactionFlowIntake["_tag"],
>(
  intake: ClassicTransactionFlowIntake,
  variant: Variant
): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> | null =>
  intake._tag === variant
    ? (intake as Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: Variant }
      >)
    : null;

export const getClassicTransactionWorkflowInput = (
  intake: ClassicTransactionFlowIntake,
  action: YieldAction
): ClassicTransactionWorkflowInput => {
  const inputToken = Match.value(intake).pipe(
    Match.tag("Enter", ({ selectedToken }) => selectedToken),
    Match.tag("Exit", ({ unstakeToken }) => unstakeToken),
    Match.tag("Manage", ({ interactedToken }) => interactedToken),
    Match.tag("ActivityResume", ({ selectedYield }) =>
      getActionInputToken({
        actionDto: action,
        yieldDto: selectedYield,
      })
    ),
    Match.exhaustive
  );

  return makeClassicTransactionWorkflowInput({
    action,
    inputToken,
    providersDetails: intake.providersDetails,
    walletScope: intake.walletScope,
  });
};
