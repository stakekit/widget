import { motion } from "framer-motion";
import { animationContainer } from "../../style.css";
import { PropsWithChildren } from "react";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { Box, Spinner } from "../../components";
import { useReferralCode } from "../../hooks/api/referral/use-referral-code";
import { useSettings } from "../../providers/settings";
import { useMountAnimation } from "../../providers/mount-animation";
import { usePoweredByHeight } from "../../pages/components/powered-by";

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();
  const [poweredByHeight] = usePoweredByHeight();

  const { state, dispatch } = useMountAnimation();

  const { referralCheck } = useSettings();
  const referralCode = useReferralCode();

  const showApp = !referralCheck || !!referralCode.data;

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height +
        headerHeight +
        footerHeight +
        poweredByHeight
      : 0;

  return (
    <>
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
            state.layout ? { duration: 0.3 } : { duration: 0.6, delay: 0.3 }
          }
          onLayoutAnimationComplete={() => dispatch({ type: "layout" })}
        >
          {children}
        </motion.div>
      ) : referralCode.isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center">
          <Spinner />
        </Box>
      ) : null}
    </>
  );
};
