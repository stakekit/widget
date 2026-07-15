import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { type PropsWithChildren, useLayoutEffect, useState } from "react";
import { config } from "../../../../shared/config/widget-defaults";
import {
  useWidgetConfig,
  type WidgetConfig,
  widgetConfigAtom,
} from "../../../config";
import {
  dynamicExternalProviderInputAtom,
  normalizeDynamicExternalProviderInput,
  normalizeSolanaWalletInput,
  solanaWalletInputAtom,
} from "../../../runtime/root-inputs";

const WidgetConfigBinding = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  const setWidgetConfig = useAtomSet(widgetConfigAtom);

  useLayoutEffect(() => {
    setWidgetConfig(settings);
  }, [setWidgetConfig, settings]);

  return children;
};

export const SKAtomRegistryProvider = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  const [initialSettings] = useState(settings);

  return (
    <RegistryProvider
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[[widgetConfigAtom, initialSettings]]}
    >
      <WidgetConfigBinding settings={settings}>{children}</WidgetConfigBinding>
    </RegistryProvider>
  );
};

export const SKRootInputProvider = ({ children }: PropsWithChildren) => {
  const setDynamicWalletInput = useAtomSet(dynamicExternalProviderInputAtom);
  const setSolanaInput = useAtomSet(solanaWalletInputAtom);
  const externalProviders = useWidgetConfig("externalProviders");
  const solanaConnection = useSolanaConnection();
  const solanaWallet = useSolanaWallet();
  const dynamicWalletInput =
    normalizeDynamicExternalProviderInput(externalProviders);
  const solanaInput = normalizeSolanaWalletInput({
    connection: solanaConnection.connection,
    wallets: solanaWallet.wallets,
  });

  useLayoutEffect(() => {
    setDynamicWalletInput(dynamicWalletInput);
  }, [dynamicWalletInput, setDynamicWalletInput]);

  useLayoutEffect(() => {
    setSolanaInput(solanaInput);
  }, [setSolanaInput, solanaInput]);

  return children;
};
