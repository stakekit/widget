import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import { setTosAcceptedAtom, tosAcceptedAtom } from "../state/tos-atoms";

export const useShowTOS = () => {
  const result = useAtomValue(tosAcceptedAtom);
  const setTosAccepted = useAtomSet(setTosAcceptedAtom);
  const tosAccepted = result.pipe(
    AsyncResult.value,
    Option.getOrElse(() => false)
  );

  const onAccept = () => setTosAccepted(true);
  const variant = useWidgetConfig("variant");

  return {
    onAccept,
    tosAccepted,
    enabled: variant === "utila",
  };
};
