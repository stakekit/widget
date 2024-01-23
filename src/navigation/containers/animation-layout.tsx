import { motion } from "framer-motion";
import { animationContainer } from "../../style.css";
import { PropsWithChildren, useEffect } from "react";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import createStateContext from "../../utils/create-state-context";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { useSKLocation } from "../../providers/location";

export const [useMountAnimationFinished, MountAnimationFinishedProvider] =
  createStateContext(false);

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();

  const [mountAnimationFinished, setMountAnimationFinished] =
    useMountAnimationFinished();

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height + headerHeight + footerHeight
      : 0;

  const finalContainerHeight = containerHeight;

  const { current } = useSKLocation();

  useEffect(() => {
    if (current.pathname !== "/") {
      setMountAnimationFinished(true);
    }
  }, [current.pathname, setMountAnimationFinished]);

  return (
    <motion.div
      layout="size"
      className={animationContainer}
      style={{
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "20px",
        position: "relative",
        height: finalContainerHeight,
      }}
      transition={
        mountAnimationFinished
          ? { duration: 0.25 }
          : { duration: 0.6, delay: 0.5 }
      }
      onLayoutAnimationComplete={() => setMountAnimationFinished(true)}
    >
      {children}
    </motion.div>
  );
};
