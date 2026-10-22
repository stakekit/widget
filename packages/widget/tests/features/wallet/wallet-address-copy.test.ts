import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import {
  copyWalletAddressAtom,
  walletAddressCopiedAtom,
} from "../../../src/features/wallet/state/account-presentation";
import { WalletClipboard } from "../../../src/services/wallet/wallet-clipboard";
import {
  disconnectedLedgerConnectorState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { makeTestWallet } from "../../utils/services/wallet-service";

const rawAddress = "0x1111111111111111111111111111111111111111";
const firstAddress = Schema.decodeSync(WalletAddress)(rawAddress);
const secondAddress = Schema.decodeSync(WalletAddress)(
  "0x2222222222222222222222222222222222222222"
);
const config = createConfig({
  chains: [mainnet],
  connectors: [mock({ accounts: [rawAddress] })],
  transports: { [mainnet.id]: http() },
  storage: null,
  multiInjectedProviderDiscovery: false,
});
const stateFor = (address: WalletAddress): WalletState => ({
  connection: {
    status: "connected",
    address,
    additionalAddresses: null,
    chain: mainnet,
    connector: config.connectors[0]!,
    connectorChains: [mainnet],
    network: "ethereum",
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
  },
  ledger: disconnectedLedgerConnectorState,
});

const expectCopied = (registry: AtomRegistry.AtomRegistry, copied: boolean) =>
  Effect.promise(() =>
    expect
      .poll(() => registry.get(walletAddressCopiedAtom), { timeout: 3000 })
      .toBe(copied)
  );

/** A registry whose wallet runtime copies through `copyAddress`, with the account dialog's Atoms mounted. */
const makeCopyRegistry = Effect.fn("makeCopyRegistry")(function* (
  copyAddress: WalletClipboard["Service"]["copyAddress"]
) {
  const wallet = yield* makeTestWallet({
    initialState: stateFor(firstAddress),
  });
  const registry = yield* Effect.acquireRelease(
    Effect.sync(() =>
      AtomRegistry.make({
        initialValues: [
          [
            walletRuntime.layer,
            Layer.mergeAll(
              wallet.layer,
              Layer.succeed(
                WalletClipboard,
                WalletClipboard.of({ copyAddress })
              )
            ) as never,
          ],
        ],
      })
    ),
    (registry) => Effect.sync(() => registry.dispose())
  );
  yield* Effect.acquireRelease(
    Effect.sync(() => [
      registry.mount(copyWalletAddressAtom),
      registry.mount(walletAddressCopiedAtom),
    ]),
    (unmounts) =>
      Effect.sync(() => {
        for (const unmount of unmounts) unmount();
      })
  );
  return { registry, setWalletState: wallet.setState } as const;
});

describe("wallet address copy", () => {
  it.live(
    "copies the address and drops the feedback for a replacement account",
    () =>
      Effect.gen(function* () {
        const copied: Array<string> = [];
        const { registry, setWalletState } = yield* makeCopyRegistry(
          (address) =>
            Effect.sync(() => {
              copied.push(address);
            })
        );

        yield* expectCopied(registry, false);
        registry.set(copyWalletAddressAtom, undefined);
        yield* expectCopied(registry, true);
        expect(copied).toEqual([firstAddress]);

        yield* setWalletState(stateFor(secondAddress));
        yield* expectCopied(registry, false);
      }).pipe(Effect.scoped)
  );

  it.live(
    "clears copied feedback on time while a repeated copy is still writing",
    () =>
      Effect.gen(function* () {
        const copies = { count: 0 };
        const { registry } = yield* makeCopyRegistry(() =>
          Effect.suspend(() => {
            copies.count += 1;
            return copies.count === 1 ? Effect.void : Effect.never;
          })
        );

        registry.set(copyWalletAddressAtom, undefined);
        yield* expectCopied(registry, true);
        registry.set(copyWalletAddressAtom, undefined);
        yield* expectCopied(registry, false);
      }).pipe(Effect.scoped)
  );
});
