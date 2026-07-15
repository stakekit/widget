import { motion } from "motion/react";
import { Outlet } from "react-router";
import { useSyncElementHeight } from "../../../shared/react/use-sync-element-height";
import { useCurrentLayout } from "../current-layout";
import { absoluteContainer } from "./styles.css";

export const ClassicLayout = ({
  currentPathname,
}: {
  currentPathname: string;
}) => {
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
