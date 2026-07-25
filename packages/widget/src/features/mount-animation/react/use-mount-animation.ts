import { useAtom } from "@effect/atom-react";
import { mountAnimationStateAtom } from "../state/mount-animation";

export const useMountAnimation = () => {
  const [state, dispatch] = useAtom(mountAnimationStateAtom);

  return {
    dispatch,
    mountAnimationFinished: state.layout && state.earnPage,
    state,
  };
};
