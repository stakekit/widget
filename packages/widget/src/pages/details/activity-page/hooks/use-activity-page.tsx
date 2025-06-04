import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import { useActivityPageContext } from "@sk-widget/pages/details/activity-page/state/activity-page.context";
import { FallbackContent } from "@sk-widget/pages/details/positions-page/components/fallback-content";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useMemo } from "react";

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
