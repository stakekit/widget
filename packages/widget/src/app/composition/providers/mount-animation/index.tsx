import { useAtomMount } from "@effect/atom-react";
import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  mountAnimationCompletionAtom,
  useMountAnimation,
} from "../../../../features/mount-animation/state";

export const MountAnimationEffects = () => {
  const location = useLocation();
  const { dispatch } = useMountAnimation();

  useAtomMount(mountAnimationCompletionAtom);

  useEffect(() => {
    if (location.pathname !== "/") {
      dispatch({ type: "all" });
    }
  }, [location.pathname, dispatch]);

  return null;
};
