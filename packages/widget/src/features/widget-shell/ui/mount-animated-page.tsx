import { motion } from "motion/react";
import type { PropsWithChildren, ReactElement } from "react";
import { useMountAnimation } from "../../mount-animation/index";
import { PageContainer } from "./page-container";

export const MountAnimatedPage = ({
  children,
}: PropsWithChildren): ReactElement => {
  const { mountAnimationFinished } = useMountAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, translateY: "-10px" }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 1.5,
      }}
    >
      <PageContainer>{children}</PageContainer>
    </motion.div>
  );
};
