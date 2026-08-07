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
import type { ExitReceiveToken } from "../../../domain/types/action";
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
  WalletScopeKey,
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
  readonly receiveToken: ExitReceiveToken | null;
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

type ClassicTransactionFlowDestination = Readonly<{
  readonly completePath: WidgetPath;
  readonly reviewPath: WidgetPath;
  readonly stepsPath: WidgetPath;
}>;

type ClassicTransactionFlowMount =
  | Readonly<{
      readonly _tag: "ActivityResume";
      readonly presentation: "Classic" | "Dashboard";
      readonly target: "FreshReview" | "HistoricalDetails";
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
        { readonly _tag: "ActivityResume" }
      >;
      readonly mount: Extract<
        ClassicTransactionFlowMount,
        { readonly _tag: "ActivityResume" }
      >;
    }>;

export type ClassicFlowSession = Readonly<{
  readonly activityPresentation?: "Classic" | "Dashboard";
  readonly destination: ClassicTransactionFlowDestination;
  readonly epoch: number;
  readonly intake: ClassicTransactionFlowIntake;
}>;

type ClassicFlowSessionDraft = Omit<ClassicFlowSession, "epoch">;

type ClassicTransactionFlowStartNavigation = Readonly<{
  readonly _tag: "Push";
  readonly path: WidgetPath;
  readonly state?: unknown;
}>;

/**
 * Route prefix the flow pages hang off. The widget-root flow lives directly
 * under `/review`, `/steps` and `/complete`, so an empty base is valid.
 */
type ClassicTransactionFlowRouteBase = "" | WidgetPathInput;

const makeClassicTransactionFlowDestination = ({
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

const getActivityFlowPathSegment = (
  type: Extract<
    ClassicTransactionFlowIntake,
    { readonly _tag: "ActivityResume" }
  >["action"]["type"]
): "pending" | "stake" | "unstake" => {
  switch (type) {
    case "STAKE":
      return "stake";
    case "UNSTAKE":
      return "unstake";
    default:
      return "pending";
  }
};

const copyClassicTransactionFlowIntake = (
  intake: ClassicTransactionFlowIntake,
  walletScope: WalletScopeKey
): ClassicTransactionFlowIntake => {
  switch (intake._tag) {
    case "Enter": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "ActivityResume": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Exit": {
      const {
        unstakeAmount,
        walletScope: _expectedWalletScope,
        ...facts
      } = intake;
      return {
        ...structuredClone(facts),
        unstakeAmount: new BigNumber(unstakeAmount),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
    case "Manage": {
      const { walletScope: _expectedWalletScope, ...facts } = intake;
      return {
        ...structuredClone(facts),
        walletScope: new WalletScopeKey(walletScope),
      };
    }
  }
};

export const resolveClassicTransactionFlowStart = (
  command: StartClassicTransactionFlow,
  walletScope: WalletScopeKey
): Readonly<{
  readonly navigation: ClassicTransactionFlowStartNavigation | null;
  readonly session: ClassicFlowSessionDraft;
}> => {
  const { mount } = command;
  const activityResumeIntake =
    command.intake._tag === "ActivityResume" ? command.intake : null;
  const destination = (() => {
    switch (mount._tag) {
      case "ActivityResume": {
        if (!activityResumeIntake) {
          throw new Error("Expected Activity Resume intake.");
        }
        const segment = getActivityFlowPathSegment(
          activityResumeIntake.action.type
        );
        return makeClassicTransactionFlowDestination({
          completePath: `/activity/${segment}/complete`,
          routeBase: "/activity",
          stepsPath: `/activity/${segment}/steps`,
        });
      }
      case "Earn":
        return makeClassicTransactionFlowDestination({ routeBase: "" });
      case "PositionStake":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/stake`,
        });
      case "PositionExit":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/unstake`,
        });
      case "PositionManage":
        return makeClassicTransactionFlowDestination({
          routeBase: `/positions/${mount.integrationId}/${mount.balanceId}/pending-action`,
        });
    }
  })();

  const navigation = (() => {
    if (mount._tag !== "ActivityResume") {
      return { _tag: "Push", path: destination.reviewPath } as const;
    }
    if (mount.presentation === "Dashboard") return null;
    if (mount.target === "FreshReview") {
      return { _tag: "Push", path: destination.reviewPath } as const;
    }
    if (!activityResumeIntake) {
      throw new Error("Expected Activity Resume intake.");
    }

    const segment = getActivityFlowPathSegment(
      activityResumeIntake.action.type
    );
    return {
      _tag: "Push",
      path: toWidgetPath(`/activity/${segment}-review/complete`),
      state: {
        urls: activityResumeIntake.action.transactions.flatMap((transaction) =>
          transaction.explorerUrl
            ? [{ type: transaction.type, url: transaction.explorerUrl }]
            : []
        ),
      },
    } as const;
  })();

  return {
    navigation,
    session: {
      ...(mount._tag === "ActivityResume"
        ? { activityPresentation: mount.presentation }
        : {}),
      destination,
      intake: copyClassicTransactionFlowIntake(command.intake, walletScope),
    },
  };
};

const removeOptionalTrailingSlash = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

const getPathSegments = (pathname: string): ReadonlyArray<string> =>
  removeOptionalTrailingSlash(pathname).split("/").filter(Boolean);

const isActivityResumeSessionPath = (
  session: ClassicFlowSession,
  pathname: string
): boolean => {
  const pathnameSegments = getPathSegments(pathname);
  const reviewPathSegments = getPathSegments(session.destination.reviewPath);
  const routeBaseSegments = reviewPathSegments.slice(0, -1);
  const completePathSegments = getPathSegments(
    session.destination.completePath
  );
  const actionSegment = completePathSegments.at(-2);
  const historicalCompletePathSegments = actionSegment
    ? [...routeBaseSegments, `${actionSegment}-review`, "complete"]
    : [];

  return (
    Object.values(session.destination).some(
      (destination) => destination === pathname
    ) ||
    (pathnameSegments.length === historicalCompletePathSegments.length &&
      pathnameSegments.every(
        (segment, index) => segment === historicalCompletePathSegments[index]
      ))
  );
};

export const isClassicFlowSessionPath = (
  session: ClassicFlowSession,
  pathname: string
): boolean => {
  const normalizedPathname = removeOptionalTrailingSlash(pathname);

  if (session.intake._tag === "ActivityResume") {
    return isActivityResumeSessionPath(session, normalizedPathname);
  }

  return Object.values(session.destination).some(
    (destination) => destination === normalizedPathname
  );
};

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
