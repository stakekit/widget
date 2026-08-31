import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { getStellarConnectors } from "../../../src/services/wallet/internal/adapters/stellar/stellar-connector";
import type { StellarWalletClient } from "../../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const makeClient = (
  id: StellarWalletClient["id"],
  installed = true
): StellarWalletClient => ({
  connect: Effect.succeed({ address }),
  disconnect: Effect.void,
  iconUrl: `https://example.com/${id}.png`,
  id,
  installed,
  name: id,
  productUrl: `https://example.com/${id}`,
  reconnect: () => Effect.succeed({ address }),
  signTransaction: () => Effect.succeed({ signedTxXdr: "signed-xdr" }),
});

const clients = [
  makeClient("freighter"),
  makeClient("albedo"),
  makeClient("xbull"),
  makeClient("lobstr"),
  makeClient("stellar-wallet-connect"),
] as const;

const createConnectorForTest = ({
  client = clients[0],
  stored,
}: {
  client?: StellarWalletClient;
  stored?: { address: string; connectorId: string };
} = {}) => {
  const group = getStellarConnectors({
    clients: [client],
    forceWalletConnectOnly: false,
    isMobileWallet: false,
    runWalletEffect: Effect.runPromise,
  });
  const wallet = group.wallets[0];
  if (!wallet) throw new Error("Stellar wallet missing");
  const factory = wallet({} as never).createConnector({} as never);
  const storage = {
    getItem: vi.fn(async () => stored),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  };
  const emitter = { emit: vi.fn() };
  const connector = factory({
    emitter,
    storage,
  } as never) as unknown as Connector & {
    connect: (input?: { isReconnecting?: boolean }) => Promise<{
      accounts: readonly [string, ...string[]];
      chainId: number;
    }>;
    getAccounts: () => Promise<readonly string[]>;
    signTransaction: (
      input: Parameters<StellarWalletClient["signTransaction"]>[0]
    ) => ReturnType<StellarWalletClient["signTransaction"]>;
  };
  return { connector, emitter, storage };
};

describe("Stellar connector", () => {
  it("offers the agreed Stellar wallet catalog", () => {
    const group = getStellarConnectors({
      clients,
      forceWalletConnectOnly: false,
      isMobileWallet: false,
      runWalletEffect: Effect.runPromise,
    });

    expect(group.groupName).toBe("Stellar");
    expect(
      group.wallets.map((createWallet) => createWallet({} as never).id)
    ).toEqual([
      "freighter",
      "albedo",
      "xbull",
      "lobstr",
      "stellar-wallet-connect",
    ]);
  });

  it("validates a saved connection through the selected wallet client", async () => {
    const reconnect = vi.fn(() => Effect.succeed({ address }));
    const client = { ...clients[0], reconnect };
    const { connector } = createConnectorForTest({
      client,
      stored: { address, connectorId: client.id },
    });

    await expect(
      connector.connect({ isReconnecting: true })
    ).resolves.toMatchObject({ accounts: [address] });
    expect(reconnect).toHaveBeenCalledWith(address);
  });

  it("clears saved connection state when live validation fails", async () => {
    const client = {
      ...clients[0],
      reconnect: () => Effect.fail(new Error("session expired") as never),
    };
    const { connector, storage } = createConnectorForTest({
      client,
      stored: { address, connectorId: client.id },
    });

    await expect(connector.connect({ isReconnecting: true })).rejects.toThrow(
      "session expired"
    );
    expect(storage.removeItem).toHaveBeenCalledWith("stellar.reconnect");
  });

  it("rolls back a connection when persistence fails", async () => {
    const disconnect = vi.fn();
    const client = { ...clients[0], disconnect: Effect.sync(disconnect) };
    const { connector, storage } = createConnectorForTest({ client });
    storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(connector.connect()).rejects.toThrow("storage unavailable");
    await expect(connector.getAccounts()).resolves.toEqual([]);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(storage.removeItem).toHaveBeenCalledWith("stellar.reconnect");
  });

  it("invalidates a cached connection when signing fails", async () => {
    const client = {
      ...clients[0],
      signTransaction: () =>
        Effect.fail(new Error("wallet operation failed") as never),
    };
    const { connector, emitter, storage } = createConnectorForTest({ client });
    await connector.connect();

    await expect(
      Effect.runPromise(
        connector.signTransaction({
          address,
          networkPassphrase: "Public Global Stellar Network ; September 2015",
          transactionXdr: "unsigned-xdr",
        })
      )
    ).rejects.toThrow("wallet operation failed");

    await expect(connector.getAccounts()).resolves.toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledWith("stellar.reconnect");
    expect(emitter.emit).toHaveBeenCalledWith("disconnect");
  });

  it("keeps only WalletConnect in WalletConnect-only mode", () => {
    const group = getStellarConnectors({
      clients,
      forceWalletConnectOnly: true,
      isMobileWallet: false,
      runWalletEffect: Effect.runPromise,
    });

    expect(
      group.wallets.map((createWallet) => createWallet({} as never).id)
    ).toEqual(["stellar-wallet-connect"]);
  });

  it("hides unavailable extension wallets on mobile", () => {
    const group = getStellarConnectors({
      clients: [makeClient("freighter", false), ...clients.slice(1)],
      forceWalletConnectOnly: false,
      isMobileWallet: true,
      runWalletEffect: Effect.runPromise,
    });

    expect(
      group.wallets.map((createWallet) => createWallet({} as never).id)
    ).not.toContain("freighter");
    expect(
      group.wallets.map((createWallet) => createWallet({} as never).id)
    ).toContain("stellar-wallet-connect");
  });
});
