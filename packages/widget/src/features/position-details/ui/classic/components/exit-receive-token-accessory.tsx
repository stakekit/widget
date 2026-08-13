import { Trigger } from "@radix-ui/react-dialog";
import clsx from "clsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { TokenAddress } from "../../../../../domain/identity/identifiers";
import type { Token } from "../../../../../domain/token/token";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import {
  SelectModal,
  SelectModalItem,
  SelectModalItemContainer,
} from "../../../../../shared/ui/components/select-modal";
import { SelectedToken } from "../../../../../shared/ui/components/selected-token";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../../../shared/ui/primitives/button/styles.css";
import { CaretDownIcon } from "../../../../../shared/ui/primitives/icons/caret-down";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useTrackEvent } from "../../../../tracking/state";
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
  const variant = useWidgetConfig("variant");
  const [search, setSearch] = useState("");

  const tokensByAddress = buildExitReceiveTokensByAddress(integration);
  const accessory = resolveExitReceiveTokenAccessory({
    positionToken,
    selection,
    tokensByAddress,
  });

  if (!selection || accessory._tag === "Static") {
    return (
      <Box data-testid="position-details-exit-receive-token">
        <SelectedToken token={accessory.token} />
      </Box>
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
        <Trigger asChild>
          <Box
            as="button"
            type="button"
            display="flex"
            justifyContent="center"
            alignItems="center"
            borderRadius="2xl"
            px="2"
            py="1"
            data-testid="position-details-exit-receive-token"
            className={clsx(
              pressAnimation,
              combineRecipeWithVariant({
                variant,
                rec: selectTokenButton,
              })
            )}
          >
            <Box
              marginRight="2"
              display="flex"
              justifyContent="center"
              alignItems="center"
              gap="2"
            >
              <TokenIcon token={accessory.token} />
              <Text variant={{ weight: "bold" }}>{accessory.token.symbol}</Text>
            </Box>
            <CaretDownIcon />
          </Box>
        </Trigger>
      }
      onSearch={setSearch}
      searchValue={search}
      onClose={() => setSearch("")}
    >
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
    </SelectModal>
  );
};
