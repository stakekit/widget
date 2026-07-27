import { useAtom } from "@effect/atom-react";
import {
  isMountAnimationFinished,
  mountAnimationStateAtom,
} from "../state/mount-animation";

export const useMountAnimation = () => {
  const [state, dispatch] = useAtom(mountAnimationStateAtom);

  return {
    dispatch,
    mountAnimationFinished: isMountAnimationFinished(state),
    state,
  };
};
