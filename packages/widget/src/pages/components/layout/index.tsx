import { motion } from "motion/react";
import { Outlet } from "react-router";
import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import { useCurrentLayout } from "./layout-context";
import { absoluteContainer } from "./styles.css";

export const Layout = ({ currentPathname }: { currentPathname: string }) => {
  const { setState } = useCurrentLayout();

  const { containerRef } = useSyncElementHeight((height) => {
    /**
     * This can happen if checks return <Navigate to="/some/path" />
     * Use last height to prevent layout jump
     */
    if (height === 0) return;

    setState({ pathname: currentPathname, height });
  });

  return (
    <motion.div
      layout="position"
      ref={containerRef}
      className={absoluteContainer}
    >
      <Outlet />
    </motion.div>
  );
};
