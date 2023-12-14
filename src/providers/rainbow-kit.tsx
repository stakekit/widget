import {
  darkTheme,
  lightTheme,
  Theme,
  RainbowKitProvider,
  Chain as RainbowKitChain,
  DisclaimerComponent,
  Chain,
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
import { useMutation } from "@tanstack/react-query";
import { EitherAsync, Left, Right } from "purify-ts";
import { isLedgerLiveConnector } from "./sk-wallet/utils";
import { useTranslation } from "react-i18next";

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

let latestCloseModalFn = () => {};

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

  const onDisabledChainClick = useOnDisabledChainClick();

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
      onDisabledChainClick={(disabledChain) =>
        onDisabledChainClick.mutateAsync(disabledChain)
      }
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
  latestCloseModalFn = useChainModal().closeChainModal; // haaack

  return null;
};

const useOnDisabledChainClick = () => {
  const { connector } = useSKWallet();

  return useMutation<void, Error, Chain>({
    mutationFn: async (chain) => {
      (
        await EitherAsync.liftEither(
          connector && isLedgerLiveConnector(connector)
            ? Right(connector)
            : Left(new Error("Only Ledger Live is supported"))
        )
          .chain((ledgerLiveConnector) =>
            ledgerLiveConnector.requestAndSwitchAccount(chain)
          )
          .ifRight(latestCloseModalFn)
      ).unsafeCoerce();
    },
  });
};

const Disclamer: DisclaimerComponent = () => {
  return <Text>Powered by StakeKit</Text>;
};
