import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import type { TokenAddress } from "../../../../domain/identity/identifiers";
import type { Token } from "../../../../domain/token/token";
import {
  useTokenLogo,
  useTokenLogoResolver,
} from "../../../../shared/react/token-logo";
import { SelectSheet, TokenTrigger } from "../../../../ui/index";
import { useTrackEvent } from "../../../tracking/index";
import {
  buildExitReceiveTokensByAddress,
  equalExitReceiveTokenAddresses,
  type PositionDetailsExitReceiveTokenSelection,
  projectExitReceiveTokenOption,
  resolveExitReceiveTokenAccessory,
} from "../../model/exit-receive-token";

const triggerTestId = "position-details-exit-receive-token";

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
  const resolveLogo = useTokenLogoResolver();

  const tokensByAddress = buildExitReceiveTokensByAddress(integration);
  const accessory = resolveExitReceiveTokenAccessory({
    positionToken,
    selection,
    tokensByAddress,
  });
  const token = {
    ...useTokenLogo(accessory.token),
    name: accessory.token.symbol,
  };

  if (!selection || accessory._tag === "Static") {
    return <TokenTrigger token={token} readOnly testId={triggerTestId} />;
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
  const selected = options.find((option) =>
    equalExitReceiveTokenAddresses(option.address, selection.selected.address)
  );

  return (
    <SelectSheet
      title={t("position_details.receive_token.select_title")}
      closeLabel={t("shared.close")}
      listLabel={t("position_details.receive_token.select_title")}
      trigger={<TokenTrigger token={token} testId={triggerTestId} />}
      onOpenChange={(open) => {
        if (open) trackEvent("exitReceiveTokenModalOpened");
        else setSearch("");
      }}
      search={{
        value: search,
        onValueChange: setSearch,
        label: t("shared.search"),
        clearLabel: t("shared.clear_search"),
      }}
      options={filteredOptions.map((option) => ({
        id: option.address,
        title: option.symbol,
        subtitle: option.formattedAddress,
        logo: { ...resolveLogo(option.token), name: option.symbol },
      }))}
      {...(selected ? { selectedId: selected.address } : {})}
      onSelect={(id) => {
        const option = options.find((candidate) => candidate.address === id);
        if (option) onSelect(option.address);
      }}
      testIds={{
        container: "select-modal__container",
        title: "select-modal__title",
        search: "select-modal__search-input",
      }}
    />
  );
};
