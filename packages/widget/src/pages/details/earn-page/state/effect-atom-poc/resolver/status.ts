import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  EarnCatalogError,
  EarnEntryKey,
  EarnTokenOptionsState,
  EarnYieldOption,
} from "../types";

export const isResolvingTokenOptions = (tokenOptions: EarnTokenOptionsState) =>
  (AsyncResult.value(tokenOptions)._tag === "None" ||
    AsyncResult.getOrElse(tokenOptions, () => []).length === 0) &&
  (AsyncResult.isInitial(tokenOptions) || AsyncResult.isWaiting(tokenOptions));

export const isResolvingInitialSelection = ({
  entry,
  tokenOptions,
}: {
  entry: EarnEntryKey;
  tokenOptions: EarnTokenOptionsState;
}) =>
  (!!entry.initParams?.token || !!entry.initParams?.yieldId) &&
  isResolvingResult(tokenOptions);

export const isResolvingYields = (
  yieldsResult: AsyncResult.AsyncResult<
    ReadonlyArray<EarnYieldOption>,
    EarnCatalogError
  >
) => AsyncResult.isInitial(yieldsResult) || AsyncResult.isWaiting(yieldsResult);

const isResolvingResult = (
  result: AsyncResult.AsyncResult<unknown, EarnCatalogError>
) => AsyncResult.isInitial(result) || AsyncResult.isWaiting(result);
