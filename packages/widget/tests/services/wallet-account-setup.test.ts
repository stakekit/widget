import type { Chain } from "@stakekit/rainbowkit";
import { Effect, Layer, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletAccountSetupService } from "../../src/services/wallet/wallet-account-setup-service";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import { WalletService } from "../../src/services/wallet/wallet-service";

const chain = { id: 1 } as Chain;
const makeConnection = (
  connectorUid: string,
  address: string
): NormalizedWalletState => ({
  additionalAddresses: null,
  address: address as typeof WalletAddress.Type,
  chain: chain as never,
  connector: {
    id: "ledgerLive",
    uid: connectorUid,
  } as never,
  connectorChains: [],
  isLedgerLive: true,
  isLedgerLiveAccountPlaceholder: true,
  ledgerAccounts: [],
  network: "ethereum",
  status: "connected",
});

const makeState = (connection: NormalizedWalletState): WalletState => ({
  connection,
  ledger: disconnectedLedgerConnectorState,
});

const runSetup = ({
  addLedgerAccount,
  expected,
  readState,
}: {
  readonly addLedgerAccount: WalletService["Service"]["addLedgerAccount"];
  readonly expected: WalletCommandIdentity;
  readonly readState: () => WalletState;
}) => {
  let closed = 0;
  const dependencies = Layer.mergeAll(
    Layer.succeed(
      WalletModal,
      WalletModal.of({
        closeChain: Effect.sync(() => {
          closed += 1;
        }),
        install: () => Effect.void,
        openConnect: Effect.void,
        uninstall: () => Effect.void,
      })
    ),
    Layer.succeed(
      WalletService,
      WalletService.of({
        addLedgerAccount,
        state: Effect.sync(readState),
        states: Stream.fromEffect(Effect.sync(readState)),
        wagmiConfig: {},
      } as never)
    )
  );

  return {
    closed: () => closed,
    effect: Effect.scoped(
      WalletAccountSetupService.use((service) =>
        service.addLedgerAccount({ expected, targetChain: chain })
      )
    ).pipe(
      Effect.provide(
        WalletAccountSetupService.layer.pipe(Layer.provide(dependencies))
      )
    ),
  };
};

describe("WalletAccountSetupService", () => {
  it("closes the chain modal only after the Ledger account is added", async () => {
    const state = makeState(makeConnection("ledger-a", "0x111"));
    const addLedgerAccount = vi.fn(() =>
      Effect.succeed({ _tag: "Added" } as const)
    );
    const setup = runSetup({
      addLedgerAccount,
      expected: walletCommandIdentity(state.connection),
      readState: () => state,
    });

    await expect(Effect.runPromise(setup.effect)).resolves.toEqual({
      _tag: "Added",
    });
    expect(addLedgerAccount).toHaveBeenCalledWith(chain);
    expect(setup.closed()).toBe(1);
  });

  it("rejects an in-flight connector change without closing the modal", async () => {
    const initial = makeState(makeConnection("ledger-a", "0x111"));
    let current = initial;
    const addLedgerAccount = vi.fn(() =>
      Effect.sync(() => {
        current = makeState(makeConnection("ledger-b", "0x222"));
        return { _tag: "Added" } as const;
      })
    );
    const setup = runSetup({
      addLedgerAccount,
      expected: walletCommandIdentity(initial.connection),
      readState: () => current,
    });

    await expect(Effect.runPromise(setup.effect)).resolves.toEqual({
      _tag: "RejectedStale",
    });
    expect(setup.closed()).toBe(0);
  });

  it("rejects a command whose wallet identity changed before execution", async () => {
    const initial = makeState(makeConnection("ledger-a", "0x111"));
    const current = makeState(makeConnection("ledger-b", "0x222"));
    const addLedgerAccount = vi.fn(() =>
      Effect.succeed({ _tag: "Added" } as const)
    );
    const setup = runSetup({
      addLedgerAccount,
      expected: walletCommandIdentity(initial.connection),
      readState: () => current,
    });

    await expect(Effect.runPromise(setup.effect)).resolves.toEqual({
      _tag: "RejectedStale",
    });
    expect(addLedgerAccount).not.toHaveBeenCalled();
    expect(setup.closed()).toBe(0);
  });
});
