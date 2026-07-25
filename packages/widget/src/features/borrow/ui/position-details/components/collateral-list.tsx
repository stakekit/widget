import clsx from "clsx";
import { useState } from "react";
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
} from "../../../model/position-details-model";
import * as styles from "../../styles.css";

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
  const [expanded, setExpanded] = useState(items.length <= 1);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box className={styles.collateralList}>
      <CollapsibleRoot
        collapsed={!expanded}
        onClick={() => setExpanded((value) => !value)}
      >
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
                    <Box
                      as="button"
                      aria-label={toggleAction.label}
                      className={clsx(
                        styles.switchButton,
                        item.isCollateral && styles.switchButtonChecked
                      )}
                      onClick={() => onActionSelect(toggleAction)}
                      type="button"
                    >
                      <Box
                        className={clsx(
                          styles.switchThumb,
                          item.isCollateral && styles.switchThumbChecked
                        )}
                      />
                    </Box>
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
