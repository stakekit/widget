import { ProviderIcon } from "@sk-widget/components/atoms/token-icon/provider-icon";
import { minMaxContainer } from "@sk-widget/pages/details/earn-page/components/select-yield-section/styles.css";
import { useEarnPageContext } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import type { YieldTypesData } from "@sk-widget/pages/details/earn-page/types";
import { APToPercentage } from "@sk-widget/utils";
import { Just } from "purify-ts";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Box, SelectModalItem, Text } from "../../../../../components";
import { selectItemText } from "../../styles.css";

export const SelectYieldType = ({
  item,
}: {
  item: YieldTypesData[number];
}) => {
  const { onYieldTypeSelect } = useEarnPageContext();

  const { t } = useTranslation();
  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    // trackEvent("yieldSelected", { yield: item.id });
    onYieldTypeSelect(item.type);
    closeModal();
  };

  return (
    <SelectModalItem
      testId={`select-opportunity__item_${item.type}`}
      onItemClick={onItemClick}
    >
      <Box display="flex" flexDirection="column" flex={1} minWidth="0" gap="1">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
          <Text className={selectItemText} variant={{ weight: "bold" }}>
            {item.name}
          </Text>

          <Text>{`${APToPercentage(item.apy.toNumber())}%`}</Text>
        </Box>

        <Box
          display="flex"
          marginTop="1"
          flexWrap="wrap"
          gap="1"
          justifyContent="space-between"
          alignItems="flex-end"
        >
          <Box display="flex" alignItems="center" justifyContent="center">
            {item.yields.slice(0, 4).map((yieldItem) => (
              <ProviderIcon
                key={yieldItem.id}
                metadata={yieldItem.metadata}
                token={yieldItem.token}
              />
            ))}
          </Box>

          {Just([
            item.min
              .map((v) => `${t("shared.min")} ${v.toNumber()} ${item.symbol}`)
              .extractNullable(),
            item.max
              .map((v) => `${t("shared.max")} ${v.toNumber()} ${item.symbol}`)
              .extractNullable(),
          ] as const)
            .filter((val) => val.some(Boolean))
            .map(([min, max]) => (
              <Box
                display="flex"
                justifyContent="flex-end"
                alignItems="center"
                className={minMaxContainer}
              >
                <Text variant={{ type: "muted", size: "small" }}>
                  {min && max ? `${min} / ${max}` : (min ?? max)}
                </Text>
              </Box>
            ))
            .extractNullable()}
        </Box>
      </Box>
    </SelectModalItem>
  );
};
