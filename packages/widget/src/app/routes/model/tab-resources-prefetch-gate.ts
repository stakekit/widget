import { Option } from "effect";
import { widgetRoutes } from "../../../services/navigation/widget-routes";

export type TabResourcesPrefetchLandingTab =
  | "activity"
  | "borrow"
  | "earn"
  | "manage"
  | "other";

export const resolveTabResourcesPrefetchLanding = (
  pathname: string
): TabResourcesPrefetchLandingTab => {
  if (Option.isSome(widgetRoutes.activity.matchPrefix(pathname))) {
    return "activity";
  }
  if (Option.isSome(widgetRoutes.borrow.matchPrefix(pathname))) return "borrow";
  if (Option.isSome(widgetRoutes.positions.matchPrefix(pathname))) {
    return "manage";
  }
  if (Option.isSome(widgetRoutes.earn.match(pathname))) return "earn";
  return "other";
};

export const shouldWarmTabResources = ({
  borrowMarketsReady,
  earnTokensReady,
  hasScope,
  tab,
}: {
  readonly borrowMarketsReady: boolean;
  readonly earnTokensReady: boolean;
  readonly hasScope: boolean;
  readonly tab: TabResourcesPrefetchLandingTab;
}): boolean => {
  if (!hasScope) return false;

  switch (tab) {
    case "earn":
      return earnTokensReady;
    case "borrow":
      return borrowMarketsReady;
    case "manage":
    case "activity":
      return true;
    case "other":
      return false;
  }
};
