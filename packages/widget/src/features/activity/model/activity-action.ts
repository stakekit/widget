import { Match } from "effect";
import type { YieldAction } from "../../../domain/action/models";
import {
  ActionStatus,
  type ActionStatus as ActionStatusValue,
} from "../../../domain/action/rules";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { WalletScopeKey } from "../../../services/wallet/wallet-scope";

export type ActivityActionItem = {
  readonly actionData: YieldAction;
  readonly validatorsData: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yieldData: EarnYieldWithProvider | null;
};

type ActivityActionOpenTarget = "FreshReview" | "HistoricalDetails";

export const getActivityActionOpenTarget = (
  status: ActionStatusValue
): ActivityActionOpenTarget | null =>
  Match.value(status).pipe(
    Match.when(ActionStatus.SUCCESS, () => "HistoricalDetails" as const),
    Match.when(ActionStatus.PROCESSING, () => "HistoricalDetails" as const),
    Match.when(ActionStatus.CREATED, () => "FreshReview" as const),
    Match.when(ActionStatus.WAITING_FOR_NEXT, () => "FreshReview" as const),
    Match.when(ActionStatus.FAILED, () => "FreshReview" as const),
    Match.when(ActionStatus.CANCELED, () => null),
    Match.when(ActionStatus.STALE, () => null),
    Match.exhaustive
  );
