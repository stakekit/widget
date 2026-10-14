import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../../../../../shared/lib/number-format";
import {
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../../../shared/ui/components/select-modal";
import { TokenIcon } from "../../../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../../../shared/ui/widget-presentation";
import type { EarnTokenSelectionItem } from "../../../../../state/token-selection";
import { selectItemText } from "../../styles.css";

type Props = {
  item: EarnTokenSelectionItem;
  isSelected: boolean;
  onTokenBalanceSelect: (tokenBalance: EarnTokenSelectionItem) => void;
};

export const SelectTokenListItem = ({
  item,
  isSelected,
  onTokenBalanceSelect,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const _onItemClick: ComponentProps<typeof SelectModalItem>["onItemClick"] = ({
    closeModal,
  }) => {
    onTokenBalanceSelect(item);
    closeModal();
  };

  const yieldsCount = t("select_token.yields_count", {
    count: item.availableYields.length,
  });

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

          <Box
            display="flex"
            flexDirection="column"
            alignItems="flex-end"
            flexShrink={0}
            gap="1"
          >
            {item.fundedAmount && (
              <Text variant={{ weight: "normal" }}>
                {formatTokenAmount(item.fundedAmount, locale)}
              </Text>
            )}
            <Text variant={{ type: "muted", weight: "normal", size: "small" }}>
              {item.fundedUsd
                ? `${formatUsd(item.fundedUsd, locale)} · ${yieldsCount}`
                : yieldsCount}
            </Text>
          </Box>
        </Box>
      </SelectModalItem>
    </SelectModalItemContainer>
  );
};
