import { Box } from "../../../components";
import { usePositions } from "./hooks/use-positions";
import {
  ImportValidatorListItem,
  PositionsListItem,
} from "./components/positions-list-item";
import { PageContainer } from "../../components";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { useSKWallet } from "../../../providers/sk-wallet";
import { FallbackContent } from "./components/fallback-content";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useHandleListState } from "../../../providers/list-state";
import { container } from "./style.css";
import { motion } from "framer-motion";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useMemo } from "react";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsData, listData, importValidators, showPositions } =
    usePositions();

  const { isConnected, isConnecting } = useSKWallet();

  const content = useMemo(() => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return <FallbackContent type="spinner" />;
    } else if (!isConnected && !isConnecting) {
      return <FallbackContent type="not_connected" />;
    } else if (positionsData.isError && !positionsData.data.length) {
      return <FallbackContent type="something_wrong" />;
    } else if (isConnected && !positionsData.data.length) {
      return <FallbackContent type="no_current_positions" />;
    }

    return null;
  }, [
    isConnected,
    isConnecting,
    positionsData.data.length,
    positionsData.isError,
    positionsData.isFetching,
    positionsData.isLoading,
  ]);

  const { scrollTop, virtualListRef } = useHandleListState();

  const { mountAnimationFinished } = useMountAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, translateY: "-10px" }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 1.5,
      }}
    >
      <PageContainer>
        <Box
          className={container}
          display="flex"
          flex={1}
          flexDirection="column"
        >
          {content}

          {showPositions && (
            <Box flex={1} display="flex" flexDirection="column">
              <VirtualList
                ref={virtualListRef}
                data={listData}
                initialScrollTop={scrollTop}
                itemContent={(_, item) =>
                  item === "header" ? (
                    <ImportValidatorListItem
                      importValidators={importValidators}
                    />
                  ) : (
                    <PositionsListItem item={item} />
                  )
                }
              />
            </Box>
          )}
        </Box>
      </PageContainer>
    </motion.div>
  );
};
