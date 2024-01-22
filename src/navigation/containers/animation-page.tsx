import { motion } from "framer-motion";
import { PropsWithChildren } from "react";

export const AnimationPage = ({ children }: PropsWithChildren) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1, translateY: "-15px" }}
      animate={{
        opacity: 1,
        translateY: 0,
        transition: { duration: 0.5, delay: 0.1, ease: "linear" },
      }}
      exit={{
        opacity: 0,
        filter: "blur(8px)",
        scale: 0.8,
        transition: { duration: 0.4, ease: "linear" },
      }}
    >
      {children}
    </motion.div>
  );
};
