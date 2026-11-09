import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useWidgetConfig } from "../../widget-configuration/index";
import {
  acknowledgeTosAtom,
  tosAcknowledgementStateAtom,
} from "../state/tos-atoms";

export const useShowTOS = () => {
  const state = useAtomValue(tosAcknowledgementStateAtom);
  const acknowledgeTos = useAtomSet(acknowledgeTosAtom);

  const onAcknowledge = () => acknowledgeTos(undefined);
  const { requiresTermsAcknowledgement } = useWidgetConfig("hostProfile");

  return {
    acknowledged: state?._tag === "Available" && state.acknowledged === true,
    enabled: requiresTermsAcknowledgement,
    onAcknowledge,
    resolving: state?._tag !== "Available",
  };
};
