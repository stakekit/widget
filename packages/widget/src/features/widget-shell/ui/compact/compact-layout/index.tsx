import { motion } from "motion/react";
import { Outlet } from "react-router";
import { useElementAtomRef } from "../../../react/use-element-atom-ref";
import { pageOutletElementAtom } from "../../../state/layout-height";
import { absoluteContainer } from "./styles.css";

export const CompactLayout = () => {
  const compactLayoutRef = useElementAtomRef(pageOutletElementAtom);

  return (
    <motion.div
      layout="position"
      ref={compactLayoutRef}
      className={absoluteContainer}
    >
      <Outlet />
    </motion.div>
  );
};
