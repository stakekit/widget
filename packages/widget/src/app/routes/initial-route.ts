import { Match } from "effect";
import type { InitTab } from "../../services/wallet/init-params";

/**
 * Resolves a decoded route-level tab into the first memory-router entry. Both
 * variants accept cross-variant aliases while keeping their route trees private
 * to application composition.
 */
export const resolveInitialRoutePath = ({
  borrowAvailable,
  tab,
  variant,
}: {
  readonly borrowAvailable: boolean;
  readonly tab: InitTab;
  readonly variant: "classic" | "dashboard";
}): string =>
  Match.value({ borrowAvailable, tab, variant }).pipe(
    Match.when({ tab: "activity" }, () => "/activity"),
    Match.when(
      ({ tab }) => tab === "positions" || tab === "manage",
      () => "/positions"
    ),
    Match.when(
      { borrowAvailable: true, tab: "borrow", variant: "dashboard" },
      () => "/borrow"
    ),
    Match.orElse(() => "/")
  );
