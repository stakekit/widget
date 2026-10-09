import type BigNumber from "bignumber.js";
import { Data, Match, Option, Schema } from "effect";
import type {
  ActionCommand,
  ManageActionCommand,
  YieldAction,
} from "../../../domain/action/models";
import type { YieldPendingActionType } from "../../../domain/action/pending-action";
import type { ExitReceiveToken } from "../../../domain/action/rules";
import { getActionInputToken } from "../../../domain/action/rules";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ValidatorKey } from "../../../domain/earn/validator";
import { exactDecimal } from "../../../domain/finance/exact";
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
  type ClassicTransactionWorkflowInput,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowInput,
} from "../../../services/transaction-workflow/transaction-workflow-model";

type ClassicFlowProviderDetail = ClassicTransactionWorkflowProviderDetail;

type EnterClassicTransactionFlowIntake = {
  readonly _tag: "Enter";
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<ClassicFlowProviderDetail>;
  readonly request: ActionCommand;
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
 * A started Flow Session's immutable input. Start hands it to the flow route
 * through Review navigation state (Activity mounts a Yield Action
 * Continuation directly); the route that mounts it owns its lifetime.
 */
export class ClassicFlowSession extends Data.Class<{
  readonly destination: ClassicTransactionFlowDestination;
  readonly intake: ClassicTransactionFlowIntake;
  readonly mount: ClassicTransactionFlowMount;
}> {}

/** A Start that navigates to its own Review route. */
export type NavigatingClassicTransactionFlowStart = Exclude<
  StartClassicTransactionFlow,
  { readonly mount: { readonly _tag: "YieldActionContinuation" } }
>;

const ClassicFlowNavigationState = Schema.Struct({
  classicFlowSession: Schema.instanceOf(ClassicFlowSession),
});

export const makeClassicFlowNavigationState = (
  session: ClassicFlowSession
): typeof ClassicFlowNavigationState.Type => ({ classicFlowSession: session });

export const decodeClassicFlowNavigationState = (
  state: unknown
): Option.Option<ClassicFlowSession> =>
  Schema.decodeUnknownOption(ClassicFlowNavigationState)(state).pipe(
    Option.map((decoded) => decoded.classicFlowSession)
  );

type ClassicTransactionFlowRouteBase = "" | WidgetPathInput;

const makeClassicTransactionFlowDestination = ({
  routeBase,
}: {
  readonly routeBase: ClassicTransactionFlowRouteBase;
}): ClassicTransactionFlowDestination => ({
  completePath: toWidgetPath(`${routeBase}/complete`),
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
          reviewPath: toWidgetPath(routeBase),
          stepsPath: toWidgetPath(`${routeBase}/steps`),
        };
      }
      case "Earn":
        return makeClassicTransactionFlowDestination({ routeBase: "" });
      case "PositionStake":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${command.mount.integrationId}/${command.mount.balanceId}/stake`,
        });
      case "PositionExit":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${command.mount.integrationId}/${command.mount.balanceId}/unstake`,
        });
      case "PositionManage":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${command.mount.integrationId}/${command.mount.balanceId}/pending-action`,
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

export const getClassicTransactionWorkflowInput = (
  intake: ClassicTransactionFlowIntake,
  action: YieldAction
): ClassicTransactionWorkflowInput => {
  const inputToken = Match.value(intake).pipe(
    Match.tag("Enter", ({ selectedToken }) => selectedToken),
    Match.tag("Exit", ({ unstakeToken }) => unstakeToken),
    Match.tag("Manage", ({ interactedToken }) => interactedToken),
    Match.tag("YieldActionContinuation", ({ selectedYield }) =>
      getActionInputToken({ actionDto: action, yieldDto: selectedYield })
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
