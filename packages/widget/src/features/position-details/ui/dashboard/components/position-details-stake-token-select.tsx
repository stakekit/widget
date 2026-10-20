import { useTranslation } from "react-i18next";
import { type Token, tokenString } from "../../../../../domain/token/token";
import { formatTokenAmount } from "../../../../../shared/lib/number-format";
import {
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../shared/ui/components/select-modal";
import {
  SelectedToken,
  SelectTokenTrigger,
} from "../../../../../shared/ui/components/selected-token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import type { PositionStakeTokenOption } from "../../../model/stake-token";
import { TokenOptionRow } from "../../components/token-option-row";

export const PositionDetailsStakeTokenSelect = ({
  onSelect,
  options,
  selectable,
  token,
}: {
  readonly onSelect: (token: Token) => void;
  readonly options: ReadonlyArray<PositionStakeTokenOption>;
  readonly selectable: boolean;
  readonly token: Token;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (!selectable) return <SelectedToken token={token} />;

  return (
    <SelectModal
      title={t("select_token.title")}
      trigger={
        <SelectTokenTrigger
          testId="position-details-stake-token"
          token={token}
        />
      }
    >
      <Box>
        {options.map((option) => (
          <SelectModalItemContainer key={tokenString(option.token)}>
            <SelectModalItem
              testId={`position-details-stake-token-${option.token.symbol}`}
              selected={option.selected}
              onItemClick={({ closeModal }) => {
                onSelect(option.token);
                closeModal();
              }}
            >
              <TokenOptionRow
                detail={option.token.name}
                token={option.token}
                trailing={
                  option.amount?.isGreaterThan(0) ? (
                    <Text variant={{ weight: "normal" }}>
                      {formatTokenAmount(option.amount, locale, "down")}
                    </Text>
                  ) : null
                }
              />
            </SelectModalItem>
          </SelectModalItemContainer>
        ))}
      </Box>
    </SelectModal>
  );
};
