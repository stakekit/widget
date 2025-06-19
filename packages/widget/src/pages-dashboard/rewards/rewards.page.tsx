import { Box } from "@sk-widget/components/atoms/box";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { ZerionChainModal } from "@sk-widget/components/molecules/zerion-chain-modal";
import { PositionsListItem } from "@sk-widget/pages-dashboard/rewards/components/positions-list-item";
import { FallbackContent } from "@sk-widget/pages/details/positions-page/components/fallback-content";
import { usePositions } from "@sk-widget/pages/details/positions-page/hooks/use-positions";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useMemo } from "react";
import { container, headerContainer } from "./styles.css";

export const RewardsPage = () => {
  const { positionsData, listData, showPositions } = usePositions();

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

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      {showPositions && (
        <Box flex={1} display="flex" flexDirection="column">
          <THead />

          <VirtualList
            estimateSize={() => 60}
            data={listData}
            itemContent={(_, item) =>
              item === "header" ? (
                <>
                  <ZerionChainModal />

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
  );
};

function THead() {
  return (
    <Box
      className={headerContainer}
      display="flex"
      alignItems="center"
      py="1"
      gap="1"
    >
      <Text flex={5}>Yield</Text>
      <Text flex={3}>Reward Rate</Text>
      <Text flex={2}>Rewards</Text>
    </Box>
  );
}
