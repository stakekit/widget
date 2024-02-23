import {
  RainbowKitProvider,
  Chain as RainbowKitChain,
  DisclaimerComponent,
  useChainModal,
} from "@stakekit/rainbowkit";
import { PropsWithChildren, useMemo } from "react";
import { id, vars } from "../styles";
import { Text } from "../components";
import { useSKWallet } from "./sk-wallet";
import { useLedgerDisabledChain } from "./sk-wallet/use-ledger-disabled-chains";
import { useTranslation } from "react-i18next";
import { useCloseChainModal } from "../hooks/use-close-chain-modal";
import { useAddLedgerAccount } from "../hooks/use-add-ledger-account";
import { useTrackEvent } from "../hooks/tracking/use-track-event";
import { ConnectKitTheme, connectKitTheme } from "../styles/tokens/connect-kit";
import { useRootElement } from "../hooks/use-root-element";

const finalTheme: ConnectKitTheme = {
  ...connectKitTheme.lightMode,
  colors: vars.color.connectKit, // ThemeWrapper applies final light/dark colors
  radii: vars.borderRadius.connectKit,
};

export const RainbowKitProviderWithTheme = ({
  children,
  chains,
}: PropsWithChildren<{
  chains: RainbowKitChain[];
}>) => {
  const rootElement = useRootElement();
  const { connector } = useSKWallet();

  const disabledChains = useLedgerDisabledChain(connector);

  const trackEvent = useTrackEvent();

  const onDisabledChainClick = useAddLedgerAccount();

  const { t } = useTranslation();

  return (
    <RainbowKitProvider
      id={id}
      dialogRoot={rootElement as Element}
      modalSize="compact"
      chains={chains}
      disabledChains={useMemo(
        () =>
          disabledChains.map((c) => ({
            ...c,
            info: t("chain_modal.disabled_chain_info"),
          })),
        [disabledChains, t]
      )}
      onDisabledChainClick={(disabledChain) => {
        trackEvent("addLedgerAccountClicked");
        onDisabledChainClick.mutate(disabledChain);
      }}
      appInfo={{ disclaimer: Disclamer, appName: "StakeKit" }}
      theme={finalTheme}
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
  return <Text>Powered by StakeKit</Text>;
};
