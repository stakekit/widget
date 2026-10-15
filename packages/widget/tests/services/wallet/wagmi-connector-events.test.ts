import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { makeWagmiConnectorEvents } from "../../../src/services/wallet/internal/adapters/wagmi-connector-events";
import { normalizeChainId } from "../../../src/services/wallet/internal/normalize-chain-id";

const makeEmitter = () => {
  const emit = vi.fn();
  return { emit, emitter: { emit } as unknown as Connector["emitter"] };
};

describe("makeWagmiConnectorEvents", () => {
  it("reports an empty account list as a disconnect", () => {
    const { emit, emitter } = makeEmitter();

    makeWagmiConnectorEvents(emitter).onAccountsChanged([]);

    expect(emit.mock.calls).toEqual([["disconnect"]]);
  });

  it("forwards a nonempty account list as the same array", () => {
    const { emit, emitter } = makeEmitter();
    const accounts = ["addr-1", "addr-2"];

    makeWagmiConnectorEvents(emitter).onAccountsChanged(accounts);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[0]).toBe("change");
    expect(emit.mock.calls[0]?.[1].accounts).toBe(accounts);
  });

  it("passes chain ids through unchanged by default", () => {
    const { emit, emitter } = makeEmitter();
    const events = makeWagmiConnectorEvents(emitter);

    events.onChainChanged("cosmoshub-4");
    events.onChainChanged("42");

    expect(emit.mock.calls).toEqual([
      ["change", { chainId: "cosmoshub-4" }],
      ["change", { chainId: "42" }],
    ]);
  });

  it("maps chain ids through a supplied mapper", () => {
    const { emit, emitter } = makeEmitter();
    const events = makeWagmiConnectorEvents(emitter, normalizeChainId);

    events.onChainChanged("42");
    events.onChainChanged("not-numeric");

    expect(emit.mock.calls).toEqual([
      ["change", { chainId: 42 }],
      ["change", { chainId: "not-numeric" }],
    ]);
  });

  it("forwards disconnects", () => {
    const { emit, emitter } = makeEmitter();

    makeWagmiConnectorEvents(emitter).onDisconnect();

    expect(emit.mock.calls).toEqual([["disconnect"]]);
  });
});
