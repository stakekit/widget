import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { ContentLoaderLine } from "../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import {
  type BorrowPositionAction,
  isBorrowCollateralToggleAction,
} from "../model/details";
import { BorrowPositionBreadcrumb } from "./components/breadcrumb";
import { useBorrowPositionContext } from "./context";
import * as styles from "./styles.css";

export const BorrowPositionActionsPage = () => {
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

      <BorrowPositionActions
        actions={position ? actions : []}
        onActionSelect={onActionSelect}
      />
    </>
  );
};

const BorrowPositionActionCard = ({
  action,
  description,
  label,
  onClick,
}: {
  readonly action?: BorrowPositionAction;
  readonly description: ReactNode;
  readonly label: ReactNode;
  readonly onClick?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box className={styles.actionCard}>
      <Box display="flex" flex={1} flexDirection="column" gap="1" minWidth="0">
        <Text>{label}</Text>
        <Text variant={{ type: "muted", weight: "normal" }}>{description}</Text>
      </Box>
      <Button
        data-rk={action ? `borrow-position-action__${action.type}` : undefined}
        data-testid={
          action ? `borrow-position-action__${action.type}` : undefined
        }
        disabled={!action}
        onClick={onClick}
        variant={{ size: "small" }}
      >
        {t("dashboard.borrow.position_details.configure_action")}
      </Button>
    </Box>
  );
};

export const BorrowPositionActions = (
  props:
    | { readonly loading: true }
    | {
        readonly loading?: false;
        readonly actions: BorrowPositionAction[];
        readonly onActionSelect: (action: BorrowPositionAction) => void;
      }
) => {
  const { t } = useTranslation();

  return (
    <Box
      aria-busy={props.loading}
      display="flex"
      flexDirection="column"
      gap="3"
      marginTop="3"
    >
      <Text variant={{ weight: "bold" }}>
        {t("dashboard.borrow.position_details.actions_title")}
      </Text>
      {props.loading && (
        // Available actions depend on the position's permissions.
        <BorrowPositionActionCard
          description={<ContentLoaderLine />}
          label={<ContentLoaderLine widthPx="min(10ch, 100%)" />}
        />
      )}
      {!props.loading && props.actions.length === 0 && (
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.borrow.position_details.no_actions")}
        </Text>
      )}
      {!props.loading &&
        props.actions.map((action) => (
          <BorrowPositionActionCard
            action={action}
            description={t(
              `dashboard.borrow.position_details.action_descriptions.${action.type}`
            )}
            key={action.id}
            label={action.label}
            onClick={() => props.onActionSelect(action)}
          />
        ))}
    </Box>
  );
};
