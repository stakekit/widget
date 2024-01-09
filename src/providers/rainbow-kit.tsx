import {
  darkTheme,
  lightTheme,
  Theme,
  RainbowKitProvider,
  Chain as RainbowKitChain,
  DisclaimerComponent,
  useChainModal,
} from "@stakekit/rainbowkit";
import merge from "lodash.merge";
import { PropsWithChildren, useMemo } from "react";
import { id, vars } from "../styles";
import { RecursivePartial } from "../types";
import { usePrefersColorScheme } from "../hooks";
import { useSettings } from "./settings";
import { Text } from "../components";
import { useSKWallet } from "./sk-wallet";
import { useLedgerDisabledChain } from "./sk-wallet/use-ledger-disabled-chains";
import { useTranslation } from "react-i18next";
import { useCloseChainModal } from "../hooks/use-close-chain-modal";
import { useAddLedgerAccount } from "../hooks/use-add-ledger-account";
import { useTrackEvent } from "../hooks/tracking/use-track-event";

const overrides: RecursivePartial<Theme> = {
  colors: {
    modalBackground: vars.color.background,
    profileForeground: vars.color.background,
  },
  radii: {
    actionButton: vars.borderRadius["2xl"],
  },
};

const theme: Theme = {
  lightMode: merge(lightTheme(), overrides),
  darkMode: merge(darkTheme(), overrides),
};

export const RainbowKitProviderWithTheme = ({
  children,
  chains,
}: PropsWithChildren<{
  chains: RainbowKitChain[];
}>) => {
  const { connectKitForceTheme } = useSettings();

  const scheme = usePrefersColorScheme();

  const { connector } = useSKWallet();

  const disabledChains = useLedgerDisabledChain(connector);

  const trackEvent = useTrackEvent();

  const onDisabledChainClick = useAddLedgerAccount();

  const { t } = useTranslation();

  return (
    <RainbowKitProvider
      id={id}
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
        onDisabledChainClick.mutateAsync(disabledChain);
      }}
      appInfo={{ disclaimer: Disclamer, appName: "StakeKit" }}
      theme={
        connectKitForceTheme
          ? theme[connectKitForceTheme]
          : scheme === "light"
            ? theme.lightMode
            : scheme === "dark"
              ? theme.darkMode
              : theme
      }
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
