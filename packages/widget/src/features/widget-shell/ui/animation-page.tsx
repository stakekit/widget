import { type HTMLMotionProps, motion } from "motion/react";
import { createContext, type PropsWithChildren, useContext } from "react";
import { animationPage } from "./layout.css";

export type PageTransition = Pick<
  HTMLMotionProps<"div">,
  "animate" | "exit" | "initial"
>;

export const compactPageTransition = {
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

export const dashboardPageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, delay: 0.05 } },
  exit: { opacity: 0, filter: "blur(8px)", transition: { duration: 0.1 } },
} satisfies PageTransition;

/** The page enter and exit animation; the app container sets it per Layout. */
export const PageTransitionContext = createContext<PageTransition>(
  compactPageTransition
);

export const AnimationPage = ({ children }: PropsWithChildren) => {
  const transition = useContext(PageTransitionContext);

  return (
    <motion.div className={animationPage} {...transition}>
      {children}
    </motion.div>
  );
};
