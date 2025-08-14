import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Text } from "../../../../components/atoms/typography/text";
import { useTrackPage } from "../../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { FallbackContent } from "../../positions-page/components/fallback-content";
import { useActivityPageContext } from "../state/activity-page.context";

export const useActivityPage = () => {
  useTrackPage("activity");

  const { isConnected, isConnecting } = useSKWallet();

  const { activityActions, onActionSelect, labels, counts, bulletLines } =
    useActivityPageContext();

  const allData = activityActions.allItems;

  const { t } = useTranslation();

  const content = useMemo(() => {
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
            {t("dashboard.details.activity_connect_wallet")}
          </Text>
        </Box>
      );
    }

    if (isConnected && !allData?.length && !activityActions.isPending) {
      return (
        <Box my="4">
          <FallbackContent type="no_previous_activity" />
        </Box>
      );
    }

    if (
      isConnected &&
      activityActions.isPending &&
      !activityActions.isFetchingNextPage
    ) {
      return (
        <Box display="flex" gap="1" flexDirection="column">
          {[...Array(5).keys()].map((item) => (
            <ContentLoaderSquare key={item} heightPx={60} />
          ))}
        </Box>
      );
    }

    return null;
  }, [
    isConnected,
    isConnecting,
    allData,
    activityActions.isPending,
    activityActions.isFetchingNextPage,
    t,
  ]);

  return {
    content,
    onActionSelect,
    labels,
    counts,
    bulletLines,
    allData,
    activityActions,
  };
};
