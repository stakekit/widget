import type { WalletController } from "../../../src/services/wallet/wagmi-config";

export const makeWalletTestController = (
  controller: Record<string, unknown>
): WalletController =>
  ({
    cosmosConfig: { cosmosChainsMap: {} },
    evmConfig: { evmChains: [], evmChainsMap: {} },
    isLedgerLive: false,
    miscConfig: { miscChainsMap: {} },
    substrateConfig: { substrateChainsMap: {} },
    ...controller,
  }) as unknown as WalletController;
