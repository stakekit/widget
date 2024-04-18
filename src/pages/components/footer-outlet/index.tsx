import { useState } from "react";
import { Box, Button } from "../../../components";
import { motion } from "framer-motion";
import { footerContainer } from "./styles.css";
import type { FooterButtonVal } from "./context";
import {
  useFooterButton,
  useFooterHeight,
  useSyncFooterHeight,
} from "./context";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useIsomorphicEffect } from "../../../hooks/use-isomorphic-effect";

const FooterButton = ({
  disabled,
  isLoading,
  onClick,
  label,
  variant,
}: NonNullable<FooterButtonVal>) => {
  const { containerRef } = useSyncFooterHeight();

  const { state } = useMountAnimation();
  const [initAnimationFinished, setInitAnimationFinished] = useState(
    state.layout
  );

  return (
    <motion.div
      ref={containerRef}
      className={footerContainer}
      initial={{
        translateY: state.layout ? "-20px" : "-40px",
        opacity: 0,
      }}
      {...(state.layout
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
      <Box px="4" marginTop="2" marginBottom="4" zIndex="modal">
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
  );
};

export const FooterContent = () => {
  const [val] = useFooterButton();

  const [, setFooterHeight] = useFooterHeight();

  useIsomorphicEffect(() => {
    !val && setFooterHeight(0);
  }, [setFooterHeight, val]);

  if (!val) return null;

  return <FooterButton {...val} />;
};
