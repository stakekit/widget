import type { RiskGateBlockReason } from "../../../../domain/borrow/risk/risk-gate";
import { prepareCollateralToggleAction } from "./collateral-toggle";
import { prepareOpenPositionAction } from "./open-position";
import { prepareRepayAction } from "./repay";
import type {
  BorrowActionPreparation,
  CollateralToggleIntent,
  CollateralToggleProjection,
  OpenPositionDraft,
  OpenPositionProjection,
  RepayDraft,
  RepayProjection,
  WithdrawDraft,
  WithdrawProjection,
} from "./types";
import { prepareWithdrawAction } from "./withdraw";

export type {
  BorrowActionPreparation,
  BorrowConstraintWarning,
  CollateralToggleProjection,
  OpenPositionProjection,
  RepayProjection,
  WithdrawProjection,
} from "./types";

export function prepareBorrowAction(
  input: OpenPositionDraft
): BorrowActionPreparation<OpenPositionProjection>;
export function prepareBorrowAction(
  input: RepayDraft
): BorrowActionPreparation<RepayProjection>;
export function prepareBorrowAction(
  input: WithdrawDraft
): BorrowActionPreparation<WithdrawProjection>;
export function prepareBorrowAction(
  input: CollateralToggleIntent
): BorrowActionPreparation<CollateralToggleProjection>;
export function prepareBorrowAction(
  input: CollateralToggleIntent | OpenPositionDraft | RepayDraft | WithdrawDraft
):
  | BorrowActionPreparation<CollateralToggleProjection>
  | BorrowActionPreparation<OpenPositionProjection>
  | BorrowActionPreparation<RepayProjection>
  | BorrowActionPreparation<WithdrawProjection> {
  switch (input._tag) {
    case "CollateralToggleIntent":
      return prepareCollateralToggleAction(input);
    case "OpenPositionDraft":
      return prepareOpenPositionAction(input);
    case "RepayDraft":
      return prepareRepayAction(input);
    case "WithdrawDraft":
      return prepareWithdrawAction(input);
  }
}

/** The limit the Risk Gate says a prepared action would cross, if it blocks. */
export const getBorrowActionRiskBlock = <P>(
  preparation: BorrowActionPreparation<P> | null
): RiskGateBlockReason | null =>
  preparation?._tag === "Ready" &&
  preparation.review.riskVerdict._tag === "Block"
    ? preparation.review.riskVerdict.reason
    : null;
