import { shouldShowDisconnect } from "@sk-widget/domain/types/connectors";
import { useSettings } from "@sk-widget/providers/settings";
import { vars } from "@sk-widget/styles";
import { id } from "@sk-widget/styles/theme/ids";
import type { DisclaimerComponent } from "@stakekit/rainbowkit";
import { RainbowKitProvider, useChainModal } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "../components";
import { useTrackEvent } from "../hooks/tracking/use-track-event";
import { useAddLedgerAccount } from "../hooks/use-add-ledger-account";
import { useCloseChainModal } from "../hooks/use-close-chain-modal";
import type { ConnectKitTheme } from "../styles/tokens/connect-kit";
import { connectKitTheme } from "../styles/tokens/connect-kit";
import { useSKWallet } from "./sk-wallet";
import { useLedgerDisabledChain } from "./sk-wallet/use-ledger-disabled-chains";

const finalTheme: ConnectKitTheme = {
  ...connectKitTheme.lightMode,
  colors: vars.color.connectKit, // ThemeWrapper applies final light/dark colors
  radii: vars.borderRadius.connectKit,
  fonts: { body: vars.font.body },
};

export const RainbowKitProviderWithTheme = ({
  children,
}: PropsWithChildren) => {
  const { connector, connectorChains } = useSKWallet();

  const ledgerDisabledChains = useLedgerDisabledChain(connector);

  const trackEvent = useTrackEvent();

  const onDisabledChainClick = useAddLedgerAccount();

  const { t } = useTranslation();

  const { hideChainModal } = useSettings();

  const chainIdsToUse = useMemo(
    () => new Set(connectorChains.map((c) => c.id)),
    [connectorChains]
  );

  const disabledChains = useMemo(
    () =>
      ledgerDisabledChains.map((c) => ({
        ...c,
        info: t("chain_modal.disabled_chain_info"),
      })),
    [ledgerDisabledChains, t]
  );

  const hideDisconnect = useMemo(
    () =>
      Maybe.fromNullable(connector)
        .map((c) => !shouldShowDisconnect(c))
        .orDefault(true),
    [connector]
  );

  return (
    <RainbowKitProvider
      chainIdsToUse={chainIdsToUse}
      id={id}
      modalSize="compact"
      disabledChains={disabledChains}
      onDisabledChainClick={(disabledChain) => {
        trackEvent("addLedgerAccountClicked");
        onDisabledChainClick.mutate(disabledChain);
      }}
      appInfo={{ disclaimer: Disclamer, appName: t("shared.stake_kit") }}
      {...(hideChainModal && { avatar: null })}
      showRecentTransactions={false}
      theme={finalTheme}
      hideDisconnect={hideDisconnect}
    >
      <DisabledChainHandling />
      {children}
    </RainbowKitProvider>
  );
};

const DisabledChainHandling = () => {
  useCloseChainModal().setCloseChainModal = useChainModal().closeChainModal; // haaack

  return null;
};

const Disclamer: DisclaimerComponent = () => {
  const { t } = useTranslation();
  return <Text>{t("chain_modal_disclaimer")}</Text>;
};
