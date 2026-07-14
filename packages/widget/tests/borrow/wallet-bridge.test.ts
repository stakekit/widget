import { Effect, Schema } from "effect";
import { arbitrum, base, mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import {
  decodeChainId,
  switchBorrowWalletChain,
  toBorrowSwitchChainCommandInput,
  toBorrowWalletStateProjection,
} from "../../src/borrow";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { NormalizedWalletState } from "../../src/providers/wallet/state/wallet";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

describe("borrow wallet bridge", () => {
  it("purely projects atom-owned wallet state and switch input", () => {
    const connector = {
      switchChain: vi.fn(async () => arbitrum),
    } as unknown as Connector;
    const wallet = {
      additionalAddresses: null,
      address,
      chain: mainnet,
      connector,
      connectorChains: [mainnet, base],
      isLedgerLive: false,
      isLedgerLiveAccountPlaceholder: false,
      ledgerAccounts: [],
      network: "ethereum",
      status: "connected",
    } satisfies NormalizedWalletState;
    const projection = toBorrowWalletStateProjection(wallet);
    const switchInput = toBorrowSwitchChainCommandInput({
      chainId: decodeChainId(42_161),
      wallet,
    });

    expect(projection).toMatchObject({
      status: "connected",
      wallet: {
        currentAccount: { address },
        network: "ethereum",
      },
    });
    expect(switchInput).toEqual({
      chainId: "42161",
      connector,
    });
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
