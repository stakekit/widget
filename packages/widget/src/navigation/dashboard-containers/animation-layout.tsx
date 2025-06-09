import { animationContainer } from "@sk-widget/navigation/dashboard-containers/styles.css";
import { motion } from "motion/react";
import type { PropsWithChildren } from "react";

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
