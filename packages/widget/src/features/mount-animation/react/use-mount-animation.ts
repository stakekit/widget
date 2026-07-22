import { useAtom } from "@effect/atom-react";
import { mountAnimationStateAtom } from "../public-state";

export const useMountAnimation = () => {
  const [state, dispatch] = useAtom(mountAnimationStateAtom);

  return {
    dispatch,
    mountAnimationFinished: state.layout && state.earnPage,
    state,
  };
};
