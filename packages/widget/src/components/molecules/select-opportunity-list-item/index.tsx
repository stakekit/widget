import type { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { getRewardRateFormatted } from "../../../utils/formatters";
import { Box } from "../../atoms/box";
import { SelectModalItem } from "../../atoms/select-modal";
import { ProviderIcon } from "../../atoms/token-icon/provider-icon";
import { Text } from "../../atoms/typography/text";
import { selectItemText } from "./styles.css";

export const SelectOpportunityListItem = ({
  item,
  onYieldSelect,
  testId,
}: {
  item: YieldDto;
  onYieldSelect: (item: YieldDto) => void;
  testId?: string;
}) => {
  const onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onYieldSelect(item);
    closeModal();
  };

  return (
    <SelectModalItem testId={testId} onItemClick={onItemClick}>
      <ProviderIcon metadata={item.metadata} token={item.token} />

      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        marginLeft="2"
        minWidth="0"
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          gap="2"
        >
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
