import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Text } from "../../../components/atoms/typography/text";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { ZerionChainModal } from "../../../components/molecules/zerion-chain-modal";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { FallbackContent } from "../../../pages/details/positions-page/components/fallback-content";
import { usePositions } from "../../../pages/details/positions-page/hooks/use-positions";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { PositionsListItem } from "./components/positions-list-item";
import { PositionsSectionHeader } from "./components/positions-section-header";
import { useGroupedPositions } from "./hooks/use-grouped-positions";
import { container, positionsTitle } from "./styles.css";

export const PositionsPage = () => {
  useTrackPage("positions");

  const { positionsData, showPositions } = usePositions();

  const listData = useGroupedPositions(positionsData.data);

  const { isConnected, isConnecting } = useSKWallet();

  const { t } = useTranslation();
  const { variant } = useSettings();

  const content = useMemo(() => {
    if (positionsData.isLoading && positionsData.isFetching && isConnected) {
      return <FallbackContent type="spinner" />;
    }
    if (!isConnected && !isConnecting) {
      return (
        <Box
          display="flex"
          flex={1}
          justifyContent="center"
          alignItems="center"
        >
          <Text
            variant={{ weight: "medium", size: "large" }}
            textAlign="center"
          >
            {t("dashboard.details.positions_connect_wallet")}
          </Text>
        </Box>
      );
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
    t,
  ]);

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      {showPositions && (
        <>
          <Box
            my="1"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="1"
          >
            <Text
              className={combineRecipeWithVariant({
                rec: positionsTitle,
                variant,
              })}
            >
              {t("dashboard.details.my_positions")}
            </Text>

            {!!positionsData.data.length && (
              <Text variant={{ type: "muted", weight: "normal" }}>
                {t("dashboard.details.positions_active", {
                  count: positionsData.data.length,
                })}
              </Text>
            )}
          </Box>

          <Box flex={1} display="flex" flexDirection="column">
            <VirtualList
              estimateSize={() => 60}
              data={listData}
              itemContent={(_, row) =>
                row.kind === "chain-modal" ? (
                  <ZerionChainModal />
                ) : row.kind === "section" ? (
                  <PositionsSectionHeader
                    category={row.category}
                    count={row.count}
                  />
                ) : (
                  <PositionsListItem item={row.item} />
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
