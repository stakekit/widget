import { type HTMLMotionProps, motion } from "motion/react";
import { createContext, type PropsWithChildren, useContext } from "react";
import { animationPage } from "./layout.css";

export type PageTransition = Pick<
  HTMLMotionProps<"div">,
  "animate" | "exit" | "initial"
>;

/**
 * The page enter and exit animation; the app container provides it. Without a
 * provider, pages render without a transition.
 */
export const PageTransitionContext = createContext<PageTransition>({});

export const AnimationPage = ({ children }: PropsWithChildren) => {
  const transition = useContext(PageTransitionContext);

  return (
    <motion.div className={animationPage} {...transition}>
      {children}
    </motion.div>
  );
};
