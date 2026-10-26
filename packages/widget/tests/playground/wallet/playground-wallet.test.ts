import { describe, expect, it } from "vitest";
import { makePlaygroundWallet } from "../../../playground/wallet/playground-wallet";
import { makeScriptedWalletBackend } from "../../../playground/wallet/scripted-wallet-backend";
import type { SKTx, SKTxMeta } from "../../../src/public-api/types";

const tx: SKTx = {
  type: "evm",
  tx: {
    chainId: "0xa86a",
    data: "0x",
    from: "0x0000000000000000000000000000000000000001",
    gas: "0x1",
    gasPrice: undefined,
    to: "0x0000000000000000000000000000000000000002",
    type: "0x1",
    value: undefined,
  },
};
// The playground wallet only forwards the meta to the backend and its log.
const txMeta = { txId: "tx-1" } as SKTxMeta;
const txHash = expect.stringMatching(/^0x[0-9a-f]{64}$/);

const makeWallet = () =>
  makePlaygroundWallet({
    backend: makeScriptedWalletBackend({ delayMs: 0 }),
    connection: { address: "0xabc", chainId: 43114 },
    log: () => {},
  });

describe("Playground wallet", () => {
  it("broadcasts transactions by default", async () => {
    const { provider } = makeWallet();

    await expect(provider.sendTransaction(tx, txMeta)).resolves.toEqual({
      type: "success",
      txHash,
    });
  });

  it("answers the next requests with the queued outcomes, then the default", async () => {
    const { controls, provider } = makeWallet();
    controls.next("cancelled", "error", "errorWithHash");

    await expect(provider.sendTransaction(tx, txMeta)).resolves.toEqual({
      type: "cancelled",
    });
    await expect(provider.sendTransaction(tx, txMeta)).resolves.toEqual({
      type: "error",
      error: expect.any(String),
    });
    await expect(provider.sendTransaction(tx, txMeta)).resolves.toEqual({
      type: "error",
      error: expect.any(String),
      txHash,
    });
    await expect(provider.sendTransaction(tx, txMeta)).resolves.toEqual({
      type: "success",
      txHash,
    });
  });

  it("holds a broadcast transaction's answer until released", async () => {
    const { controls, getState, provider } = makeWallet();
    controls.next("hold");

    const answer = provider.sendTransaction(tx, txMeta);
    await expect.poll(() => getState().held).toEqual(["sendTransaction"]);

    // A typo from the console must not answer the held request.
    controls.release("hold" as never);
    expect(getState().held).toEqual(["sendTransaction"]);

    controls.release();

    await expect(answer).resolves.toEqual({ type: "success", txHash });
    expect(getState().held).toEqual([]);
  });

  it("rejects the request for the reject outcome", async () => {
    const { controls, provider } = makeWallet();
    controls.setDefault("reject");

    await expect(provider.sendTransaction(tx, txMeta)).rejects.toThrow();
  });

  it("follows a chain switch and keeps the chain when the switch is declined", async () => {
    const { controls, getState, provider } = makeWallet();

    await provider.switchChain(1);
    expect(getState().connection.chainId).toBe(1);

    controls.next("cancelled");
    await expect(provider.switchChain(137)).rejects.toThrow();
    expect(getState().connection.chainId).toBe(1);
  });
});
