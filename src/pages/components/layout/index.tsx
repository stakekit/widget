import { Outlet, ScrollRestoration } from "react-router-dom";
import { absoluteContainer } from "./styles.css";
import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";
import { useCurrentLayout } from "./layout-context";
import { motion } from "framer-motion";

export const Layout = ({ currentPathname }: { currentPathname: string }) => {
  const { setState } = useCurrentLayout();

  const { containerRef } = useSyncElementHeight((height) => {
    setState({ pathname: currentPathname, height });
  });

  return (
    <>
      <ScrollRestoration />

      <motion.div
        layout="position"
        ref={containerRef}
        className={absoluteContainer}
      >
        <Outlet />
      </motion.div>
    </>
  );
};
