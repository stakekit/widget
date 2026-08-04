import { useAtomMount } from "@effect/atom-react";
import {
  borrowEntryIntentEventProjectionAtom,
  borrowMarketPositionIntentEventProjectionAtom,
} from "../../features/borrow/state";
import { earnEntryIntentEventProjectionAtom } from "../../features/earn/state";
import { transactionWorkflowResourceEventProjectionAtom } from "../runtime/transaction-workflow-event-projection";
import { pendingActionDeepLinkRouteAtom } from "./state/pending-action-deep-link-route";

export const ApplicationRouteEffects = () => {
  useAtomMount(borrowEntryIntentEventProjectionAtom);
  useAtomMount(borrowMarketPositionIntentEventProjectionAtom);
  useAtomMount(earnEntryIntentEventProjectionAtom);
  useAtomMount(pendingActionDeepLinkRouteAtom);
  useAtomMount(transactionWorkflowResourceEventProjectionAtom);
  return null;
};
