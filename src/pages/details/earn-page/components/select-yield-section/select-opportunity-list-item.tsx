import { List, Maybe } from "purify-ts";
import { Box, SelectModalItem, Text } from "../../../../../components";
import { TokenIcon } from "../../../../../components/atoms/token-icon";
import { useDetailsContext } from "../../state/details-context";
import { YieldDto } from "@stakekit/api-hooks";
import { selectItemText } from "../../styles.css";
import { apyToPercentage } from "../../../../../utils";
import { useTrackEvent } from "../../../../../hooks/tracking/use-track-event";

export const SelectOpportunityListItem = ({
  item,
  index,
}: {
  item: YieldDto;
  index: number;
}) => {
  const { onYieldSelect } = useDetailsContext();

  const trackEvent = useTrackEvent();

  const onItemClick = () => {
    trackEvent("yieldSelected", { yield: item.metadata.name });
    onYieldSelect(item.id);
  };

  return (
    <SelectModalItem
      testId={`select-opportunity__item_${item.id}-${index}`}
      onItemClick={onItemClick}
    >
      <TokenIcon
        metadata={item.metadata}
        token={Maybe.fromNullable(item.metadata.rewardTokens)
          .chain((rt) => List.head(rt))
          .orDefault(item.token)}
      />

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
            <Text>{apyToPercentage(item.apy)}%</Text>
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
