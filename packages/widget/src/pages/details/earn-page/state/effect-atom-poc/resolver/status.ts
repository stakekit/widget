import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  EarnCatalogError,
  EarnEntryKey,
  EarnTokenOption,
  EarnTokenOptionsState,
  EarnYieldOption,
} from "../types";

export const isResolvingTokenOptions = (tokenOptions: EarnTokenOptionsState) =>
  tokenOptions.items.length === 0 &&
  (AsyncResult.isInitial(tokenOptions.defaultResult) ||
    AsyncResult.isWaiting(tokenOptions.defaultResult) ||
    AsyncResult.isInitial(tokenOptions.balancesResult) ||
    AsyncResult.isWaiting(tokenOptions.balancesResult));

export const isResolvingInitialSelection = ({
  entry,
  tokenOptions,
}: {
  entry: EarnEntryKey;
  tokenOptions: EarnTokenOptionsState;
}) =>
  (!!entry.initParams?.token &&
    isResolvingResult(tokenOptions.initTokenResult)) ||
  (!!entry.initParams?.yieldId &&
    isResolvingResult(tokenOptions.initYieldResult));

export const isResolvingYields = (
  yieldsResult: AsyncResult.AsyncResult<
    ReadonlyArray<EarnYieldOption>,
    EarnCatalogError
  >
) => AsyncResult.isInitial(yieldsResult) || AsyncResult.isWaiting(yieldsResult);

const isResolvingResult = (
  result: AsyncResult.AsyncResult<
    EarnTokenOption | EarnYieldOption | null,
    EarnCatalogError
  >
) => AsyncResult.isInitial(result) || AsyncResult.isWaiting(result);
