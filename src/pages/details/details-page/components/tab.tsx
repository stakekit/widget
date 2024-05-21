import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../components";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import {
  activeTabBorder,
  leftTabBorder,
  rewardsDot,
  rightTabBorder,
  tab,
  tabBorder,
  tabContainer,
} from "../styles.css";

type Props = {
  isSelected: boolean;
  onTabPress: () => void;
} & (
  | { variant: "earn"; hasPendingRewards?: never }
  | { variant: "positions"; hasPendingRewards: boolean }
);

export const Tab = ({
  isSelected,
  variant,
  hasPendingRewards,
  onTabPress,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Box className={tabContainer}>
      <Box className={clsx([pressAnimation, tab])} onClick={onTabPress}>
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

          {hasPendingRewards && (
            <Box
              borderRadius="full"
              width="1"
              height="1"
              background="positionsClaimRewardsBackground"
              className={rewardsDot}
            />
          )}
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
