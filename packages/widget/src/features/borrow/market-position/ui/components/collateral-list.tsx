import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../../../shared/ui/components/collapsible";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  type BorrowPositionAction,
  findBorrowCollateralToggleAction,
  type getBorrowPositionDetailsModel,
} from "../../model/details";
import { useBorrowCollateralToggleForm } from "../../react/use-action-form";
import * as styles from "../styles.css";

/** A toggle the Risk Gate blocks cannot start Review, so it renders disabled. */
const CollateralToggle = ({
  action,
  isCollateral,
  onActionSelect,
}: {
  readonly action: BorrowPositionAction;
  readonly isCollateral: boolean;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
}) => {
  const { t } = useTranslation();
  const form = useBorrowCollateralToggleForm(action);
  const riskBlock = form?.riskBlock ?? null;
  const blocked = form !== null && !form.canSubmit;

  return (
    <>
      <Box
        as="button"
        aria-checked={isCollateral}
        aria-label={action.label}
        className={clsx(
          styles.switchButton,
          isCollateral && styles.switchButtonChecked,
          blocked && styles.switchButtonDisabled
        )}
        data-rk={`borrow-collateral-toggle__${action.type}`}
        data-testid={`borrow-collateral-toggle__${action.type}`}
        disabled={blocked}
        onClick={(event) => {
          event.stopPropagation();
          onActionSelect(action);
        }}
        role="switch"
        type="button"
      >
        <Box
          className={clsx(
            styles.switchThumb,
            isCollateral && styles.switchThumbChecked
          )}
        />
      </Box>
      {riskBlock ? (
        <Box className={styles.collateralRowNote}>
          <Text variant={{ type: "danger", weight: "normal" }}>
            {t(
              `dashboard.borrow.position_details.validation.collateral_toggle_risk.${riskBlock}`
            )}
          </Text>
        </Box>
      ) : null}
    </>
  );
};

export const CollateralList = ({
  actions,
  items,
  onActionSelect,
  totalCollateralUsd,
}: {
  readonly actions: BorrowPositionAction[];
  readonly items: ReturnType<
    typeof getBorrowPositionDetailsModel
  >["collateralItems"];
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly totalCollateralUsd: string;
}) => {
  const { t } = useTranslation();

  if (items.length === 0) {
    return null;
  }

  return (
    <Box className={styles.collateralList}>
      <CollapsibleRoot initial={false}>
        <CollapsibleTrigger
          as="button"
          className={styles.collateralListButton}
          type="button"
        >
          <Text variant={{ weight: "bold" }}>
            {t("dashboard.borrow.position_details.collateral_list")}
          </Text>
          <CollapsibleArrow />
          <Box flex={1} textAlign="right">
            <Text variant={{ type: "muted", weight: "normal" }}>
              {totalCollateralUsd}
            </Text>
          </Box>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Box display="flex" flexDirection="column" gap="2">
            {items.map((item) => {
              const toggleAction = findBorrowCollateralToggleAction({
                actions,
                item,
              });

              return (
                <Box className={styles.collateralRow} key={item.id}>
                  <Box minWidth="0">
                    <Text variant={{ weight: "bold" }}>{item.label}</Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {item.supplyRate}
                    </Text>
                  </Box>

                  <Box minWidth="0" textAlign="right">
                    <Text>{item.balance}</Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {item.balanceUsd}
                    </Text>
                  </Box>

                  {toggleAction ? (
                    <CollateralToggle
                      action={toggleAction}
                      isCollateral={item.isCollateral}
                      onActionSelect={onActionSelect}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </CollapsibleContent>
      </CollapsibleRoot>
    </Box>
  );
};
