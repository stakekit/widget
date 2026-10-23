import type BigNumber from "bignumber.js";
import { Equal, Match, Option, Ref, Schema } from "effect";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../domain/action/models";
import type { YieldPendingActionType } from "../../../domain/action/pending-action";
import type {
  ExitReceiveToken,
  TransactionType,
} from "../../../domain/action/rules";
import { getActionInputToken } from "../../../domain/action/rules";
import {
  getConfidentialAssetToken,
  getConfidentialChainId,
  getConfidentialConversion,
  isConfidentialInstantExit,
  isConfidentialYield,
  toBaseUnits,
} from "../../../domain/earn/confidential";
import type {
  EarnProvider,
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ValidatorKey } from "../../../domain/earn/validator";
import { exactDecimal } from "../../../domain/finance/exact";
import type { ProviderOption } from "../../../domain/identity/identifiers";
import type { YieldBalanceType } from "../../../domain/portfolio/positions";
import type { Token } from "../../../domain/token/token";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import {
  toWidgetPath,
  type WidgetPath,
  type WidgetPathInput,
} from "../../../services/navigation/widget-navigation";
import {
  type ClassicTransactionWorkflowProviderDetail,
  ConfidentialTransactionWorkflowInput,
  makeClassicTransactionWorkflowInput,
  makeDirectTransactionLedger,
  type TransactionWorkflowInput,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type { ConfidentialPreparation } from "../../../services/zama/zama-service";

type ClassicFlowProviderDetail = ClassicTransactionWorkflowProviderDetail;

/** The provider option an Enter executes with, and its details at start. */
type ClassicFlowProviderOption = {
  readonly provider: EarnProvider | null;
  readonly value: ProviderOption;
};

type EnterClassicTransactionFlowIntake = {
  readonly _tag: "Enter";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<ClassicFlowProviderDetail>;
  readonly request: ActionCommand;
  readonly selectedProviderOption: ClassicFlowProviderOption | null;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: Token;
  readonly selectedValidators: ReadonlyMap<ValidatorKey, EarnValidator>;
  readonly walletScope: WalletScopeKey;
};

type ExitClassicTransactionFlowIntake = {
  readonly _tag: "Exit";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly integration: EarnYieldWithProvider;
  readonly providersDetails: ReadonlyArray<ClassicFlowProviderDetail>;
  readonly receiveToken: ExitReceiveToken | null;
  readonly request: ActionCommand;
  readonly unstakeAmount: BigNumber;
  readonly unstakeToken: Token;
  readonly walletScope: WalletScopeKey;
};

type ManageClassicTransactionFlowIntake = {
  readonly _tag: "Manage";
  /** Balance the pending action acts on; names e.g. which request is cancelled. */
  readonly balanceType: YieldBalanceType;
  /** The balance is still encrypted, so its amount is unknown here. */
  readonly balanceHidden?: boolean;
  readonly confidentialHandle?: string;
  readonly gasFeeToken: Token;
  readonly integration: EarnYieldWithProvider;
  readonly interactedToken: Token;
  readonly pendingActionType: YieldPendingActionType;
  readonly providersDetails: ReadonlyArray<ClassicFlowProviderDetail>;
  readonly request: ManageActionCommand;
  readonly walletScope: WalletScopeKey;
};

type YieldActionContinuationIntake = {
  readonly _tag: "YieldActionContinuation";
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<ClassicFlowProviderDetail>;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
};

export type ClassicTransactionFlowIntake =
  | EnterClassicTransactionFlowIntake
  | ExitClassicTransactionFlowIntake
  | ManageClassicTransactionFlowIntake
  | YieldActionContinuationIntake;

type ClassicTransactionFlowDestination = Readonly<{
  readonly completePath: WidgetPath;
  /** Where finishing the flow returns: the tab its mount belongs to. */
  readonly finishPath: WidgetPath;
  readonly reviewPath: WidgetPath;
  readonly stepsPath: WidgetPath;
}>;

type ClassicTransactionFlowMount =
  | Readonly<{
      readonly _tag: "YieldActionContinuation";
    }>
  | Readonly<{ readonly _tag: "Earn" }>
  | Readonly<{
      readonly _tag: "PositionExit";
      readonly balanceId: string;
      readonly integrationId: string;
    }>
  | Readonly<{
      readonly _tag: "PositionManage";
      readonly balanceId: string;
      readonly integrationId: string;
    }>
  | Readonly<{
      readonly _tag: "PositionStake";
      readonly balanceId: string;
      readonly integrationId: string;
    }>;

export type ClassicTransactionFlowEnterMount = Extract<
  ClassicTransactionFlowMount,
  { readonly _tag: "Earn" | "PositionStake" }
>;

export type StartClassicTransactionFlow =
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Enter" }
      >;
      readonly mount: ClassicTransactionFlowEnterMount;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Exit" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "PositionExit" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "Manage" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "PositionManage" }
      >;
    }>
  | Readonly<{
      readonly intake: Extract<
        ClassicTransactionFlowIntake,
        { readonly _tag: "YieldActionContinuation" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "YieldActionContinuation" }
      >;
    }>;

/**
 * What an Execution runs: Review's previewed action, or, for a confidential
 * vault, the preparation its workflow creates the action from once the
 * amount is encrypted or decrypted.
 */
export type ClassicFlowExecutionSource =
  | Readonly<{ readonly _tag: "Action"; readonly action: YieldAction }>
  | Readonly<{
      readonly _tag: "Prepare";
      /**
       * The approve and wrap before it, planned when the user confirmed so
       * Steps lists them at once.
       */
      readonly conversion: ReadonlyArray<DirectTransaction>;
      readonly preparation: ConfidentialPreparation;
    }>;

/**
 * One confirmation Review handed to the Execution Steps opens. Each is its
 * own, even for the same action: Steps' navigation state names it.
 */
export class ClassicFlowHandoff {
  constructor(readonly source: ClassicFlowExecutionSource) {
    Equal.byReferenceUnsafe(this);
  }
}

/** A handoff waiting for Steps to start it, then running until its Execution ends. */
export type ClassicFlowHandoffState = Readonly<{
  readonly _tag: "Running" | "Waiting";
  readonly handoff: ClassicFlowHandoff;
}>;

/**
 * A started Flow Session: its immutable input and its handoff, if any. Start
 * hands it to the flow route through Review navigation state (Activity mounts
 * a Yield Action Continuation directly); the route that mounts it owns its
 * lifetime.
 */
export class ClassicFlowSession {
  /** What the Session's executions broadcast, so confirming again resumes it. */
  readonly ledger = makeDirectTransactionLedger();
  readonly handoff = Ref.makeUnsafe<ClassicFlowHandoffState | null>(null);
  readonly destination: ClassicTransactionFlowDestination;
  readonly intake: ClassicTransactionFlowIntake;
  readonly mount: ClassicTransactionFlowMount;

  constructor(input: {
    readonly destination: ClassicTransactionFlowDestination;
    readonly intake: ClassicTransactionFlowIntake;
    readonly mount: ClassicTransactionFlowMount;
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
export type NavigatingClassicTransactionFlowStart = Exclude<
  StartClassicTransactionFlow,
  { readonly mount: { readonly _tag: "YieldActionContinuation" } }
>;

const ClassicFlowNavigationState = Schema.Struct({
  classicFlowSession: Schema.instanceOf(ClassicFlowSession),
  /** On Steps and Complete: the handoff their Execution runs. */
  executionHandoff: Schema.optional(Schema.instanceOf(ClassicFlowHandoff)),
});

export const makeClassicFlowNavigationState = (
  session: ClassicFlowSession,
  executionHandoff?: ClassicFlowHandoff
): typeof ClassicFlowNavigationState.Type =>
  executionHandoff === undefined
    ? { classicFlowSession: session }
    : { classicFlowSession: session, executionHandoff };

export const decodeClassicFlowNavigationState = (
  state: unknown
): Option.Option<ClassicFlowSession> =>
  Schema.decodeUnknownOption(ClassicFlowNavigationState)(state).pipe(
    Option.map((decoded) => decoded.classicFlowSession)
  );

export const decodeClassicFlowExecutionHandoff = (
  state: unknown
): ClassicFlowHandoff | null =>
  Schema.decodeUnknownOption(ClassicFlowNavigationState)(state).pipe(
    Option.flatMap((decoded) =>
      Option.fromUndefinedOr(decoded.executionHandoff)
    ),
    Option.getOrNull
  );

type ClassicTransactionFlowRouteBase = "" | WidgetPathInput;

const positionFlowSegments = {
  PositionExit: "unstake",
  PositionManage: "pending-action",
  PositionStake: "stake",
} as const;

const makeClassicTransactionFlowDestination = ({
  finishPath,
  routeBase,
}: {
  readonly finishPath: WidgetPathInput;
  readonly routeBase: ClassicTransactionFlowRouteBase;
}): ClassicTransactionFlowDestination => ({
  completePath: toWidgetPath(`${routeBase}/complete`),
  finishPath: toWidgetPath(finishPath),
  reviewPath: toWidgetPath(`${routeBase}/review`),
  stepsPath: toWidgetPath(`${routeBase}/steps`),
});

const copyClassicTransactionFlowIntake = (
  intake: ClassicTransactionFlowIntake,
  walletScope: WalletScopeKey
): ClassicTransactionFlowIntake => {
  const { walletScope: _expectedWalletScope, ...facts } = intake;
  return {
    ...facts,
    walletScope: new WalletScopeKey(walletScope),
  } as ClassicTransactionFlowIntake;
};

export const makeClassicFlowSession = (
  command: StartClassicTransactionFlow,
  walletScope: WalletScopeKey
): ClassicFlowSession => {
  const destination = (() => {
    switch (command.mount._tag) {
      case "YieldActionContinuation": {
        if (command.intake._tag !== "YieldActionContinuation") {
          throw new Error("Expected Yield Action Continuation intake.");
        }
        const routeBase = `/activity/${encodeURIComponent(
          command.intake.action.id
        )}` as WidgetPathInput;
        return {
          completePath: toWidgetPath(`${routeBase}/complete`),
          finishPath: toWidgetPath("/activity"),
          reviewPath: toWidgetPath(routeBase),
          stepsPath: toWidgetPath(`${routeBase}/steps`),
        };
      }
      case "Earn":
        return makeClassicTransactionFlowDestination({
          finishPath: "/",
          routeBase: "",
        });
      case "PositionExit":
      case "PositionManage":
      case "PositionStake":
        return makeClassicTransactionFlowDestination({
          finishPath: "/positions",
          routeBase: `/positions/${command.mount.integrationId}/${command.mount.balanceId}/${positionFlowSegments[command.mount._tag]}`,
        });
    }
  })();

  return new ClassicFlowSession({
    destination,
    intake: copyClassicTransactionFlowIntake(command.intake, walletScope),
    mount: command.mount,
  });
};

/** The Session Activity mounts for a Continuable Yield Action. */
export const makeYieldActionContinuationSession = (
  intake: YieldActionContinuationIntake
): ClassicFlowSession =>
  makeClassicFlowSession(
    { intake, mount: { _tag: "YieldActionContinuation" } },
    intake.walletScope
  );

const removeOptionalTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

const classicFlowRouteGroups = [
  /^()\/(?:review|steps|complete)$/,
  /^(\/positions\/[^/]+\/[^/]+\/(?:stake|unstake|pending-action))\/(?:review|steps|complete)$/,
  /^(\/activity\/[^/]+)(?:\/steps|\/complete)?$/,
];

/**
 * The flow mount a pathname belongs to: Review, Steps, and Complete of one
 * mount share it, so a layout can keep that subtree (and its Session) mounted
 * across the flow's own navigation. Null outside Classic flow routes.
 */
export const getClassicFlowRouteGroup = (pathname: string): string | null => {
  const normalized = removeOptionalTrailingSlash(pathname);
  for (const group of classicFlowRouteGroups) {
    const match = group.exec(normalized);
    if (match) return match[1] || "/";
  }
  return null;
};

type ClassicTransactionFlowReviewPricingInput = {
  readonly token: Token;
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
    case "YieldActionContinuation": {
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
    case "YieldActionContinuation":
      return null;
  }
};

type ClassicTransactionFlowGasWarningInput = {
  readonly gasFeeToken: Token;
  readonly stakeAmount: BigNumber | null;
  readonly stakeToken: Token | null;
  readonly walletScope: WalletScopeKey;
};

export const getClassicTransactionFlowGasWarningInput = (
  intake: ClassicTransactionFlowIntake
): ClassicTransactionFlowGasWarningInput =>
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

const getClassicFlowInputToken = (intake: ClassicTransactionFlowIntake) =>
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
export const getClassicFlowWorkflowInput = ({
  session: { intake, ledger },
  source,
}: {
  readonly session: ClassicFlowSession;
  readonly source: ClassicFlowExecutionSource;
}): TransactionWorkflowInput => {
  const facts = {
    inputToken: getClassicFlowInputToken(intake),
    providersDetails: intake.providersDetails,
    walletScope: intake.walletScope,
  };

  return source._tag === "Action"
    ? makeClassicTransactionWorkflowInput({ ...facts, action: source.action })
    : new ConfidentialTransactionWorkflowInput({
        ...facts,
        conversion: source.conversion,
        ledger,
        preparation: source.preparation,
        yieldId: source.preparation.command.yieldId,
      });
};

/**
 * How a confidential vault's Execution creates its action, once confirmed:
 * its amount encrypted, or its withdrawal decrypted. Null for other vaults.
 */
export const getClassicFlowConfidentialPreparation = (
  intake: ClassicTransactionFlowIntake
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
 * The API action leg a confidential flow prepares only after encrypting or
 * decrypting its amount; it labels that step until the API returns it.
 */
export const getClassicFlowPreparedTransactionType = (
  intake: ClassicTransactionFlowIntake
): TransactionType | null => {
  switch (intake._tag) {
    case "Enter":
      return "DEPOSIT";
    case "Exit":
      return isConfidentialInstantExit(
        intake.integration,
        intake.request.arguments?.outputToken
      )
        ? "UNWRAP"
        : "REDEEM";
    // Only a WITHDRAW pending action carries a handle to decrypt.
    case "Manage":
      return "WITHDRAW";
    case "YieldActionContinuation":
      return null;
  }
};
