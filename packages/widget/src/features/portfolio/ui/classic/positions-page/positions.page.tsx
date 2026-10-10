import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useMemo } from "react";
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

  const { positions, positionsResult, listData, showPositions } =
    usePositions();

  const wallet = useSKWallet();
  const isConnected = wallet?.status === "connected";
  const isConnecting = wallet === null || wallet.status === "connecting";

  const { t } = useTranslation();

  const content = useMemo(() => {
    if (
      AsyncResult.isInitial(positionsResult) &&
      positionsResult.waiting &&
      isConnected
    ) {
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
    if (AsyncResult.isFailure(positionsResult) && !positions.length) {
      return <FallbackContent type="something_wrong" />;
    }

    return null;
  }, [isConnected, isConnecting, positions.length, positionsResult, t]);

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

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
