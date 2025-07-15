import { motion } from "motion/react";
import type { PropsWithChildren } from "react";
import { animationContainer } from "./styles.css";

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  return (
    <motion.div
      data-rk="widget-container"
      layout="size"
      className={animationContainer}
      animate={{ transition: { duration: 0.3 } }}
    >
      {children}
    </motion.div>
  );
};
