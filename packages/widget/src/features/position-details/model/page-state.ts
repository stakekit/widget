import { Option } from "effect";

import type { Presentable } from "../../../shared/effect/async-result";

/**
 * What a position's page can show from its yield and its position. A value
 * that loaded once keeps showing through a failed refetch; only a load with
 * nothing to show fails the page, and it can be retried.
 */
export type PositionDetailsPageState =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Failed" }
  /** The wallet no longer holds the position: its page leaves for the list. */
  | { readonly _tag: "PositionLost" }
  | { readonly _tag: "Ready" };

export const resolvePositionDetailsPageState = ({
  position,
  validatorsLoading,
  yieldOpportunity,
}: {
  readonly position: Presentable<unknown, unknown>;
  /** The validators the exit picks from are still on their first load. */
  readonly validatorsLoading: boolean;
  readonly yieldOpportunity: Presentable<unknown, unknown>;
}): PositionDetailsPageState => {
  if (position._tag === "Failed") return { _tag: "Failed" };
  if (position._tag === "Ready" && position.value === null) {
    // Gone only once a settled load says so; a refetch may still bring it.
    if (position.refreshing) return { _tag: "Loading" };
    if (Option.isSome(position.refreshFailure)) return { _tag: "Failed" };
    return { _tag: "PositionLost" };
  }
  if (yieldOpportunity._tag === "Failed") return { _tag: "Failed" };
  if (
    yieldOpportunity._tag === "Loading" ||
    position._tag === "Loading" ||
    validatorsLoading
  ) {
    return { _tag: "Loading" };
  }
  // No yield to show the position of.
  if (yieldOpportunity.value === null) return { _tag: "PositionLost" };
  return { _tag: "Ready" };
};
