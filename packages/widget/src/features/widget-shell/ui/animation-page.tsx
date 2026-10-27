import { type HTMLMotionProps, motion } from "motion/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";

type PageTransition = Pick<
  HTMLMotionProps<"div">,
  "animate" | "exit" | "initial"
>;

const yieldPageTransition = {
  initial: { opacity: 0, scale: 1, translateY: "-15px" },
  animate: {
    opacity: 1,
    translateY: 0,
    transition: { duration: 0.5, delay: 0.1 },
  },
  exit: {
    opacity: 0,
    filter: "blur(8px)",
    scale: 0.8,
    transition: { duration: 0.4 },
  },
} satisfies PageTransition;

const dashboardPageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, delay: 0.05 } },
  exit: { opacity: 0, filter: "blur(8px)", transition: { duration: 0.1 } },
} satisfies PageTransition;

const dashboardLayoutStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minHeight: 0,
};

export const AnimationPage = ({ children }: PropsWithChildren) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return (
    <motion.div
      style={dashboardVariant ? dashboardLayoutStyle : undefined}
      {...(dashboardVariant ? dashboardPageTransition : yieldPageTransition)}
    >
      {children}
    </motion.div>
  );
};
