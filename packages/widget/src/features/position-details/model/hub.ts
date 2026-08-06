export type PositionDetailsActionMode = "stake" | "unstake";

export type PositionDetailsActionCapabilities = {
  readonly canStake: boolean;
  readonly canUnstake: boolean;
};

export const getPositionDetailsHubPath = ({
  integrationId,
  balanceId,
}: {
  integrationId: string | undefined;
  balanceId: string | undefined;
}): `/${string}` => `/positions/${integrationId}/${balanceId}`;

export const resolvePositionDetailsActionMode = ({
  canStake,
  canUnstake,
}: PositionDetailsActionCapabilities): PositionDetailsActionMode | null => {
  if (canUnstake) return "unstake";
  if (canStake) return "stake";
  return null;
};

export const resolveSelectedPositionDetailsActionMode = ({
  canStake,
  canUnstake,
  selectedMode,
}: PositionDetailsActionCapabilities & {
  selectedMode: PositionDetailsActionMode | null;
}): PositionDetailsActionMode | null => {
  if (selectedMode === "stake" && canStake) return "stake";
  if (selectedMode === "unstake" && canUnstake) return "unstake";
  return resolvePositionDetailsActionMode({ canStake, canUnstake });
};

export const shouldShowPositionDetailsActionTabs = ({
  canStake,
  canUnstake,
}: PositionDetailsActionCapabilities) => canStake && canUnstake;

export const positionDetailsStakeHasContent = (val: {
  integrationData?: { status: { enter: boolean } } | null;
}) => val.integrationData?.status.enter ?? false;

export const positionDetailsExitHasContent = (val: {
  canChangeUnstakeAmount: boolean | null;
  canUnstake: boolean;
  integrationData?: unknown;
  positionBalancesByType?: unknown;
  reducedStakedOrLiquidBalance?: unknown;
  unstakeToken?: unknown;
}) =>
  !!val.integrationData &&
  !!val.positionBalancesByType &&
  val.canUnstake &&
  !!val.reducedStakedOrLiquidBalance &&
  val.canChangeUnstakeAmount !== null &&
  !!val.unstakeToken;

export const positionDetailsPendingHasContent = (val: {
  pendingActions?: readonly unknown[] | null;
}) => !!val.pendingActions?.length;

export const positionDetailsHubHasContent = (val: {
  canUnstake: boolean;
  integrationData?: { status: { enter: boolean } } | null;
  pendingActions?: readonly unknown[] | null;
}) =>
  positionDetailsStakeHasContent(val) ||
  val.canUnstake ||
  positionDetailsPendingHasContent(val);
