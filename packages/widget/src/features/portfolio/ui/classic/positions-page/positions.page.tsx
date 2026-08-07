import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { motion } from "motion/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMountAnimation } from "../../../../mount-animation/state";
import { useTrackPage } from "../../../../tracking/state";
import { useSKWallet } from "../../../../wallet/state";
import { ZerionChainModal } from "../../../../wallet/ui";
import {
  FallbackContent,
  PageContainer,
} from "../../../../widget-shell/components";
import { usePositions } from "../../../react/use-positions";
import { PositionsListItem } from "./components/positions-list-item";
import { container } from "./style.css";

const PositionsPage = () => {
  useTrackPage("positions");

  const { positions, positionsResult, listData, showPositions } =
    usePositions();

  const { isConnected, isConnecting } = useSKWallet();

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

export const AnimatedPositionsPage = () => {
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
        <PositionsPage />
      </PageContainer>
    </motion.div>
  );
};
