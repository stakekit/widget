import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { Just } from "purify-ts";
import { useEffect, useState } from "react";
import { Box } from "../../../components/atoms/box";
import { Button } from "../../../components/atoms/button";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useSettings } from "../../../providers/settings";
import type { FooterButtonVal } from "./context";
import {
  useFooterButton,
  useFooterHeight,
  useSyncFooterHeight,
} from "./context";
import { footerContainer } from "./styles.css";

const FooterButton = ({
  disabled,
  isLoading,
  onClick,
  label,
  variant,
}: NonNullable<FooterButtonVal>) => {
  return (
    <Box px="4" marginTop="2" marginBottom="4" zIndex="modal">
      <Box
        flex={1}
        display="flex"
        justifyContent="flex-end"
        flexDirection="column"
      >
        <Button
          data-rk={`footer-button-${variant ?? "primary"}`}
          disabled={disabled}
          isLoading={isLoading}
          onClick={onClick}
          variant={{
            color: variant ?? (disabled || isLoading ? "disabled" : "primary"),
            animation: "press",
          }}
        >
          {label}
        </Button>
      </Box>
    </Box>
  );
};

const AnimatedFooterButton = (props: NonNullable<FooterButtonVal>) => {
  const { containerRef } = useSyncFooterHeight();

  const { state } = useMountAnimation();
  const [initAnimationFinished, setInitAnimationFinished] = useState(
    state.layout
  );

  const { disableInitLayoutAnimation } = useSettings();

  const { animate, initial } = Just({ translateY: 0, opacity: 1 })
    .chain<{ animate: TargetAndTransition; initial: MotionProps["initial"] }>(
      (animateTo) =>
        Just(null).map<{
          animate: TargetAndTransition;
          initial: MotionProps["initial"];
        }>(() => {
          if (disableInitLayoutAnimation && !state.layout) {
            return {
              animate: {},
              initial: { opacity: 1, translateY: 0 },
            };
          }
          if (state.layout) {
            return {
              animate: {
                ...animateTo,
                transition: {
                  duration: initAnimationFinished ? 0.3 : 0.6,
                  delay: 0.2,
                },
              },
              initial: { opacity: 0, translateY: "-20px" },
            };
          }

          return {
            animate: {},
            initial: { opacity: 0, translateY: "-40px" },
          };
        })
    )
    .unsafeCoerce();

  return (
    <motion.div
      data-rk="footer-outlet"
      ref={containerRef}
      className={footerContainer}
      initial={initial}
      animate={animate}
      onAnimationComplete={(def: typeof animate) => {
        if (def.translateY !== 0 || initAnimationFinished) return;

        setInitAnimationFinished(true);
      }}
    >
      <FooterButton {...props} />
    </motion.div>
  );
};

export const AnimatedFooterContent = () => {
  const [val] = useFooterButton();

  const [, setFooterHeight] = useFooterHeight();

  useEffect(() => {
    !val && setFooterHeight(0);
  }, [setFooterHeight, val]);

  if (!val) return null;

  return <AnimatedFooterButton {...val} />;
};

export const FooterContent = () => {
  const [val] = useFooterButton();

  const { containerRef } = useSyncFooterHeight();

  const [, setFooterHeight] = useFooterHeight();

  useEffect(() => {
    !val && setFooterHeight(0);
  }, [setFooterHeight, val]);

  if (!val) return null;

  return (
    <Box ref={containerRef}>
      <FooterButton {...val} />
    </Box>
  );
};
