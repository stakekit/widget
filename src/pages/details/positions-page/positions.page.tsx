import { motion } from "framer-motion";
import { useMemo } from "react";
import { Box } from "../../../components";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useMountAnimation } from "../../../providers/mount-animation";
import { useSKWallet } from "../../../providers/sk-wallet";
import { PageContainer } from "../../components";
import { FallbackContent } from "./components/fallback-content";
import {
  ImportValidatorListItem,
  PositionsListItem,
} from "./components/positions-list-item";
import { usePositions } from "./hooks/use-positions";
import { container } from "./style.css";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsData, listData, importValidators, showPositions } =
    usePositions();

  const { isConnected, isConnecting } = useSKWallet();

  const content = useMemo(() => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return <FallbackContent type="spinner" />;
    }
    if (!isConnected && !isConnecting) {
      return <FallbackContent type="not_connected" />;
    }
    if (positionsData.isError && !positionsData.data.length) {
      return <FallbackContent type="something_wrong" />;
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
                data={listData}
                itemContent={(_, item) =>
                  item === "header" ? (
                    <>
                      <ZerionChainModal />

                      <ImportValidatorListItem
                        importValidators={importValidators}
                      />

                      {isConnected && !positionsData.data.length && (
                        <Box my="4">
                          <FallbackContent type="no_current_positions" />
                        </Box>
                      )}
                    </>
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
