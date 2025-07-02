import { useMemo } from "react";
import { Box } from "../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
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

  const content = useMemo(() => {
    if (!isConnected && !isConnecting) {
      return <FallbackContent type="not_connected" />;
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
