import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import { Box } from "../../../shared/ui/primitives/box";
import { pressAnimation } from "../../../shared/ui/primitives/button/styles.css";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { useWidgetConfig } from "../../config/use-widget-config";
import { tab, tabBorder, tabContainer, tabText } from "./styles.css";

type Props = {
  readonly isSelected: boolean;
  readonly onTabPress: () => void;
  readonly variant:
    | "earn"
    | "stake"
    | "defi"
    | "rwa"
    | "borrow"
    | "manage"
    | "activity";
};

export const DashboardTab = ({ isSelected, variant, onTabPress }: Props) => {
  const { t } = useTranslation();
  const appVariant = useWidgetConfig("variant");

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: tabContainer,
        variant: appVariant,
      })}
    >
      <Box
        className={clsx([
          pressAnimation,
          combineRecipeWithVariant({
            rec: tab,
            state: isSelected ? "active" : undefined,
            variant: appVariant,
          }),
        ])}
        onClick={onTabPress}
      >
        <Text
          className={combineRecipeWithVariant({
            rec: tabText,
            state: isSelected ? "selected" : undefined,
            variant: appVariant,
          })}
          data-state={isSelected ? "selected" : "default"}
          variant={{ type: isSelected ? "regular" : "muted" }}
        >
          {t(`dashboard.details.tabs.${variant}`, variant)}
        </Text>
      </Box>

      {isSelected && appVariant === "finery" ? (
        <div className={tabBorder} />
      ) : null}
    </Box>
  );
};
