import { Effect } from "effect";
import { arbitrum, base, mainnet, polygon } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import {
  decodeChainId,
  switchBorrowWalletChain,
  toBorrowWalletBridgeState,
} from "../../src/borrow";

const address = "0x0000000000000000000000000000000000000001";

describe("borrow wallet bridge", () => {
  it("returns disconnected state when the widget wallet is disconnected", () => {
    const state = toBorrowWalletBridgeState({
      address: null,
      chain: null,
      connector: null,
      connectorChains: [],
      isConnected: false,
      network: null,
    });

    expect(state).toEqual({
      status: "disconnected",
      wallet: { status: "disconnected" },
    });
  });

  it("returns unsupported-network state for connected non-borrow networks", () => {
    const state = toBorrowWalletBridgeState({
      address,
      chain: polygon,
      connector: null,
      connectorChains: [mainnet, polygon],
      isConnected: true,
      network: "polygon",
    });

    expect(state.status).toBe("unsupported-network");
    if (state.status !== "unsupported-network") {
      throw new Error("Expected unsupported-network state");
    }
    expect(state.chainId).toBe(137);
    expect(state.supportedChains.map((chain) => chain.network)).toEqual([
      "ethereum",
    ]);
  });

  it("maps supported widget wallet state into borrow wallet state", () => {
    const state = toBorrowWalletBridgeState({
      address,
      chain: mainnet,
      connector: null,
      connectorChains: [mainnet, base, polygon],
      isConnected: true,
      network: "ethereum",
    });

    expect(state.status).toBe("connected");
    if (state.status !== "connected") {
      throw new Error("Expected connected state");
    }
    expect(state.wallet.currentAccount.address).toBe(address);
    expect(state.wallet.currentChain.network).toBe("ethereum");
    expect(state.wallet.network).toBe("ethereum");
    expect(state.wallet.chains.map((chain) => chain.network)).toEqual([
      "ethereum",
      "base",
    ]);
  });

  it("switches chains through the current widget connector", async () => {
    const switchChain = vi.fn(async () => arbitrum);

    await Effect.runPromise(
      switchBorrowWalletChain({
        chainId: decodeChainId(42161),
        connector: { switchChain },
      })
    );

    expect(switchChain).toHaveBeenCalledWith({ chainId: 42_161 });
  });

  it("fails chain switching when the connector cannot switch chains", async () => {
    await expect(
      Effect.runPromise(
        switchBorrowWalletChain({
          chainId: decodeChainId(1),
          connector: null,
        })
      )
    ).rejects.toMatchObject({ _tag: "BorrowSwitchChainError" });
  });
});
