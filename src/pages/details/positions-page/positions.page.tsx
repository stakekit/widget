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
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useHandleListState } from "../../../providers/list-state";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsData, importValidators } = usePositions();

  const { isConnected } = useSKWallet();

  const getContent = () => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return <FallbackContent type="spinner" />;
    } else if (!isConnected) {
      return <FallbackContent type="not_connected" />;
    } else if (positionsData.isError) {
      return <FallbackContent type="something_wrong" />;
    } else if (isConnected && !positionsData.data?.length) {
      return <FallbackContent type="no_current_positions" />;
    }

    return null;
  };

  const showPositions =
    isConnected &&
    (!!positionsData.data.length ||
      (!positionsData.isLoading && !positionsData.isError));

  const data = useMemo(
    () => ["header" as const, ...positionsData.data],
    [positionsData.data]
  );

  const { scrollTop, virtualListRef } = useHandleListState();

  return (
    <PageContainer>
      <Box display="flex" flex={1} flexDirection="column">
        {getContent()}

        {showPositions && (
          <Box flex={1} display="flex" flexDirection="column">
            <VirtualList
              ref={virtualListRef}
              data={data}
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
  );
};
