import { motion } from "motion/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useSettings } from "../../providers/settings";

export const AnimationPage = ({ children }: PropsWithChildren) => {
  const { dashboardVariant } = useSettings();
  const dashboardLayoutStyle: CSSProperties | undefined = dashboardVariant
    ? {
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
      }
    : undefined;

  return (
    <motion.div
      style={dashboardLayoutStyle}
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
