import clsx from "clsx";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../components";
import { pressAnimation } from "../../../../components/atoms/button/styles.css";
import { rewardsBadge, tab, tabBorder, tabContainer } from "../styles.css";

type Props = {
  isSelected: boolean;
  onTabPress: () => void;
} & (
  | { variant: "earn"; pendingActionsCount?: never }
  | { variant: "positions"; pendingActionsCount?: number }
  | { variant: "activity"; pendingActionsCount?: never }
);

export const Tab = ({
  isSelected,
  variant,
  pendingActionsCount,
  onTabPress,
}: Props) => {
  const { t } = useTranslation();

  console.log({ isSelected, variant });

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
            {t(`details.tabs.${variant}`, variant)}
          </Text>

          {!!pendingActionsCount && (
            <Box className={rewardsBadge}>
              <Text style={{ fontSize: 8 }}>{pendingActionsCount}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {isSelected ? (
        <motion.div
          className={tabBorder}
          layoutId="underline"
          transition={{ duration: 0.15 }}
        />
      ) : null}
    </Box>
  );
};
