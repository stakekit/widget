import type BigNumber from "bignumber.js";

import type { ExitReceiveToken } from "../../../domain/action/rules";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
  YieldPendingActionType,
} from "../../../domain/earn/action-models";
import type {
  ConfidentialHandle,
  YieldBalanceType,
} from "../../../domain/earn/balance";
import type { TokenAmount } from "../../../domain/earn/denomination";
import type { EarnProvider } from "../../../domain/earn/provider";
import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../domain/earn/validator";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { ProviderOption } from "../../../domain/identity/identifiers";
import type { Token } from "../../../domain/token/token";
import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import type { YieldTransactionWorkflowProviderDetail } from "../../../services/transaction-workflow/transaction-workflow-model";

type YieldFlowProviderDetail = YieldTransactionWorkflowProviderDetail;

/** The provider option an Enter executes with, and its details at start. */
type YieldFlowProviderOption = {
  readonly provider: EarnProvider | null;
  readonly value: ProviderOption;
};

export type EnterYieldTransactionFlowIntake = {
  readonly _tag: "Enter";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly request: ActionCommand;
  readonly selectedProviderOption: YieldFlowProviderOption | null;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: Token;
  readonly selectedValidators: ReadonlyMap<EarnValidatorKey, EarnValidator>;
  readonly walletScope: WalletScopeKey;
};

export type ExitYieldTransactionFlowIntake = {
  readonly _tag: "Exit";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly integration: EarnYieldWithProvider;
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly receiveToken: ExitReceiveToken | null;
  readonly request: ActionCommand;
  readonly unstakeAmount: BigNumber;
  readonly unstakeToken: Token;
  readonly walletScope: WalletScopeKey;
};

type ManageYieldTransactionFlowIntake = {
  readonly _tag: "Manage";
  /**
   * What the action shows; null when it names no amount, never its
   * balance's: see `getPendingActionAmount`.
   */
  readonly amount: TokenAmount | null;
  /** Balance the pending action acts on; names e.g. which request is cancelled. */
  readonly balanceType: YieldBalanceType;
  /** The balance is still encrypted, so its amount is unknown here. */
  readonly balanceHidden?: boolean;
  /** The token a cancel returns, named as what the user receives. */
  readonly cancelReturnToken?: Token;
  readonly confidentialHandle?: ConfidentialHandle;
  readonly gasFeeToken: Token;
  readonly integration: EarnYieldWithProvider;
  readonly interactedToken: Token;
  readonly pendingActionType: YieldPendingActionType;
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly request: ManageActionCommand;
  readonly walletScope: WalletScopeKey;
};

export type YieldActionContinuationIntake = {
  readonly _tag: "YieldActionContinuation";
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
};

/** An intake Review previews: every intake except a continued action. */
export type YieldPreviewIntake =
  | EnterYieldTransactionFlowIntake
  | ExitYieldTransactionFlowIntake
  | ManageYieldTransactionFlowIntake;

export type YieldTransactionFlowIntake =
  | YieldPreviewIntake
  | YieldActionContinuationIntake;

export const getYieldTransactionFlowKycYield = (
  intake: YieldTransactionFlowIntake
): EarnYieldWithProvider | null => {
  switch (intake._tag) {
    case "Enter":
      return intake.selectedStake;
    case "Exit":
      return intake.integration;
    case "Manage":
    case "YieldActionContinuation":
      return null;
  }
};

/** The yield a flow's intake acts on. */
export const getYieldFlowIntakeYield = (
  intake: YieldTransactionFlowIntake
): EarnYieldWithProvider => {
  switch (intake._tag) {
    case "Enter":
      return intake.selectedStake;
    case "Exit":
    case "Manage":
      return intake.integration;
    case "YieldActionContinuation":
      return intake.selectedYield;
  }
};

export const isYieldTransactionFlowWalletScopeValid = (
  intake: YieldTransactionFlowIntake,
  currentWalletScope: WalletScopeKey | null
): boolean =>
  currentWalletScope !== null &&
  sameWalletScopeOwner(intake.walletScope, currentWalletScope);

const isYieldTransactionFlowIntakeVariant = <
  Variant extends YieldTransactionFlowIntake["_tag"],
>(
  intake: YieldTransactionFlowIntake,
  variant: Variant
): intake is Extract<YieldTransactionFlowIntake, { readonly _tag: Variant }> =>
  intake._tag === variant;

export const getYieldTransactionFlowIntakeVariant = <
  Variant extends YieldTransactionFlowIntake["_tag"],
>(
  intake: YieldTransactionFlowIntake,
  variant: Variant
): Extract<YieldTransactionFlowIntake, { readonly _tag: Variant }> | null =>
  isYieldTransactionFlowIntakeVariant(intake, variant) ? intake : null;
