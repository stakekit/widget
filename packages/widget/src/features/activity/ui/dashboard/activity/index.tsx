import { Outlet, useNavigate } from "react-router";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../../shared/ui/primitives/icons/caret-left";
import { AnimationPage } from "../../../../widget-shell/animation-page";
import { ActivitySelectionProvider } from "../../../react/activity-selection-route";
import {
  useActivitySelection,
  useSetActivitySelection,
} from "../../../react/use-activity-selection";
import { ActivityPage } from "./activity.page";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  const variant = useWidgetConfig("variant");
  const navigate = useNavigate();
  const selection = useActivitySelection();
  const setActivitySelection = useSetActivitySelection();

  const showDetails = selection !== null;

  const onBack = () => {
    setActivitySelection(null);
    navigate("/activity");
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

            <ActivitySelectionProvider value={selection}>
              <Box
                className={combineRecipeWithVariant({
                  rec: activityDetailsContainer,
                  variant,
                })}
              >
                <Outlet />
              </Box>
            </ActivitySelectionProvider>
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
