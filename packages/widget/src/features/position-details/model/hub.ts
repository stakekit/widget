export type PositionDetailsActionMode = "enter" | "exit";

export type PositionDetailsActionCapabilities = {
  readonly canEnter: boolean;
  readonly canExit: boolean;
};

export const resolvePositionDetailsActionMode = ({
  canEnter,
  canExit,
}: PositionDetailsActionCapabilities): PositionDetailsActionMode | null => {
  if (canExit) return "exit";
  if (canEnter) return "enter";
  return null;
};

export const resolveSelectedPositionDetailsActionMode = ({
  canEnter,
  canExit,
  selectedMode,
}: PositionDetailsActionCapabilities & {
  selectedMode: PositionDetailsActionMode | null;
}): PositionDetailsActionMode | null => {
  if (selectedMode === "enter" && canEnter) return "enter";
  if (selectedMode === "exit" && canExit) return "exit";
  return resolvePositionDetailsActionMode({ canEnter, canExit });
};

export const shouldShowPositionDetailsActionTabs = ({
  canEnter,
  canExit,
}: PositionDetailsActionCapabilities) => canEnter && canExit;

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

export const positionDetailsPendingHasContent = (val: {
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

type PositionDetailsPageLayout = "Actions" | "InfoOnly" | "PositionLost";

/**
 * An active flow (enter, exit, pending action) keeps its pane even when the
 * position disappears: exiting everything removes the position while the flow
 * still has steps or its completion screen to show.
 */
export const resolvePositionDetailsPageLayout = ({
  flowActive,
  integrationData,
  isLoading,
  positionBalancesByType,
  positionLost,
}: {
  flowActive: boolean;
  integrationData: unknown;
  isLoading: boolean;
  positionBalancesByType: unknown;
  positionLost: boolean;
}): PositionDetailsPageLayout => {
  if (flowActive || isLoading) return "Actions";
  if (positionLost) return "PositionLost";
  if (integrationData && positionBalancesByType) return "Actions";
  return "InfoOnly";
};
