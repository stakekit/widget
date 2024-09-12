import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../components";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import {
  activeTabBorder,
  leftTabBorder,
  rewardsBadge,
  rightTabBorder,
  tab,
  tabBorder,
  tabContainer,
} from "../styles.css";

type Props = {
  isSelected: boolean;
  onTabPress: () => void;
} & (
  | { variant: "earn"; pendingActionsCount?: never }
  | { variant: "positions"; pendingActionsCount?: number }
);

export const Tab = ({
  isSelected,
  variant,
  pendingActionsCount,
  onTabPress,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box className={tabContainer}>
      <Box className={clsx([pressAnimation, tab])} onClick={onTabPress}>
        {!!pendingActionsCount && (
          <Box className={rewardsBadge}>
            <Text style={{ fontSize: 8 }}>{pendingActionsCount}</Text>
          </Box>
        )}
        <Box
          {...(variant === "positions" && { position: "relative" })}
          display="inline-flex"
        >
          <Text
            data-state={isSelected ? "selected" : "default"}
            variant={{ type: isSelected ? "regular" : "muted" }}
          >
            {variant === "earn"
              ? t("details.tab_earn")
              : t("details.tab_positions")}
          </Text>
        </Box>
      </Box>

      <Box
        className={clsx([
          tabBorder,
          isSelected
            ? activeTabBorder
            : variant === "earn"
              ? leftTabBorder
              : rightTabBorder,
        ])}
      />
    </Box>
  );
};
