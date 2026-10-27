import type BigNumber from "bignumber.js";
import { Equal, Match, Option, Ref, Schema } from "effect";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../domain/action/models";
import type { YieldPendingActionType } from "../../../domain/action/pending-action";
import type { ExitReceiveToken } from "../../../domain/action/rules";
import { getActionInputToken } from "../../../domain/action/rules";
import {
  type CancelReturn,
  type ConfidentialHandle,
  getConfidentialAssetToken,
  getConfidentialChainId,
  getConfidentialConversion,
  isConfidentialInstantExit,
  isConfidentialYield,
  toBaseUnits,
  toConfidentialUnderlyingAmount,
} from "../../../domain/earn/confidential";
import type {
  EarnProvider,
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ValidatorKey } from "../../../domain/earn/validator";
import { exactDecimal } from "../../../domain/finance/exact";
import type {
  ProviderOption,
  YieldId,
} from "../../../domain/identity/identifiers";
import type { YieldBalanceType } from "../../../domain/portfolio/positions";
import type { Token } from "../../../domain/token/token";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import {
  type WidgetFlowDestination,
  type WidgetPath,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../services/navigation/widget-routes";
import {
  ConfidentialTransactionWorkflowInput,
  makeDirectTransactionLedger,
  makeYieldTransactionWorkflowInput,
  type TransactionWorkflowInput,
  type YieldTransactionWorkflowProviderDetail,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type { ConfidentialPreparation } from "../../../services/zama/zama-service";
import type { PlannedStepType } from "./yield-transaction-workflow";

type YieldFlowProviderDetail = YieldTransactionWorkflowProviderDetail;

/** The provider option an Enter executes with, and its details at start. */
type YieldFlowProviderOption = {
  readonly provider: EarnProvider | null;
  readonly value: ProviderOption;
};

type EnterYieldTransactionFlowIntake = {
  readonly _tag: "Enter";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly request: ActionCommand;
  readonly selectedProviderOption: YieldFlowProviderOption | null;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: Token;
  readonly selectedValidators: ReadonlyMap<ValidatorKey, EarnValidator>;
  readonly walletScope: WalletScopeKey;
};

type ExitYieldTransactionFlowIntake = {
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
  /** Balance the pending action acts on; names e.g. which request is cancelled. */
  readonly balanceType: YieldBalanceType;
  /** The balance is still encrypted, so its amount is unknown here. */
  readonly balanceHidden?: boolean;
  /** What a confidential cancel refunds, presented instead of the request. */
  readonly cancelReturn?: CancelReturn;
  readonly confidentialHandle?: ConfidentialHandle;
  readonly gasFeeToken: Token;
  readonly integration: EarnYieldWithProvider;
  readonly interactedToken: Token;
  readonly pendingActionType: YieldPendingActionType;
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly request: ManageActionCommand;
  readonly walletScope: WalletScopeKey;
};

type YieldActionContinuationIntake = {
  readonly _tag: "YieldActionContinuation";
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<YieldFlowProviderDetail>;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
};

export type YieldTransactionFlowIntake =
  | EnterYieldTransactionFlowIntake
  | ExitYieldTransactionFlowIntake
  | ManageYieldTransactionFlowIntake
  | YieldActionContinuationIntake;

type YieldTransactionFlowDestination = WidgetFlowDestination<
  typeof YieldFlowNavigationState.Type
> &
  Readonly<{
    /** Where finishing the flow returns: the tab its mount belongs to. */
    readonly finishPath: WidgetPath;
  }>;

type YieldTransactionFlowMount =
  | Readonly<{
      readonly _tag: "YieldActionContinuation";
    }>
  | Readonly<{ readonly _tag: "Earn" }>
  | Readonly<{
      readonly _tag: "PositionExit";
      readonly balanceId: string;
      readonly integrationId: YieldId;
    }>
  | Readonly<{
      readonly _tag: "PositionManage";
      readonly balanceId: string;
      readonly integrationId: YieldId;
    }>
  | Readonly<{
      readonly _tag: "PositionStake";
      readonly balanceId: string;
      readonly integrationId: YieldId;
    }>;

export type YieldTransactionFlowEnterMount = Extract<
  YieldTransactionFlowMount,
  { readonly _tag: "Earn" | "PositionStake" }
>;

export type StartYieldTransactionFlow =
  | Readonly<{
      readonly intake: Extract<
        YieldTransactionFlowIntake,
        { readonly _tag: "Enter" }
      >;
      readonly mount: YieldTransactionFlowEnterMount;
    }>
  | Readonly<{
      readonly intake: Extract<
        YieldTransactionFlowIntake,
        { readonly _tag: "Exit" }
      >;
      readonly mount: Extract<
        YieldTransactionFlowMount,
        { readonly _tag: "PositionExit" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        YieldTransactionFlowIntake,
        { readonly _tag: "Manage" }
      >;
      readonly mount: Extract<
        YieldTransactionFlowMount,
        { readonly _tag: "PositionManage" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        YieldTransactionFlowIntake,
        { readonly _tag: "YieldActionContinuation" }
      >;
      readonly mount: Extract<
        YieldTransactionFlowMount,
        { readonly _tag: "YieldActionContinuation" }
      >;
    }>;

/**
 * What an Execution runs: Review's previewed action, or, for a confidential
 * vault, the preparation its workflow creates the action from once the
 * amount is encrypted or decrypted.
 */
export type YieldFlowExecutionSource =
  | Readonly<{ readonly _tag: "Action"; readonly action: YieldAction }>
  | Readonly<{
      readonly _tag: "Prepare";
      /**
       * The approve and wrap before it, planned when the user confirmed so
       * Steps lists them at once.
       */
      readonly conversion: ReadonlyArray<DirectTransaction>;
      readonly preparation: ConfidentialPreparation;
      /** Presentation only: the Planned Steps Steps lists until it prepares them. */
      readonly plannedStepTypes: ReadonlyArray<PlannedStepType>;
    }>;

/**
 * One confirmation Review handed to the Execution Steps opens. Each is its
 * own, even for the same action: Steps' navigation state names it.
 */
export class YieldFlowHandoff {
  constructor(readonly source: YieldFlowExecutionSource) {
    Equal.byReferenceUnsafe(this);
  }
}

/** A handoff waiting for Steps to start it, then running until its Execution ends. */
export type YieldFlowHandoffState = Readonly<{
  readonly _tag: "Running" | "Waiting";
  readonly handoff: YieldFlowHandoff;
}>;

/**
 * A started Flow Session: its immutable input and its handoff, if any. Start
 * hands it to the flow route through Review navigation state (Activity mounts
 * a Yield Action Continuation directly); the route that mounts it owns its
 * lifetime.
 */
export class YieldFlowSession {
  /** What the Session's executions broadcast, so confirming again resumes it. */
  readonly ledger = makeDirectTransactionLedger();
  readonly handoff = Ref.makeUnsafe<YieldFlowHandoffState | null>(null);
  readonly destination: YieldTransactionFlowDestination;
  readonly intake: YieldTransactionFlowIntake;
  readonly mount: YieldTransactionFlowMount;

  constructor(input: {
    readonly destination: YieldTransactionFlowDestination;
    readonly intake: YieldTransactionFlowIntake;
    readonly mount: YieldTransactionFlowMount;
  }) {
    this.destination = input.destination;
    this.intake = input.intake;
    this.mount = input.mount;
    // Each Start is its own Session, even with an equal intake: Atom family
    // keys compare it by identity.
    Equal.byReferenceUnsafe(this);
  }
}

/** A Start that navigates to its own Review route. */
export type NavigatingYieldTransactionFlowStart = Exclude<
  StartYieldTransactionFlow,
  { readonly mount: { readonly _tag: "YieldActionContinuation" } }
>;

const YieldFlowNavigationState = Schema.Struct({
  yieldFlowSession: Schema.instanceOf(YieldFlowSession),
  /** On Steps and Complete: the handoff their Execution runs. */
  executionHandoff: Schema.optional(Schema.instanceOf(YieldFlowHandoff)),
});

export type YieldFlowMountTag = YieldTransactionFlowMount["_tag"];

/**
 * Each mount's Review, Steps, and Complete routes, carrying the Session (and
 * on Steps and Complete, the handoff) in their navigation state.
 */
export const yieldFlowRoutes = {
  Earn: widgetYieldFlowRoutes.Earn.withState(YieldFlowNavigationState),
  PositionExit: widgetYieldFlowRoutes.PositionExit.withState(
    YieldFlowNavigationState
  ),
  PositionManage: widgetYieldFlowRoutes.PositionManage.withState(
    YieldFlowNavigationState
  ),
  PositionStake: widgetYieldFlowRoutes.PositionStake.withState(
    YieldFlowNavigationState
  ),
  YieldActionContinuation:
    widgetYieldFlowRoutes.YieldActionContinuation.withState(
      YieldFlowNavigationState
    ),
} as const satisfies Record<YieldFlowMountTag, unknown>;

const copyYieldTransactionFlowIntake = (
  intake: YieldTransactionFlowIntake,
  walletScope: WalletScopeKey
): YieldTransactionFlowIntake => {
  const { walletScope: _expectedWalletScope, ...facts } = intake;
  return {
    ...facts,
    walletScope: new WalletScopeKey(walletScope),
  } as YieldTransactionFlowIntake;
};

export const makeYieldFlowSession = (
  command: StartYieldTransactionFlow,
  walletScope: WalletScopeKey
): YieldFlowSession => {
  const destination = ((): YieldTransactionFlowDestination => {
    switch (command.mount._tag) {
      case "YieldActionContinuation": {
        if (command.intake._tag !== "YieldActionContinuation") {
          throw new Error("Expected Yield Action Continuation intake.");
        }
        return {
          ...yieldFlowRoutes.YieldActionContinuation.at({
            actionId: command.intake.action.id,
          }),
          finishPath: widgetRoutes.activity.build(),
        };
      }
      case "Earn":
        return {
          ...yieldFlowRoutes.Earn.at(),
          finishPath: widgetRoutes.earn.build(),
        };
      case "PositionExit":
      case "PositionManage":
        return {
          ...yieldFlowRoutes[command.mount._tag].at({
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
          finishPath: widgetRoutes.positions.build(),
        };
      // Only the Dashboard Layout mounts a position's stake flow.
      case "PositionStake":
        return {
          ...yieldFlowRoutes.PositionStake.at("Dashboard", {
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
          finishPath: widgetRoutes.positions.build(),
        };
    }
  })();

  return new YieldFlowSession({
    destination,
    intake: copyYieldTransactionFlowIntake(command.intake, walletScope),
    mount: command.mount,
  });
};

/** The Session Activity mounts for a Continuable Yield Action. */
export const makeYieldActionContinuationSession = (
  intake: YieldActionContinuationIntake
): YieldFlowSession =>
  makeYieldFlowSession(
    { intake, mount: { _tag: "YieldActionContinuation" } },
    intake.walletScope
  );

/**
 * The flow mount a pathname belongs to: Review, Steps, and Complete of one
 * mount share it, so a layout can keep that subtree (and its Session) mounted
 * across the flow's own navigation. Null outside Yield flow routes.
 */
export const getYieldFlowRouteGroup = (pathname: string): string | null =>
  Option.getOrNull(
    Option.firstSomeOf(
      Object.values(widgetYieldFlowRoutes).map((routes) =>
        routes.mountKey(pathname)
      )
    )
  );

type YieldTransactionFlowReviewPricingInput = {
  readonly token: Token;
  readonly yield: EarnYieldWithProvider;
};

export const getYieldTransactionFlowReviewPricingInput = (
  intake: YieldTransactionFlowIntake
): YieldTransactionFlowReviewPricingInput | null => {
  switch (intake._tag) {
    case "Enter":
      return { token: intake.selectedToken, yield: intake.selectedStake };
    case "Exit":
      return { token: intake.unstakeToken, yield: intake.integration };
    case "Manage":
      return { token: intake.interactedToken, yield: intake.integration };
    case "YieldActionContinuation": {
      const token = getActionInputToken({
        actionDto: intake.action,
        yieldDto: intake.selectedYield,
      });
      return token ? { token, yield: intake.selectedYield } : null;
    }
  }
};

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

type YieldTransactionFlowGasWarningInput = {
  readonly gasFeeToken: Token;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: Token | null;
  readonly walletScope: WalletScopeKey;
};

export const getYieldTransactionFlowGasWarningInput = (
  intake: YieldTransactionFlowIntake
): YieldTransactionFlowGasWarningInput =>
  intake._tag === "Enter"
    ? {
        gasFeeToken: intake.gasFeeToken,
        stakeAmount: exactDecimal(intake.request.arguments?.amount ?? 0),
        stakeToken: intake.selectedToken,
        walletScope: intake.walletScope,
      }
    : {
        gasFeeToken:
          intake._tag === "YieldActionContinuation"
            ? intake.selectedYield.mechanics.gasFeeToken
            : intake.gasFeeToken,
        stakeAmount: null,
        stakeToken: null,
        walletScope: intake.walletScope,
      };

export const isYieldTransactionFlowWalletScopeValid = (
  intake: YieldTransactionFlowIntake,
  currentWalletScope: WalletScopeKey | null
): boolean =>
  currentWalletScope !== null &&
  sameWalletScopeOwner(intake.walletScope, currentWalletScope);

export const getYieldTransactionFlowIntakeVariant = <
  Variant extends YieldTransactionFlowIntake["_tag"],
>(
  intake: YieldTransactionFlowIntake,
  variant: Variant
): Extract<YieldTransactionFlowIntake, { readonly _tag: Variant }> | null =>
  intake._tag === variant
    ? (intake as Extract<
        YieldTransactionFlowIntake,
        { readonly _tag: Variant }
      >)
    : null;

const getYieldFlowInputToken = (intake: YieldTransactionFlowIntake) =>
  Match.value(intake).pipe(
    Match.tag("Enter", ({ selectedToken }) => selectedToken),
    Match.tag("Exit", ({ unstakeToken }) => unstakeToken),
    Match.tag("Manage", ({ interactedToken }) => interactedToken),
    Match.tag("YieldActionContinuation", ({ action, selectedYield }) =>
      getActionInputToken({ actionDto: action, yieldDto: selectedYield })
    ),
    Match.exhaustive
  );

/**
 * The workflow an Execution of `source` runs. A confidential one converts the
 * deposit's token first and resumes what the Session's Ledger recorded.
 */
export const getYieldFlowWorkflowInput = ({
  session: { intake, ledger },
  source,
}: {
  readonly session: YieldFlowSession;
  readonly source: YieldFlowExecutionSource;
}): TransactionWorkflowInput => {
  const facts = {
    inputToken: getYieldFlowInputToken(intake),
    providersDetails: intake.providersDetails,
    walletScope: intake.walletScope,
  };

  if (source._tag === "Action") {
    return makeYieldTransactionWorkflowInput({
      ...facts,
      action: source.action,
    });
  }
  const { preparation } = source;
  const chainId =
    preparation._tag === "Encrypt" && preparation.instant
      ? getConfidentialChainId(preparation.yieldDto)
      : null;
  return new ConfidentialTransactionWorkflowInput({
    ...facts,
    conversion: source.conversion,
    finalizeUnwrap: chainId === null ? null : { chainId },
    ledger,
    preparation,
    yieldId: preparation.command.yieldId,
  });
};

export type YieldFlowExitCompletion = Readonly<{
  readonly amount: BigNumber;
  /** The payout is valued at the share price, not read back from chain. */
  readonly approximate: boolean;
  /** The exit only joined the next redemption batch. */
  readonly batched: boolean;
  readonly token: Token;
}>;

/**
 * What a finished exit reports: an instant confidential exit the underlying
 * it paid out, a private one the shares it queued, others what they withdrew.
 */
export const getYieldFlowExitCompletion = (
  intake: ExitYieldTransactionFlowIntake
): YieldFlowExitCompletion => {
  const amount = exactDecimal(intake.request.arguments?.amount ?? 0);
  const plain = {
    amount,
    approximate: false,
    batched: false,
    token: intake.unstakeToken,
  };
  if (!isConfidentialYield(intake.integration)) return plain;
  if (
    !isConfidentialInstantExit(
      intake.integration,
      intake.request.arguments?.outputToken
    )
  ) {
    return { ...plain, batched: true };
  }
  return {
    amount: toConfidentialUnderlyingAmount(
      intake.integration,
      intake.unstakeToken,
      amount
    ),
    approximate: true,
    batched: false,
    token: intake.integration.token,
  };
};

/**
 * How a confidential vault's Execution creates its action, once confirmed:
 * its amount encrypted, or its withdrawal decrypted. Null for other vaults.
 */
export const getYieldFlowConfidentialPreparation = (
  intake: YieldTransactionFlowIntake
): ConfidentialPreparation | null => {
  switch (intake._tag) {
    case "Enter": {
      const asset = getConfidentialAssetToken(intake.selectedStake);
      const amount = intake.request.arguments?.amount;
      if (!asset?.address || amount === undefined) return null;
      const conversion = getConfidentialConversion(
        intake.selectedStake,
        intake.selectedToken
      );
      const chainId = getConfidentialChainId(intake.selectedStake);
      return {
        _tag: "Encrypt",
        amount: toBaseUnits(
          exactDecimal(amount),
          intake.selectedToken.decimals
        ),
        assetAddress: asset.address,
        // A hidden balance is checked only once confirmed, not on the form.
        balance:
          conversion || chainId === null
            ? null
            : { chainId, token: intake.selectedToken },
        conversion,
        instant: false,
        command: intake.request,
        intent: "enter",
        requiresPermitSigner: true,
        yieldDto: intake.selectedStake,
      };
    }
    case "Exit": {
      const shares = intake.request.arguments?.shareAmountRaw;
      if (!isConfidentialYield(intake.integration) || shares === undefined) {
        return null;
      }
      return {
        _tag: "Encrypt",
        amount: BigInt(shares),
        assetAddress: null,
        balance: null,
        conversion: null,
        instant: isConfidentialInstantExit(
          intake.integration,
          intake.request.arguments?.outputToken
        ),
        command: intake.request,
        intent: "exit",
        requiresPermitSigner: false,
        yieldDto: intake.integration,
      };
    }
    case "Manage": {
      const chainId = getConfidentialChainId(intake.integration);
      return intake.confidentialHandle && chainId !== null
        ? {
            _tag: "Decrypt",
            chainId,
            handle: intake.confidentialHandle,
            command: intake.request,
          }
        : null;
    }
    case "YieldActionContinuation":
      return null;
  }
};

/**
 * The Planned Steps of a confidential flow: what it prepares only after
 * encrypting or decrypting its amount, listed until the API returns them. A
 * private exit first grants the router on each share token not yet granted;
 * an instant exit then finalizes its unwrap in the same flow.
 */
export const getYieldFlowPlannedStepTypes = (
  intake: YieldTransactionFlowIntake,
  { missingOperatorGrants }: { readonly missingOperatorGrants: number }
): ReadonlyArray<PlannedStepType> => {
  switch (intake._tag) {
    case "Enter":
      return ["DEPOSIT"];
    case "Exit":
      return isConfidentialInstantExit(
        intake.integration,
        intake.request.arguments?.outputToken
      )
        ? ["UNWRAP", "DECRYPT", "WITHDRAW", "REDEEM"]
        : [
            ...Array.from(
              { length: missingOperatorGrants },
              () => "SET_OPERATOR" as const
            ),
            "REDEEM",
          ];
    // Only a WITHDRAW pending action carries a handle to decrypt; it
    // finalizes the unwrap, then redeems the vault shares.
    case "Manage":
      return ["WITHDRAW", "REDEEM"];
    case "YieldActionContinuation":
      return [];
  }
};
