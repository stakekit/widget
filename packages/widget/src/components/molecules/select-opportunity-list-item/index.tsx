import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { YieldBase } from "../../../domain/types/yields";
import {
  capitalizeFirstLetters,
  getRewardRateFormatted,
  getRewardTypeFormatted,
} from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { SelectModalItem } from "../../atoms/select-modal";
import { ProviderIcon } from "../../atoms/token-icon/provider-icon";
import { Text } from "../../atoms/typography/text";
import {
  itemSubtitle,
  rewardRateLabel,
  rewardRateText,
  selectItemText,
} from "./styles.css";

type SelectOpportunityListItemProps<T extends YieldBase> = {
  item: T;
  onYieldSelect: (item: T) => void;
  testId?: string;
  selected?: boolean;
};

export const SelectOpportunityListItem = <T extends YieldBase>({
  item,
  onYieldSelect,
  testId,
  selected,
}: SelectOpportunityListItemProps<T>) => {
  const { t } = useTranslation();

  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onYieldSelect(item);
    closeModal();
  };

  const provider = item.provider;

  const rateFormatted = getRewardRateFormatted({
    rewardRate: item.rewardRate.total,
  });
  const rateTypeLabel = getRewardTypeFormatted(item.rewardRate.rateType);

  const subtitle = provider?.name
    ? t("details.opportunity_item_subtitle_no_network", {
        provider: provider.name,
      })
    : capitalizeFirstLetters(item.token.network);

  return (
    <SelectModalItem
      testId={testId}
      onItemClick={onItemClick}
      selected={selected}
    >
      <ProviderIcon
        metadata={{
          logoURI: item.metadata.logoURI,
          name: item.metadata.name,
          provider,
        }}
        token={item.token as Parameters<typeof ProviderIcon>[0]["token"]}
      />

      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        marginLeft="2"
        minWidth="0"
        gap="1"
      >
        <Text className={selectItemText} variant={{ weight: "bold" }}>
          {item.metadata.name}
        </Text>

        <Text
          className={itemSubtitle}
          variant={{ type: "muted", weight: "normal", size: "small" }}
        >
          {subtitle}
        </Text>
      </Box>

      <Box
        textAlign="end"
        flexShrink={0}
        marginLeft="2"
        gap="1"
        display="flex"
        flexDirection="column"
      >
        <Text className={rewardRateText}>{rateFormatted}</Text>

        {rateTypeLabel && (
          <Text
            className={rewardRateLabel}
            variant={{ type: "muted", weight: "normal", size: "small" }}
          >
            {rateTypeLabel}
          </Text>
        )}
      </Box>
    </SelectModalItem>
  );
};
