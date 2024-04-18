import { Maybe } from "purify-ts";
import { Box, SelectModalItem, Text } from "../../../../../components";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { useDetailsContext } from "../../state/details-context";
import type { YieldDto } from "@stakekit/api-hooks";
import { selectItemText } from "../../styles.css";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";
import { getRewardRateFormatted } from "../../../../../utils/formatters";
import type { ComponentProps } from "react";

export const SelectOpportunityListItem = ({
  item,
  index,
}: {
  item: YieldDto;
  index: number;
}) => {
  const { onYieldSelect } = useDetailsContext();

  const trackEvent = useTrackEvent();

  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    trackEvent("yieldSelected", { yield: item.id });
    onYieldSelect(item.id);
    closeModal();
  };

  return (
    <SelectModalItem
      testId={`select-opportunity__item_${item.id}-${index}`}
      onItemClick={onItemClick}
    >
      <TokenIcon metadata={item.metadata} token={item.token} />

      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        marginLeft="2"
        minWidth="0"
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Text className={selectItemText} variant={{ weight: "bold" }}>
              {item.metadata.name}
            </Text>
          </Box>

          <Box>
            <Text>
              {getRewardRateFormatted({
                rewardRate: item.rewardRate,
                rewardType: item.rewardType,
              })}
            </Text>
          </Box>
        </Box>

        <Box display="flex" marginTop="1" flexWrap="wrap" gap="1">
          <Text variant={{ type: "muted" }}>
            {Maybe.fromNullable(item.metadata.rewardTokens)
              .map((rt) => rt.map((t) => t.symbol).join(", "))
              .orDefault(item.token.symbol)}
          </Text>

          {Maybe.fromNullable(item.metadata.rewardTokens)
            .map(() => (
              <Box background="background" borderRadius="2xl" px="2">
                <Text variant={{ type: "muted" }}>{item.token.symbol}</Text>
              </Box>
            ))
            .extractNullable()}
        </Box>
      </Box>
    </SelectModalItem>
  );
};
