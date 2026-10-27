import { useAtomMount } from "@effect/atom-react";
import { useEffect } from "react";
import {
  mountAnimationCompletionAtom,
  useMountAnimation,
} from "../../../../features/mount-animation/index";
import { useWidgetRouteMatch } from "../../../../features/navigation/index";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";

export const MountAnimationEffects = () => {
  const onEarn = useWidgetRouteMatch(widgetRoutes.earn) !== null;
  const { dispatch } = useMountAnimation();

  useAtomMount(mountAnimationCompletionAtom);

  useEffect(() => {
    if (!onEarn) {
      dispatch({ type: "all" });
    }
  }, [onEarn, dispatch]);

  return null;
};
