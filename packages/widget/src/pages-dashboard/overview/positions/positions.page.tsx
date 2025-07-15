import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { InfoIcon } from "../../../components/atoms/icons/info";
import { ToolTip } from "../../../components/atoms/tooltip";
import { Text } from "../../../components/atoms/typography/text";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { FallbackContent } from "../../../pages/details/positions-page/components/fallback-content";
import { usePositions } from "../../../pages/details/positions-page/hooks/use-positions";
import { useSKWallet } from "../../../providers/sk-wallet";
import { PositionsListItem } from "./components/positions-list-item";
import { container, headerContainer } from "./styles.css";

export const PositionsPage = () => {
  useTrackPage("positions");

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

  const { t } = useTranslation();

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      {showPositions && (
        <>
          <Box my="1" display="flex" alignItems="center" gap="1">
            <Text variant={{ size: "medium" }}>Positions</Text>

            <ToolTip
              maxWidth={300}
              label={t("dashboard.details.positions_tooltip")}
            >
              <InfoIcon />
            </ToolTip>
          </Box>

          <Box flex={1} display="flex" flexDirection="column">
            <THead />

            <VirtualList
              estimateSize={() => 60}
              data={listData}
              itemContent={(_, item) =>
                item === "header" ? (
                  <ZerionChainModal />
                ) : (
                  <PositionsListItem item={item} />
                )
              }
            />

            {isConnected && !positionsData.data.length && (
              <Box my="4">
                <FallbackContent type="no_current_positions" />
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

function THead() {
  const { t } = useTranslation();

  return (
    <Box
      className={headerContainer}
      display="flex"
      alignItems="center"
      py="1"
      gap="1"
    >
      <Text flex={5}>{t("dashboard.details.positions_yield")}</Text>
      <Text flex={3}>{t("dashboard.details.positions_reward_rate")}</Text>
      <Text flex={2}>{t("dashboard.details.positions_amount")}</Text>
    </Box>
  );
}
