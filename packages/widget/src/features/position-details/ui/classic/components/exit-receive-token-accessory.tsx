import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { TokenAddress } from "../../../../../domain/identity/identifiers";
import type { Token } from "../../../../../domain/token/token";
import {
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../shared/ui/components/select-modal";
import {
  SelectedToken,
  SelectTokenTrigger,
} from "../../../../../shared/ui/components/selected-token";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../tracking/index";
import {
  buildExitReceiveTokensByAddress,
  equalExitReceiveTokenAddresses,
  type PositionDetailsExitReceiveTokenSelection,
  projectExitReceiveTokenOption,
  resolveExitReceiveTokenAccessory,
} from "../../../model/exit-receive-token";

export const ExitReceiveTokenAccessory = ({
  integration,
  onSelect,
  positionToken,
  selection,
}: {
  readonly integration: EarnYieldWithProvider;
  readonly onSelect: (address: TokenAddress) => void;
  readonly positionToken: Token;
  readonly selection: PositionDetailsExitReceiveTokenSelection | null;
}) => {
  const { t } = useTranslation();
  const trackEvent = useTrackEvent();
  const [search, setSearch] = useState("");

  const tokensByAddress = buildExitReceiveTokensByAddress(integration);
  const accessory = resolveExitReceiveTokenAccessory({
    positionToken,
    selection,
    tokensByAddress,
  });

  if (!selection || accessory._tag === "Static") {
    return (
      <SelectedToken
        testId="position-details-exit-receive-token"
        token={accessory.token}
      />
    );
  }

  const options = selection.options.map((option) =>
    projectExitReceiveTokenOption({
      option,
      positionToken,
      tokensByAddress,
    })
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(
        (option) =>
          option.symbol.toLowerCase().includes(normalizedSearch) ||
          option.address.toLowerCase().includes(normalizedSearch) ||
          option.formattedAddress.toLowerCase().includes(normalizedSearch)
      )
    : options;

  return (
    <SelectModal
      title={t("position_details.receive_token.select_title")}
      onOpen={() => trackEvent("exitReceiveTokenModalOpened")}
      trigger={
        <SelectTokenTrigger
          testId="position-details-exit-receive-token"
          token={accessory.token}
        />
      }
      onSearch={setSearch}
      searchValue={search}
      onClose={() => setSearch("")}
    >
      <Box>
        {filteredOptions.map((option) => (
          <SelectModalItemContainer key={option.address}>
            <SelectModalItem
              selected={equalExitReceiveTokenAddresses(
                option.address,
                selection.selected.address
              )}
              onItemClick={({ closeModal }) => {
                onSelect(option.address);
                closeModal();
              }}
            >
              <TokenIcon token={option.token} />
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
                  <Text variant={{ weight: "bold" }}>{option.symbol}</Text>
                  <Text
                    variant={{ type: "muted", weight: "normal", size: "small" }}
                  >
                    {option.formattedAddress}
                  </Text>
                </Box>
              </Box>
            </SelectModalItem>
          </SelectModalItemContainer>
        ))}
      </Box>
    </SelectModal>
  );
};
