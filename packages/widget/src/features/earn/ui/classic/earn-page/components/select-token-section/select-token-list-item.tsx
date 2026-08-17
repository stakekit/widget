import type { ComponentProps } from "react";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../../../shared/ui/components/select-modal";
import { TokenIcon } from "../../../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import type { EarnTokenOption } from "../../../../../state/earn-selection";
import { selectItemText } from "../../styles.css";

type Props = {
  item: EarnTokenOption;
  isSelected: boolean;
  onTokenBalanceSelect: (tokenBalance: EarnTokenOption) => void;
};

export const SelectTokenListItem = ({
  item,
  isSelected,
  onTokenBalanceSelect,
}: Props) => {
  const _onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onTokenBalanceSelect(item);
    closeModal();
  };

  return (
    <SelectModalItemContainer>
      <SelectModalItem
        selected={isSelected}
        variant={{ type: "enabled", hover: "enabled" }}
        onItemClick={_onItemClick}
      >
        <TokenIcon token={item.token} />

        <Box
          display="flex"
          flex={1}
          justifyContent="space-between"
          alignItems="center"
          marginLeft="2"
          minWidth="0"
          gap="2"
        >
          <Box display="flex" flexDirection="column" minWidth="0" gap="1">
            <Text className={selectItemText} variant={{ weight: "bold" }}>
              {item.token.symbol}
            </Text>

            <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
              {item.token.name}
            </Text>
          </Box>
        </Box>
      </SelectModalItem>
    </SelectModalItemContainer>
  );
};
