import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { ToolTip } from "@sk-widget/components/atoms/tooltip";
import { Text } from "@sk-widget/components/atoms/typography/text";
import {
  type SummaryLabelContainerVariants,
  loader,
  loaderContainer,
  summaryItem,
  summaryLabel,
  summaryLabelContainer,
  summaryNumber,
} from "@sk-widget/components/molecules/summary-item/index.css";
import { enabledRewardsSummaryYieldNames } from "@sk-widget/domain/types/rewards";
import { useSettings } from "@sk-widget/providers/settings";
import { formatNumber } from "@sk-widget/utils";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import { useTranslation } from "react-i18next";

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

  const content = isLoading ? (
    <Box
      width="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      className={loaderContainer}
    >
      <ContentLoaderSquare
        containerClassName={loader}
        heightPx={40}
        variant={{ size: "medium" }}
      />
    </Box>
  ) : (
    <>
      {value && (
        <Text
          className={combineRecipeWithVariant({
            rec: summaryNumber,
            variant,
          })}
        >
          {value.gt(0) ? `$${formatNumber(value, 2)}` : "-"}
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
    </>
  );

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: summaryItem,
        variant,
        state: isLoading ? "isLoading" : undefined,
      })}
      background="background"
    >
      {content}
    </Box>
  );
};
