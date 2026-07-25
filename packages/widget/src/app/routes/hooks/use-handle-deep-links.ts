import { useAtomMount } from "@effect/atom-react";
import { pendingActionDeepLinkRouteAtom } from "../state/pending-action-deep-link-route";

export const useHandleDeepLinks = () => {
  useAtomMount(pendingActionDeepLinkRouteAtom);
};
