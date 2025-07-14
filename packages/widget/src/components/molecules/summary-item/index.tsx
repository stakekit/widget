import { useTranslation } from "react-i18next";
import { enabledRewardsSummaryYieldNames } from "../../../domain/types/rewards";
import { useSettings } from "../../../providers/settings";
import { formatNumber } from "../../../utils";
import { combineRecipeWithVariant } from "../../../utils/styles";
import { Box } from "../../atoms/box";
import { InfoIcon } from "../../atoms/icons/info";
import { Spinner } from "../../atoms/spinner";
import { ToolTip } from "../../atoms/tooltip";
import { Text } from "../../atoms/typography/text";
import {
  type SummaryLabelContainerVariants,
  summaryItem,
  summaryLabel,
  summaryLabelContainer,
  summaryNumber,
} from "./index.css";

export const SummaryItem = ({
  label,
  value,
  isLoading,
  type,
}: {
  label: string;
  value: BigNumber | undefined;
  isLoading: boolean;
  type: NonNullable<SummaryLabelContainerVariants>["type"];
}) => {
  const { variant } = useSettings();

  const { t } = useTranslation();

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: summaryItem,
        variant,
      })}
      background="background"
    >
      {isLoading ? (
        <Spinner variant={{ size: "small" }} />
      ) : (
        <Text
          className={combineRecipeWithVariant({
            rec: summaryNumber,
            variant,
          })}
        >
          {value?.gt(0) ? `$${formatNumber(value, 3)}` : "-"}
        </Text>
      )}

      <Box display="flex" alignItems="center" justifyContent="center" gap="1">
        {type === "rewards" && (
          <ToolTip
            maxWidth={300}
            label={
              value?.isEqualTo(0) ? (
                t("dashboard.summary_item.rewards_summary_zero_tooltip")
              ) : (
                <Box display="flex" flexDirection="column" gap="1">
                  <Text variant={{ type: "white" }}>
                    {t(
                      "dashboard.summary_item.rewards_summary_current_enabled_tooltip"
                    )}
                  </Text>

                  <Text variant={{ type: "white" }}>
                    <ul style={{ paddingLeft: "15px" }}>
                      {enabledRewardsSummaryYieldNames.map((v) => (
                        <li style={{ marginTop: "5px" }} key={v}>
                          {t(v)}
                        </li>
                      ))}
                    </ul>
                  </Text>
                </Box>
              )
            }
          >
            <InfoIcon />
          </ToolTip>
        )}
        <Box
          py="1"
          px="1"
          background="backgroundMuted"
          className={combineRecipeWithVariant({
            rec: summaryLabelContainer,
            variant,
            type,
          })}
        >
          <Text
            className={combineRecipeWithVariant({
              rec: summaryLabel,
              variant,
            })}
          >
            {label}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
