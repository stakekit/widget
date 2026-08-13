import { useAtomValue } from "@effect/atom-react";
import { Outlet } from "react-router";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../../shared/ui/primitives/icons/caret-left";
import {
  activityResumeDashboardViewAtom,
  useAbandonActivityResume,
} from "../../../../classic-transaction-flow/state";
import { AnimationPage } from "../../../../widget-shell/components";
import { ActivityPage } from "./activity.page.tsx";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  const variant = useWidgetConfig("variant");
  const activityResume = useAtomValue(activityResumeDashboardViewAtom);
  const abandonActivityResume = useAbandonActivityResume();
  const showDetails = activityResume._tag === "Open";

  const onBack = () => {
    abandonActivityResume(undefined);
  };

  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        {showDetails ? (
          <>
            <Box
              as="button"
              onClick={onBack}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
            >
              <CaretLeftIcon />
            </Box>

            <Box
              className={combineRecipeWithVariant({
                rec: activityDetailsContainer,
                variant,
              })}
            >
              <Outlet />
            </Box>
          </>
        ) : (
          <Box display="flex" flex={1} flexDirection="column" width="full">
            <ActivityPage />
          </Box>
        )}
      </Box>
    </AnimationPage>
  );
};
