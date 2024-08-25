import { Trigger } from "@radix-ui/react-dialog";
import { Box, CaretDownIcon, SelectModal, Text } from "@sk-widget/components";
import { pressAnimation } from "@sk-widget/components/atoms/button/styles.css";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { useActivityPageContext } from "@sk-widget/pages/details/activity-page/state/activiti-page.context";
import { SelectTokenListItem } from "@sk-widget/pages/details/earn-page/components/select-token-section/select-token-list-item";
import { useMemo } from "react";

export const SelectToken: React.FC = () => {
  const {
    defaultTokens,
    tokenSearch,
    onTokenSearch,
    onTokenSelect,
    selectedToken,
  } = useActivityPageContext();

  const data = useMemo(
    () => defaultTokens.map((i) => i).extract() ?? [],

    [defaultTokens]
  );

  if (!data) return null;

  return (
    <SelectModal
      title="Select Token"
      onSearch={onTokenSearch}
      searchValue={tokenSearch}
      trigger={
        <Trigger asChild>
          <Box
            width="full"
            as="button"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            background="backgroundMuted"
            borderRadius="2xl"
            px="3"
            py="2"
            className={pressAnimation}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
              <Text>
                {selectedToken ? selectedToken.token.symbol : "Token"}
              </Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
    >
      <VirtualList
        data={data}
        estimateSize={() => 60}
        itemContent={(_index, item) => (
          <SelectTokenListItem
            item={item}
            onTokenBalanceSelect={onTokenSelect}
            isConnected={false}
          />
        )}
      />
    </SelectModal>
  );
};
