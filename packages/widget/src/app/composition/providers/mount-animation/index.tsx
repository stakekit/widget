import { useEffect, useRef } from "react";
import { useMountAnimation } from "../../../../features/mount-animation";
import { delayAPIRequests } from "../../../../services/api/delay-api-requests";
import { useSKLocation } from "../../../../shared/react/location-history";
import { useWidgetConfig } from "../../../config";

const removeDelay = delayAPIRequests();

export const MountAnimationEffects = () => {
  const onMountAnimationComplete = useWidgetConfig("onMountAnimationComplete");
  const callbackRef = useRef(onMountAnimationComplete);
  callbackRef.current = onMountAnimationComplete;
  const { current } = useSKLocation();
  const { dispatch, state } = useMountAnimation();

  useEffect(() => {
    if (state.layout && state.earnPage) {
      removeDelay();
      callbackRef.current?.();
    }
  }, [state.earnPage, state.layout]);

  useEffect(() => {
    if (current.pathname !== "/") {
      dispatch({ type: "all" });
    }
  }, [current.pathname, dispatch]);

  return null;
};
