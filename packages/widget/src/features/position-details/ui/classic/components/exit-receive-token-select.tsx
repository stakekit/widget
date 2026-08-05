import { useTranslation } from "react-i18next";
import type { TokenAddress } from "../../../../../domain/schema/identifiers";
import { formatAddress } from "../../../../../shared/lib/general";
import { Dropdown } from "../../../../../shared/ui/components/dropdown";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import type { PositionDetailsExitReceiveTokenSelection } from "../../../model/exit-receive-token";

const formatTokenLabel = ({
  address,
  symbol,
}: PositionDetailsExitReceiveTokenSelection["selected"]) => {
  const formattedAddress = formatAddress(address, {
    leadingChars: 6,
    trailingChars: 4,
  });

  return symbol === address
    ? formattedAddress
    : `${symbol} · ${formattedAddress}`;
};

export const ExitReceiveTokenSelect = ({
  onSelect,
  selection,
}: {
  readonly onSelect: (address: TokenAddress) => void;
  readonly selection: PositionDetailsExitReceiveTokenSelection;
}) => {
  const { t } = useTranslation();
  const options = selection.options.map((token) => ({
    label: formatTokenLabel(token),
    value: token.address,
  }));
  const selectedOption = {
    label: formatTokenLabel(selection.selected),
    value: selection.selected.address,
  };

  return (
    <Box
      data-testid="position-details-exit-receive-token"
      display="flex"
      flexDirection="column"
      gap="2"
    >
      <Text>{t("position_details.receive_token.label")}</Text>
      <Dropdown
        onSelect={onSelect}
        options={options}
        placeholder={t("position_details.receive_token.label")}
        selectedOption={selectedOption}
      />
    </Box>
  );
};
