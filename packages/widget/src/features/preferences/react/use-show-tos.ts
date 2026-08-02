import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { acknowledgeTosAtom, tosAcknowledgementAtom } from "../state/tos-atoms";

export const useShowTOS = () => {
  const result = useAtomValue(tosAcknowledgementAtom);
  const acknowledgeTos = useAtomSet(acknowledgeTosAtom);
  const state = result.pipe(AsyncResult.value, Option.getOrUndefined);

  const onAcknowledge = () => acknowledgeTos(undefined);
  const variant = useWidgetConfig("variant");

  return {
    acknowledged: state?._tag === "Available" && state.acknowledged === true,
    enabled: variant === "utila",
    onAcknowledge,
    resolving: state?._tag !== "Available",
  };
};
