import type { Account } from "@ledgerhq/wallet-api-client";
import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { Chain } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import {
  disconnectedWalletConnection,
  type WalletConnectionSnapshot,
} from "../../src/features/wallet/state/connection";
import {
  disconnectedLedgerConnectorState,
  makeLedgerConnectorStateAtom,
  makeLedgerConnectorStateStream,
} from "../../src/features/wallet/state/ledger";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";

describe("Ledger connector state atom", () => {
  it("uses deterministic defaults for non-Ledger connectors", async () => {
    const values = await Effect.runPromise(
      makeLedgerConnectorStateStream(undefined).pipe(Stream.runCollect)
    );

    expect(Array.from(values)).toEqual([disconnectedLedgerConnectorState]);
  });

  it("seeds Ledger state changed before the consumer subscribes", async () => {
    const account = {
      address: "0x0000000000000000000000000000000000000001",
      id: "ledger-account",
    } as Account;
    const accounts = makeCurrentValueStream<Account[]>([]);
    const currentAccountId = makeCurrentValueStream<string | undefined>(
      undefined
    );
    const disabledChains = makeCurrentValueStream<Chain[]>([]);
    accounts.set([account]);
    currentAccountId.set(account.id);
    disabledChains.set([mainnet]);

    const values = await Effect.runPromise(
      makeLedgerConnectorStateStream({
        $accountsOnCurrentChain: accounts.changes,
        $currentAccountId: currentAccountId.changes,
        $disabledChains: disabledChains.changes,
        id: "ledgerLive",
      } as unknown as Connector).pipe(Stream.take(1), Stream.runCollect)
    );

    expect(Array.from(values)).toEqual([
      {
        accounts: [account],
        currentAccountId: account.id,
        disabledChains: [mainnet],
      },
    ]);
  });

  it("owns account, current-account, and disabled-chain subscriptions", async () => {
    const account = {
      address: "0x0000000000000000000000000000000000000001",
      id: "ledger-account",
    } as Account;
    const accounts = makeCurrentValueStream<Account[]>([]);
    const currentAccountId = makeCurrentValueStream<string | undefined>(
      undefined
    );
    const disabledChains = makeCurrentValueStream<Chain[]>([]);
    const connector = {
      $accountsOnCurrentChain: accounts.changes,
      $currentAccountId: currentAccountId.changes,
      $disabledChains: disabledChains.changes,
      id: "ledgerLive",
    } as unknown as Connector;
    const valuesPromise = Effect.runPromise(
      makeLedgerConnectorStateStream(connector).pipe(
        Stream.take(4),
        Stream.runCollect
      )
    );

    await vi.waitFor(() => {
      expect(accounts.subscriberCount()).toBe(1);
      expect(currentAccountId.subscriberCount()).toBe(1);
      expect(disabledChains.subscriberCount()).toBe(1);
    });
    accounts.set([account]);
    accounts.set([account]);
    currentAccountId.set(account.id);
    disabledChains.set([mainnet]);

    expect(Array.from(await valuesPromise)).toEqual([
      disconnectedLedgerConnectorState,
      { accounts: [account], currentAccountId: undefined, disabledChains: [] },
      {
        accounts: [account],
        currentAccountId: account.id,
        disabledChains: [],
      },
      {
        accounts: [account],
        currentAccountId: account.id,
        disabledChains: [mainnet],
      },
    ]);
    expect(accounts.subscriberCount()).toBe(0);
    expect(currentAccountId.subscriberCount()).toBe(0);
    expect(disabledChains.subscriberCount()).toBe(0);
  });

  it("replaces connector subscriptions and finalizes both scopes", async () => {
    const makeLedgerSource = (id: string) => {
      const accounts = makeCurrentValueStream<Account[]>([]);
      const currentAccountId = makeCurrentValueStream<string | undefined>(
        undefined
      );
      const disabledChains = makeCurrentValueStream<Chain[]>([]);

      return {
        accounts,
        connector: {
          $accountsOnCurrentChain: accounts.changes,
          $currentAccountId: currentAccountId.changes,
          $disabledChains: disabledChains.changes,
          id: "ledgerLive",
          uid: id,
        } as unknown as Connector,
        currentAccountId,
        disabledChains,
      };
    };
    const first = makeLedgerSource("first");
    const replacement = makeLedgerSource("replacement");
    const makeConnection = (connector: Connector) =>
      ({
        ...disconnectedWalletConnection,
        address: "N/A",
        addresses: ["N/A"],
        chain: mainnet,
        chainId: mainnet.id,
        connector,
        isConnected: true,
        isDisconnected: false,
        status: "connected",
      }) as unknown as WalletConnectionSnapshot;
    const connectionAtom = Atom.make(
      AsyncResult.success(makeConnection(first.connector))
    );
    const ledgerStateAtom = makeLedgerConnectorStateAtom(connectionAtom);
    const registry = AtomRegistry.make();
    const unsubscribe = registry.subscribe(ledgerStateAtom, () => {}, {
      immediate: true,
    });

    await vi.waitFor(() => {
      expect(first.accounts.subscriberCount()).toBe(1);
    });
    registry.set(
      connectionAtom,
      AsyncResult.success(makeConnection(replacement.connector))
    );
    await vi.waitFor(() => {
      expect(first.accounts.subscriberCount()).toBe(0);
      expect(replacement.accounts.subscriberCount()).toBe(1);
    });

    unsubscribe();
    registry.dispose();
    expect(replacement.accounts.subscriberCount()).toBe(0);
  });
});
