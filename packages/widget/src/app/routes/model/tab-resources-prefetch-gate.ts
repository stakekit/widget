export type TabResourcesPrefetchLandingTab =
  | "activity"
  | "borrow"
  | "earn"
  | "manage"
  | "other";

export const resolveTabResourcesPrefetchLanding = (
  pathname: string
): TabResourcesPrefetchLandingTab => {
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/borrow")) return "borrow";
  if (pathname.startsWith("/positions")) return "manage";
  if (pathname === "/") return "earn";
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
