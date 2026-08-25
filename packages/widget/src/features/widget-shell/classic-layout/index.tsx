import { motion } from "motion/react";
import { Outlet } from "react-router";
import { useElementAtomRef } from "../react/use-element-atom-ref";
import { classicLayoutElementAtom } from "../state/layout-height";
import { absoluteContainer } from "./styles.css";

export const ClassicLayout = () => {
  const classicLayoutRef = useElementAtomRef(classicLayoutElementAtom);

  return (
    <motion.div
      layout="position"
      ref={classicLayoutRef}
      className={absoluteContainer}
    >
      <Outlet />
    </motion.div>
  );
};
