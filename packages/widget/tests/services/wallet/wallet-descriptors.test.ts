import { describe, expect, it } from "vitest";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import type { CreateWalletDescriptor } from "../../../src/services/wallet/wallet-descriptors";
import { connectorsForWallets } from "../../../src/services/wallet/wallet-descriptors";

const wallet =
  (id: string): CreateWalletDescriptor =>
  () => ({
    availability: { _tag: "Remote" },
    chainGroup: {
      iconUrl: "https://example.com/evm.svg",
      id: "evm",
      title: "EVM",
    },
    createConnector: (details) => (config) => ({
      ...mock({ accounts: ["0x1234567890123456789012345678901234567890"] })(
        config
      ),
      ...details,
      id,
      name: id,
    }),
    iconBackground: "#000",
    iconUrl: `https://example.com/${id}.svg`,
    id,
    name: id,
  });

const makeConfig = (wallets: Parameters<typeof connectorsForWallets>[0]) =>
  createConfig({
    chains: [mainnet],
    connectors: connectorsForWallets(wallets, {
      appName: "StakeKit",
      appUrl: "https://stakek.it",
      projectId: "project-id",
    }),
    multiInjectedProviderDiscovery: false,
    storage: null,
    transports: { [mainnet.id]: http() },
  });

describe("wallet descriptors", () => {
  it("omits duplicate wallets while preserving catalogue order", () => {
    const config = makeConfig([
      { groupName: "Recommended", wallets: [wallet("primary")] },
      {
        groupName: "Other",
        wallets: [wallet("primary"), wallet("secondary")],
      },
    ]);

    expect(config.connectors.map((connector) => connector.id)).toEqual([
      "primary",
      "secondary",
    ]);
  });
});
