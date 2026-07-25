import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useMountAnimation } from "../../../../features/mount-animation/state";
import { delayAPIRequests } from "../../../../services/api/delay-api-requests";
import { useWidgetConfig } from "../../../config/use-widget-config";

const removeDelay = delayAPIRequests();

export const MountAnimationEffects = () => {
  const onMountAnimationComplete = useWidgetConfig("onMountAnimationComplete");
  const callbackRef = useRef(onMountAnimationComplete);
  callbackRef.current = onMountAnimationComplete;
  const location = useLocation();
  const { dispatch, state } = useMountAnimation();

  useEffect(() => {
    if (state.layout && state.earnPage) {
      removeDelay();
      callbackRef.current?.();
    }
  }, [state.earnPage, state.layout]);

  useEffect(() => {
    if (location.pathname !== "/") {
      dispatch({ type: "all" });
    }
  }, [location.pathname, dispatch]);

  return null;
};
