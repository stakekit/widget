import { Equal, Option, Ref, Schema } from "effect";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type { YieldAction } from "../../../domain/action/models";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { BalanceDataKey } from "../../../domain/portfolio/positions";
import { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  type WidgetFlowDestination,
  type WidgetPath,
  widgetRoutes,
  widgetYieldFlowRoutes,
} from "../../../services/navigation/widget-routes";
import { makeDirectTransactionLedger } from "../../../services/transaction-workflow/transaction-workflow-model";
import type { ConfidentialPreparation } from "../../../services/zama/confidential-preparation";
import type {
  YieldActionContinuationIntake,
  YieldTransactionFlowIntake,
} from "./intake";
import type { PlannedStepType } from "./yield-transaction-workflow";

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
      readonly balanceId: BalanceDataKey;
      readonly integrationId: YieldId;
    }>
  | Readonly<{
      readonly _tag: "PositionManage";
      readonly balanceId: BalanceDataKey;
      readonly integrationId: YieldId;
    }>
  | Readonly<{
      readonly _tag: "PositionStake";
      readonly balanceId: BalanceDataKey;
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
 * amount is encrypted or decrypted, unless Review already created it.
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
      /** The action Review created from `preparation`, if it could. */
      readonly prepared: YieldAction | null;
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
): YieldTransactionFlowIntake => ({
  ...intake,
  walletScope: new WalletScopeKey(walletScope),
});

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
      // A position's flows finish on its page, which returns to the
      // positions list once the position is gone.
      case "PositionExit":
      case "PositionManage":
        return {
          ...yieldFlowRoutes[command.mount._tag].at({
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
          finishPath: widgetRoutes.positionDetails.build({
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
        };
      // Only the Dashboard Layout mounts a position's stake flow.
      case "PositionStake":
        return {
          ...yieldFlowRoutes.PositionStake.at("Dashboard", {
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
          finishPath: widgetRoutes.positionDetails.build({
            balanceId: command.mount.balanceId,
            integrationId: command.mount.integrationId,
          }),
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
export const getYieldFlowRouteGroup = (pathname: string): WidgetPath | null =>
  Option.getOrNull(
    Option.firstSomeOf(
      Object.values(widgetYieldFlowRoutes).map((routes) =>
        routes.mountKey(pathname)
      )
    )
  );

/** The yield a flow acts on. */
export const getYieldFlowYieldId = ({ intake }: YieldFlowSession): YieldId =>
  intake._tag === "YieldActionContinuation"
    ? intake.action.yieldId
    : intake.request.yieldId;
