import { createClient, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import {
  connect,
  disconnect,
  getConnection,
  watchConnection,
} from "wagmi/actions";
import { mock } from "wagmi/connectors";

const account = "0x0000000000000000000000000000000000000001" satisfies Hex;

const makeWagmiConfig = () =>
  createConfig({
    chains: [mainnet],
    client: ({ chain }) => createClient({ chain, transport: http() }),
    connectors: [mock({ accounts: [account] })],
  });

describe("Wagmi core connection characterization", () => {
  it("seeds the disconnected snapshot and watches subsequent changes", async () => {
    const wagmiConfig = makeWagmiConfig();
    const onChange = vi.fn();

    expect(getConnection(wagmiConfig)).toEqual({
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: "disconnected",
    });

    const unsubscribe = watchConnection(wagmiConfig, { onChange });
    await connect(wagmiConfig, { connector: wagmiConfig.connectors[0] });

    expect(getConnection(wagmiConfig)).toMatchObject({
      address: account,
      addresses: [account],
      chainId: mainnet.id,
      isConnected: true,
      status: "connected",
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      address: account,
      status: "connected",
    });

    const publicationsBeforeCleanup = onChange.mock.calls.length;
    unsubscribe();
    await disconnect(wagmiConfig);

    expect(onChange).toHaveBeenCalledTimes(publicationsBeforeCleanup);
  });

  it("keeps replacement configuration publications scoped to its watch", async () => {
    const firstConfig = makeWagmiConfig();
    const replacementConfig = makeWagmiConfig();
    const publications: Array<{
      readonly owner: "first" | "replacement";
      readonly status: string;
    }> = [];
    const unsubscribeFirst = watchConnection(firstConfig, {
      onChange: (snapshot) =>
        publications.push({ owner: "first", status: snapshot.status }),
    });

    unsubscribeFirst();
    const unsubscribeReplacement = watchConnection(replacementConfig, {
      onChange: (snapshot) =>
        publications.push({
          owner: "replacement",
          status: snapshot.status,
        }),
    });

    await connect(firstConfig, { connector: firstConfig.connectors[0] });
    await connect(replacementConfig, {
      connector: replacementConfig.connectors[0],
    });
    unsubscribeReplacement();

    expect(publications).not.toContainEqual({
      owner: "first",
      status: "connected",
    });
    expect(publications).toContainEqual({
      owner: "replacement",
      status: "connected",
    });
  });
});
