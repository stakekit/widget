import { RegistryProvider, useAtomSet } from "@effect/atom-react";
import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import { type PropsWithChildren, useLayoutEffect, useState } from "react";
import { config } from "../../config";
import { isLedgerDappBrowserProvider } from "../../utils";
import { useSettings } from "../settings";
import {
  normalizeWidgetBootstrapConfig,
  widgetBootstrapConfigAtom,
} from "./bootstrap-config";
import {
  type DynamicExternalProviderInput,
  dynamicExternalProviderInputAtom,
  normalizeDynamicExternalProviderInput,
  normalizeSolanaWalletInput,
  type SolanaWalletInput,
  solanaWalletInputAtom,
} from "./root-inputs";

type RootInputBindingProps = PropsWithChildren<{
  readonly dynamicWalletInput: DynamicExternalProviderInput;
  readonly solanaInput: SolanaWalletInput;
}>;

const RootInputBinding = ({
  children,
  dynamicWalletInput,
  solanaInput,
}: RootInputBindingProps) => {
  const setDynamicWalletInput = useAtomSet(dynamicExternalProviderInputAtom);
  const setSolanaInput = useAtomSet(solanaWalletInputAtom);

  useLayoutEffect(() => {
    setDynamicWalletInput(dynamicWalletInput);
  }, [dynamicWalletInput, setDynamicWalletInput]);

  useLayoutEffect(() => {
    setSolanaInput(solanaInput);
  }, [setSolanaInput, solanaInput]);

  return children;
};

export const SKAtomRuntimeProvider = ({ children }: PropsWithChildren) => {
  const settings = useSettings();
  const solanaConnection = useSolanaConnection();
  const solanaWallet = useSolanaWallet();
  const [bootstrapConfig] = useState(() =>
    normalizeWidgetBootstrapConfig({
      isLedgerLive: isLedgerDappBrowserProvider(),
      settings,
    })
  );
  const dynamicWalletInput = normalizeDynamicExternalProviderInput(
    settings.externalProviders
  );
  const solanaInput = normalizeSolanaWalletInput({
    connection: solanaConnection.connection,
    wallets: solanaWallet.wallets,
  });
  return (
    <RegistryProvider
      defaultIdleTTL={config.atomResources.defaultIdleTTL}
      initialValues={[
        [widgetBootstrapConfigAtom, bootstrapConfig],
        [
          dynamicExternalProviderInputAtom.initialValueTarget,
          dynamicWalletInput,
        ],
        [solanaWalletInputAtom.initialValueTarget, solanaInput],
      ]}
    >
      <RootInputBinding
        dynamicWalletInput={dynamicWalletInput}
        solanaInput={solanaInput}
      >
        {children}
      </RootInputBinding>
    </RegistryProvider>
  );
};
