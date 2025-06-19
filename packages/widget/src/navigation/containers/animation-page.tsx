import { useSettings } from "@sk-widget/providers/settings";
import { motion } from "motion/react";
import type { PropsWithChildren } from "react";

export const AnimationPage = ({ children }: PropsWithChildren) => {
  const { dashboardVariant } = useSettings();

  return (
    <motion.div
      initial={{
        opacity: 0,
        scale: 1,
        translateY: dashboardVariant ? "-10px" : "-15px",
      }}
      animate={{
        opacity: 1,
        translateY: 0,
        transition: { duration: dashboardVariant ? 0.4 : 0.5, delay: 0.1 },
      }}
      exit={{
        opacity: 0,
        filter: "blur(8px)",
        scale: dashboardVariant ? 0.9 : 0.8,
        transition: { duration: 0.4 },
      }}
    >
      {children}
    </motion.div>
  );
};
