import { Match } from "effect";
import type { WidgetLayout } from "../../../services/config/widget-config-model";
import type { InitTab } from "../../../services/wallet/init-params";

/**
 * Resolves a decoded route-level tab into the first memory-router entry. Both
 * Layouts accept cross-Layout aliases; Borrow opens only where it is mounted.
 */
export const resolveInitialRoutePath = ({
  borrowAvailable,
  layout,
  tab,
}: {
  readonly borrowAvailable: boolean;
  readonly layout: WidgetLayout;
  readonly tab: InitTab;
}): string =>
  Match.value({ borrowAvailable, layout, tab }).pipe(
    Match.when({ tab: "activity" }, () => "/activity"),
    Match.when(
      ({ tab }) => tab === "positions" || tab === "manage",
      () => "/positions"
    ),
    Match.when(
      { borrowAvailable: true, layout: "Dashboard", tab: "borrow" },
      () => "/borrow"
    ),
    Match.orElse(() => "/")
  );
