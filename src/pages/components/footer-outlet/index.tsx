import { useLayoutEffect, useState } from "react";
import { Box, Button } from "../../../components";
import { motion } from "framer-motion";
import { useMountAnimationFinished } from "../../../navigation/containers/animation-layout";
import { footerContainer } from "./styles.css";
import {
  FooterButtonVal,
  useFooterButton,
  useFooterHeight,
  useSyncFooterHeight,
} from "./context";

const FooterButton = ({
  disabled,
  isLoading,
  onClick,
  label,
  variant,
}: NonNullable<FooterButtonVal>) => {
  const { containerRef } = useSyncFooterHeight();

  const [mountAnimationFinished] = useMountAnimationFinished();
  const [initAnimationFinished, setInitAnimationFinished] = useState(
    mountAnimationFinished
  );

  return (
    <motion.div
      ref={containerRef}
      className={footerContainer}
      layout="position"
      transition={{ layout: { duration: 0.3 } }}
    >
      <motion.div
        initial={{
          translateY: mountAnimationFinished ? "-20px" : "-40px",
          opacity: 0,
        }}
        {...(mountAnimationFinished
          ? {
              animate: {
                translateY: 0,
                opacity: 1,
                transition: {
                  duration: initAnimationFinished ? 0.3 : 0.6,
                  delay: 0.2,
                },
              },
            }
          : {})}
        onAnimationComplete={() => setInitAnimationFinished(true)}
      >
        <Box px="4" marginBottom="4" marginTop="2" zIndex="modal">
          <Box
            flex={1}
            display="flex"
            justifyContent="flex-end"
            flexDirection="column"
          >
            <Button
              disabled={disabled}
              isLoading={isLoading}
              onClick={onClick}
              variant={{
                color:
                  variant ?? (disabled || isLoading ? "disabled" : "primary"),
                animation: "press",
              }}
            >
              {label}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  );
};

export const FooterContent = () => {
  const [val] = useFooterButton();

  const [, setFooterHeight] = useFooterHeight();

  useLayoutEffect(() => {
    !val && setFooterHeight(0);
  }, [setFooterHeight, val]);

  if (!val) return null;

  return <FooterButton {...val} />;
};
