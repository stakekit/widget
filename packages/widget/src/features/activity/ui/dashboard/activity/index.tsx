import { Outlet, useNavigate } from "react-router";
import { useWidgetConfig } from "../../../../../app/config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../../shared/ui/primitives/icons/caret-left";
import { AnimationPage } from "../../../../widget-shell";
import {
  useActivitySelectedAction,
  useSetActivitySelection,
} from "../../../react/use-activity-selection";
import { ActivityPage } from "./activity.page";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  const variant = useWidgetConfig("variant");
  const navigate = useNavigate();
  const selectedAction = useActivitySelectedAction();
  const setActivitySelection = useSetActivitySelection();

  const showDetails = selectedAction !== null;

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
