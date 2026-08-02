import { useAtomMount } from "@effect/atom-react";
import { pendingActionDeepLinkRouteAtom } from "./state/pending-action-deep-link-route";

export const ApplicationRouteEffects = () => {
  useAtomMount(pendingActionDeepLinkRouteAtom);
  return null;
};
