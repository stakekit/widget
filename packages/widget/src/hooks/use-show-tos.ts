import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import {
  setTosAcceptedAtom,
  tosAcceptedAtom,
} from "../providers/effect-atom-runtime/persistence-atoms";
import { useSettings } from "../providers/settings";

export const useShowTOS = () => {
  const result = useAtomValue(tosAcceptedAtom);
  const setTosAccepted = useAtomSet(setTosAcceptedAtom);
  const tosAccepted = result.pipe(
    AsyncResult.value,
    Option.getOrElse(() => false)
  );

  const onAccept = () => setTosAccepted(true);

  const { variant } = useSettings();

  return {
    onAccept,
    tosAccepted,
    enabled: variant === "utila",
  };
};
