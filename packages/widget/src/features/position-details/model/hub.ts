import type { YieldPendingActionType } from "../../../domain/earn/action-models";
import type { EarnBalance } from "../../../domain/earn/balance";
import { getPendingActionUrgency } from "../../../domain/portfolio/position-callout";
import type { PositionDetailsPageState } from "./page-state";

/**
 * An action of a position's page that takes an amount: exiting it, or
 * entering it further. Its form opens under its button.
 */
export type PositionDetailsAmountAction = "enter" | "exit";

export type PositionDetailsActionCapabilities = {
  readonly canEnter: boolean;
  readonly canExit: boolean;
};

/**
 * The amount actions in order, the exit first so the page opens on it, and
 * entering further only in a Layout that offers it.
 */
export const resolvePositionDetailsAmountActions = ({
  canEnter,
  canExit,
  offersEnter,
}: PositionDetailsActionCapabilities & {
  readonly offersEnter: boolean;
}): ReadonlyArray<PositionDetailsAmountAction> => [
  ...(canExit ? (["exit"] as const) : []),
  ...(canEnter && offersEnter ? (["enter"] as const) : []),
];

/**
 * The pending action a position's page leads with: the first one the
 * position requires, such as a withdrawal that is ready, else its first
 * claim of rewards. Optional actions and an Instant Exit under way never
 * lead. The leading action's card is the page's primary action.
 */
export const getLeadingPendingAction = <
  A extends {
    readonly pendingAction: { readonly type: YieldPendingActionType };
    readonly yieldBalance: Pick<EarnBalance, "isEncrypted" | "type">;
  },
>(
  actions: ReadonlyArray<A>
): A | null => {
  const urgencyOf = (action: A) =>
    getPendingActionUrgency({
      balance: action.yieldBalance,
      type: action.pendingAction.type,
    });

  return (
    actions.find((action) => urgencyOf(action) === "required") ??
    actions.find((action) => urgencyOf(action) === "claim") ??
    null
  );
};

const positionDetailsEnterHasContent = (val: {
  integrationData?: { status: { enter: boolean } } | null;
}) => val.integrationData?.status.enter ?? false;

/**
 * `exitBalance` is the single active token sum; it is absent when the position
 * holds several active token identities, which have no scalar exit amount.
 */
export const positionDetailsExitHasContent = (val: {
  canChangeUnstakeAmount: boolean | null;
  canUnstake: boolean;
  exitBalance?: unknown;
  integrationData?: unknown;
  positionBalancesByType?: unknown;
  unstakeToken?: unknown;
}) =>
  !!val.integrationData &&
  !!val.positionBalancesByType &&
  val.canUnstake &&
  !!val.exitBalance &&
  val.canChangeUnstakeAmount !== null &&
  !!val.unstakeToken;

/**
 * Tab capabilities are content-based, not flag-based: a Yield can support exit
 * while the position has no unstakeable balance (everything locked or pending),
 * and offering an exit tab that renders nothing is a dead end.
 */
export const resolvePositionDetailsActionCapabilities = (val: {
  canChangeUnstakeAmount: boolean | null;
  canUnstake: boolean;
  exitBalance?: unknown;
  integrationData?: { status: { enter: boolean } } | null;
  positionBalancesByType?: unknown;
  unstakeToken?: unknown;
}): PositionDetailsActionCapabilities => ({
  canEnter: positionDetailsEnterHasContent(val),
  canExit: positionDetailsExitHasContent(val),
});

const positionDetailsPendingHasContent = (val: {
  pendingActions?: readonly unknown[] | null;
}) => !!val.pendingActions?.length;

export const positionDetailsHubHasContent = (val: {
  canUnstake: boolean;
  integrationData?: { status: { enter: boolean } } | null;
  pendingActions?: readonly unknown[] | null;
}) =>
  positionDetailsEnterHasContent(val) ||
  val.canUnstake ||
  positionDetailsPendingHasContent(val);

type PositionDetailsPageLayout = "Actions" | "Failed" | "PositionLost";

/**
 * An active flow (enter, exit, pending action) keeps its pane even when the
 * position disappears or a reload fails: exiting everything removes the
 * position while the flow still has steps or its completion screen to show.
 */
export const resolvePositionDetailsPageLayout = ({
  flowActive,
  page,
}: {
  readonly flowActive: boolean;
  readonly page: PositionDetailsPageState;
}): PositionDetailsPageLayout => {
  if (flowActive) return "Actions";
  switch (page._tag) {
    case "Failed":
      return "Failed";
    case "PositionLost":
      return "PositionLost";
    case "Loading":
    case "Ready":
      return "Actions";
  }
};
