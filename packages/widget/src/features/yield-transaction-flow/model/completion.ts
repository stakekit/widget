import type BigNumber from "bignumber.js";
import { DateTime } from "effect";
import type { ExitReceiveToken } from "../../../domain/action/rules";
import type { EarnBalance } from "../../../domain/earn/balance";
import { getConfidentialActionKind } from "../../../domain/earn/confidential";
import type { EarnValidator } from "../../../domain/earn/validator";
import { getYieldCooldownDuration } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../domain/finance/exact";
import type { BalanceDataKey } from "../../../domain/portfolio/positions";
import type { Token } from "../../../domain/token/token";
import type {
  ExitYieldTransactionFlowIntake,
  YieldTransactionFlowIntake,
} from "./intake";
import type { YieldFlowSession } from "./session";

export type YieldFlowExitCompletion = Readonly<{
  readonly amount: BigNumber;
  /** The exit only joined the next redemption batch. */
  readonly batched: boolean;
  /** The Exit Receive Token Review showed, if any. */
  readonly receiveToken: ExitReceiveToken | null;
  /** The Exit Unit's token, which the amount is in. */
  readonly token: Token;
}>;

/** What a finished exit reports: what Review showed. */
export const getYieldFlowExitCompletion = (
  intake: ExitYieldTransactionFlowIntake
): YieldFlowExitCompletion => ({
  amount: exactDecimal(intake.request.arguments?.amount ?? 0),
  batched:
    getConfidentialActionKind(intake.integration, {
      intent: "exit",
      rawArguments: intake.request.arguments ?? null,
      type: "UNSTAKE",
    }) === "privateExit",
  receiveToken: intake.receiveToken,
  token: intake.unstakeToken,
});

/**
 * The exit a flow makes, from a position or continued from Activity: its
 * yield, and whether it only joined the next redemption batch. Null for any
 * other flow.
 */
export const getYieldFlowExit = ({
  intake,
}: YieldFlowSession): Readonly<{
  readonly batched: boolean;
  readonly yieldDto: EarnYieldWithProvider;
}> | null => {
  if (intake._tag === "Exit") {
    return {
      batched: getYieldFlowExitCompletion(intake).batched,
      yieldDto: intake.integration,
    };
  }
  if (
    intake._tag === "YieldActionContinuation" &&
    intake.action.intent === "exit"
  ) {
    return {
      batched:
        getConfidentialActionKind(intake.selectedYield, intake.action) ===
        "privateExit",
      yieldDto: intake.selectedYield,
    };
  }
  return null;
};

/**
 * When an exit's funds unlock: the latest date the API gives the position's
 * exiting balances after the exit completed, else the completion plus the
 * yield's cooldown. Null for a batched exit, whose batch says when instead,
 * or one without a cooldown.
 */
export const getYieldFlowExitUnlockDate = ({
  balances,
  batched,
  completedAt,
  yieldDto,
}: {
  readonly balances: ReadonlyArray<Pick<EarnBalance, "date" | "type">>;
  readonly batched: boolean;
  /** When the exit's workflow completed, so the date does not drift. */
  readonly completedAt: DateTime.Utc;
  readonly yieldDto: EarnYieldWithProvider;
}): DateTime.Utc | null => {
  if (batched) return null;
  const apiDate = balances.reduce<DateTime.Utc | null>(
    (latest, { date, type }) =>
      type === "exiting" &&
      date &&
      DateTime.isGreaterThan(date, completedAt) &&
      (!latest || DateTime.isGreaterThan(date, latest))
        ? date
        : latest,
    null
  );
  if (apiDate) return apiDate;
  const cooldown = getYieldCooldownDuration(yieldDto);
  return cooldown ? DateTime.addDuration(completedAt, cooldown) : null;
};

const getIntakeValidators = (
  intake: YieldTransactionFlowIntake
): ReadonlyArray<EarnValidator> => {
  switch (intake._tag) {
    case "Enter":
      return [...intake.selectedValidators.values()];
    case "YieldActionContinuation":
      return intake.selectedValidators;
    case "Exit":
    case "Manage":
      return [];
  }
};

const getValidatorsBalanceId = (
  validators: ReadonlyArray<EarnValidator>
): BalanceDataKey => {
  const [only, ...others] = validators;
  if (!only) return "default";
  return others.length > 0 ? "validators" : `validator::${only.key}`;
};

/**
 * The position balance a finished flow leads to, among the balances the
 * portfolio holds for its yield: a position page's own balance, or the one
 * the flow's validators stake into. A flow without validators falls back to
 * the yield's only balance; a flow with validators to the only balance one of
 * them holds, never another validator's. Null without one.
 */
export const getYieldFlowPositionBalanceId = (
  { intake, mount }: YieldFlowSession,
  balanceIds: ReadonlyArray<BalanceDataKey>
): BalanceDataKey | null => {
  if (mount._tag !== "Earn" && mount._tag !== "YieldActionContinuation") {
    return balanceIds.includes(mount.balanceId) ? mount.balanceId : null;
  }
  const validators = getIntakeValidators(intake);
  const preferred = getValidatorsBalanceId(validators);
  if (balanceIds.includes(preferred)) return preferred;
  const validatorBalanceIds = new Set(
    validators.map((validator): BalanceDataKey => `validator::${validator.key}`)
  );
  const candidates =
    validators.length === 0
      ? balanceIds
      : balanceIds.filter((balanceId) => validatorBalanceIds.has(balanceId));
  const [only, ...others] = candidates;
  return only && others.length === 0 ? only : null;
};
