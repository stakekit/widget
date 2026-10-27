import { useTranslation } from "react-i18next";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../../tracking/index";
import { useSKWallet } from "../../../../wallet/index";
import { ZerionChainModal } from "../../../../wallet/views";
import {
  FallbackContent,
  MountAnimatedPage,
} from "../../../../widget-shell/views";
import { usePositions } from "../../../react/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { container } from "./style.css";

const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsView, listData, showPositions } = usePositions();

  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet === null || wallet.status === "connecting";

  const { t } = useTranslation();

  const renderContent = () => {
    if (positionsView._tag === "Loading" && isConnected) {
      return <FallbackContent type="spinner" />;
    }
    if (!isConnected && !isConnecting) {
      return (
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          justifyContent="flex-end"
        >
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
              {t("positions.connect_wallet_manage")}
            </Text>
          </Box>

          <FallbackContent type="not_connected" />
        </Box>
      );
    }
    if (positionsView._tag === "Failed") {
      return <FallbackContent type="something_wrong" />;
    }

    return null;
  };

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {renderContent()}

      {showPositions && (
        <Box flex={1} display="flex" flexDirection="column">
          <VirtualList
            estimateSize={() => 60}
            data={listData}
            itemContent={(_, item) =>
              item === "header" ? (
                <>
                  <ZerionChainModal />

                  {isConnected && !positions.length && (
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

export const AnimatedPositionsPage = () => (
  <MountAnimatedPage>
    <PositionsPage />
  </MountAnimatedPage>
);
