import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { type PropsWithChildren, useLayoutEffect } from "react";
import { config } from "../../../../shared/config/widget-defaults";
import {
  makeWidgetRuntimeGenerationKey,
  type WidgetConfig,
  widgetConfigAtom,
} from "../../../config";
import {
  normalizeSolanaWalletInput,
  solanaWalletInputAtom,
} from "../../../runtime/root-inputs";

export const SKAtomRegistryProvider = ({
  children,
  settings,
}: PropsWithChildren<{ readonly settings: WidgetConfig }>) => {
  return (
    <RegistryProvider
      key={makeWidgetRuntimeGenerationKey(settings)}
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[[widgetConfigAtom, settings]]}
    >
      <WidgetConfigBinding settings={settings}>{children}</WidgetConfigBinding>
    </RegistryProvider>
  );
};

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

export const SKRootInputProvider = ({ children }: PropsWithChildren) => {
  const setSolanaInput = useAtomSet(solanaWalletInputAtom);
  const solanaConnection = useSolanaConnection();
  const solanaWallet = useSolanaWallet();
  const solanaInput = normalizeSolanaWalletInput({
    connection: solanaConnection.connection,
    wallets: solanaWallet.wallets,
  });

  useLayoutEffect(() => {
    setSolanaInput(solanaInput);
  }, [setSolanaInput, solanaInput]);

  return children;
};
