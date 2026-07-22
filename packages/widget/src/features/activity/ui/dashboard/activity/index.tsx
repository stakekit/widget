import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Outlet, useNavigate } from "react-router";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CaretLeftIcon } from "../../../../../shared/ui/primitives/icons/caret-left";
import { classicFlowSessionStore } from "../../../../classic-transaction-flow/session";
import { AnimationPage } from "../../../../widget-shell/animation-page";
import { ActivityPage } from "./activity.page";
import { activityDetailsContainer } from "./styles.css";

export const ActivityTabPage = () => {
  const variant = useWidgetConfig("variant");
  const navigate = useNavigate();
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const clearSession = useAtomSet(classicFlowSessionStore.clearAtom);
  const selection =
    session?.intake._tag === "ActivityResume" ? session.intake : null;

  const showDetails = selection !== null;

  const onBack = () => {
    if (session && selection) clearSession(session.epoch);
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
