import { useAtomMount } from "@effect/atom-react";
import {
  borrowEntryIntentEventProjectionAtom,
  borrowMarketPositionIntentEventProjectionAtom,
} from "../../../features/borrow/index";
import { earnEntryIntentEventProjectionAtom } from "../../../features/earn/index";
import { transactionWorkflowResourceEventProjectionAtom } from "../../runtime/transaction-workflow-event-projection";
import { pendingActionDeepLinkRouteAtom } from "../state/pending-action-deep-link-route";
import { tabResourcesPrefetchAtom } from "../state/tab-resources-prefetch";

export const useApplicationRouteEffects = () => {
  useAtomMount(borrowEntryIntentEventProjectionAtom);
  useAtomMount(borrowMarketPositionIntentEventProjectionAtom);
  useAtomMount(earnEntryIntentEventProjectionAtom);
  useAtomMount(pendingActionDeepLinkRouteAtom);
  useAtomMount(transactionWorkflowResourceEventProjectionAtom);
  useAtomMount(tabResourcesPrefetchAtom);
};
