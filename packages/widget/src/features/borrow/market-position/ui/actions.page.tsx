import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../model/details";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { useBorrowPositionContext } from "./context";
import * as styles from "./styles.css";

export const BorrowPositionActionsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    actions: positionActions,
    model,
    position,
  } = useBorrowPositionContext();
  const actions = positionActions.filter(
    (action) => !isBorrowCollateralToggleAction(action)
  );

  const onActionSelect = (action: BorrowPositionAction) =>
    navigate(`action/${action.id}`);

  return (
    <>
      <BorrowPositionBreadcrumb positionName={model?.title ?? null} />

      <Box display="flex" flexDirection="column" gap="3" marginTop="3">
        <Text variant={{ weight: "bold" }}>
          {t("dashboard.borrow.position_details.actions_title")}
        </Text>

        {!position || actions.length === 0 ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.position_details.no_actions")}
          </Text>
        ) : (
          actions.map((action) => (
            <Box className={styles.actionCard} key={action.id}>
              <Box display="flex" flexDirection="column" gap="1">
                <Text>{action.label}</Text>
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {t(
                    `dashboard.borrow.position_details.action_descriptions.${action.type}`
                  )}
                </Text>
              </Box>
              <Button
                data-rk={`borrow-position-action__${action.type}`}
                data-testid={`borrow-position-action__${action.type}`}
                onClick={() => onActionSelect(action)}
                variant={{ size: "small" }}
              >
                {t("dashboard.borrow.position_details.configure_action")}
              </Button>
            </Box>
          ))
        )}
      </Box>
    </>
  );
};
