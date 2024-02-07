import { motion } from "framer-motion";
import { animationContainer } from "../../style.css";
import { PropsWithChildren, useEffect } from "react";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import createStateContext from "../../utils/create-state-context";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { useSKLocation } from "../../providers/location";
import { config } from "../../config";
import { Box, Spinner } from "../../components";
import { container } from "./styles.css";
import { useReferralCode } from "../../hooks/api/referral/use-referral-code";
import { useSettings } from "../../providers/settings";
import { delayAPIRequests } from "../../common/delay-api-requests";

const removeDelay = delayAPIRequests();

export const [useMountAnimationFinished, MountAnimationFinishedProvider] =
  createStateContext(config.env.isTestMode);

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();

  const [mountAnimationFinished, setMountAnimationFinished] =
    useMountAnimationFinished();

  const { referralCheck } = useSettings();
  const referralCode = useReferralCode();

  const showApp = !referralCheck || !!referralCode.data;

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height + headerHeight + footerHeight
      : 0;

  const { current } = useSKLocation();

  useEffect(() => {
    if (current.pathname !== "/") {
      setMountAnimationFinished(true);
    }
  }, [current.pathname, setMountAnimationFinished]);

  return (
    <Box className={container}>
      {showApp ? (
        <motion.div
          layout="size"
          className={animationContainer}
          style={{
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
            position: "relative",
            height: containerHeight,
          }}
          transition={
            mountAnimationFinished
              ? { duration: 0.3 }
              : { duration: 0.6, delay: 0.3 }
          }
          onLayoutAnimationComplete={() => {
            removeDelay();
            setMountAnimationFinished(true);
          }}
        >
          {children}
        </motion.div>
      ) : referralCode.isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center">
          <Spinner />
        </Box>
      ) : null}
    </Box>
  );
};
