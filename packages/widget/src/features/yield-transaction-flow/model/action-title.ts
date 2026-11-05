import { toLowerCase } from "effect/String";
import type { TFunction } from "i18next";
import {
  getPendingActionLabelContext,
  type PendingActionLabelContext,
  type YieldPendingActionType,
} from "../../../domain/action/pending-action";
import { isConfidentialYield } from "../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import {
  getExtendedYieldType,
  isUnstakeYieldType,
} from "../../../domain/earn/yield";
import type { YieldBalanceType } from "../../../domain/portfolio/positions";

/** What an exit is called: Unstake from a staking yield, else Withdraw. */
export const getExitActionTitle = (
  t: TFunction,
  yieldDto: EarnYieldWithProvider
) =>
  isUnstakeYieldType(getExtendedYieldType(yieldDto))
    ? t("position_details.unstake")
    : t("position_details.withdraw");

/** What a pending action is called, as the position's button names it. */
export const getPendingActionTitle = (
  t: TFunction,
  type: YieldPendingActionType,
  labelContext: PendingActionLabelContext | undefined
) =>
  t(
    `position_details.pending_action_button.${toLowerCase(type)}` as const,
    labelContext === undefined ? {} : { context: labelContext }
  );

/** What a pending action on a balance is called. */
export const getManageActionTitle = (
  t: TFunction,
  {
    balanceType,
    type,
    yieldDto,
  }: {
    readonly balanceType: YieldBalanceType;
    readonly type: YieldPendingActionType;
    readonly yieldDto: EarnYieldWithProvider;
  }
) =>
  getPendingActionTitle(
    t,
    type,
    getPendingActionLabelContext(type, balanceType, {
      confidential: isConfidentialYield(yieldDto),
    })
  );
