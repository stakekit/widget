import { Maybe } from "purify-ts";
import { Outlet, useNavigate } from "react-router";
import { Box } from "../../components/atoms/box";
import { CaretLeftIcon } from "../../components/atoms/icons/caret-left";
import { AnimationPage } from "../../navigation/containers/animation-page";
import {
  useActivitySelectedAction,
  useSetActivitySelection,
} from "../../providers/activity-provider";
import { useSettings } from "../../providers/settings";
import { combineRecipeWithVariant } from "../../utils/styles";
import { ActivityPage } from "./activity.page";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  const { variant } = useSettings();
  const navigate = useNavigate();
  const selectedAction = useActivitySelectedAction();
  const setActivitySelection = useSetActivitySelection();

  const showDetails = selectedAction.isJust();

  const onBack = () => {
    setActivitySelection(Maybe.empty());
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
