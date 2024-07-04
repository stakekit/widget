import type { MotionProps, TargetAndTransition } from "framer-motion";
import { motion } from "framer-motion";
import { Just } from "purify-ts";
import type { PropsWithChildren } from "react";
import { Box, Spinner } from "../../components";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import { useReferralCode } from "../../hooks/api/referral/use-referral-code";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { usePoweredByHeight } from "../../pages/components/powered-by";
import { useMountAnimation } from "../../providers/mount-animation";
import { useSettings } from "../../providers/settings";
import { animationContainer } from "../../style.css";
import createStateContext from "../../utils/create-state-context";

export const [useDisableTransitionDuration, DisableTransitionDurationProvider] =
  createStateContext(false);

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();
  const [poweredByHeight] = usePoweredByHeight();

  const { state, dispatch } = useMountAnimation();

  const { referralCheck, disableInitLayoutAnimation } = useSettings();
  const referralCode = useReferralCode();

  const showApp = !referralCheck || !!referralCode.data;

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height +
        headerHeight +
        footerHeight +
        poweredByHeight
      : 0;

  const [disableTransitionDuration] = useDisableTransitionDuration();

  const animate = Just(containerHeight)
    .chain<TargetAndTransition>((height) =>
      Just(null)
        .map<MotionProps["transition"]>(() => {
          if (disableTransitionDuration) {
            return { duration: 0 };
          }
          if (state.layout) {
            return { duration: 0.3 };
          }
          if (disableInitLayoutAnimation) {
            return { duration: 0 };
          }
          return { duration: 0.6, delay: 0.3 };
        })
        .map((transition) => ({ height, transition }))
    )
    .unsafeCoerce();

  return (
    <>
      {showApp ? (
        <motion.div
          data-rk="widget-container"
          layout="size"
          className={animationContainer}
          initial={{ height: 0 }}
          animate={animate}
          onAnimationComplete={(def: typeof animate) => {
            if (!def.height || state.layout) {
              return;
            }

            dispatch({ type: "layout" });
          }}
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
