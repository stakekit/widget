import { expect, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Schema,
  Stream,
} from "effect";
import { createConfig, http } from "wagmi";
import { avalanche, mainnet } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletPresentationService } from "../../src/features/wallet/runtime";
import { WalletClipboard } from "../../src/services/wallet/wallet-clipboard";
import { WalletModal } from "../../src/services/wallet/wallet-modal";
import {
  disconnectedLedgerConnectorState,
  type WalletState,
} from "../../src/services/wallet/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";

const rawAddress = "0x1111111111111111111111111111111111111111";
const firstAddress = Schema.decodeSync(WalletAddress)(rawAddress);
const secondAddress = Schema.decodeSync(WalletAddress)(
  "0x2222222222222222222222222222222222222222"
);
const config = createConfig({
  chains: [mainnet, avalanche],
  connectors: [mock({ accounts: [rawAddress] })],
  transports: { [mainnet.id]: http(), [avalanche.id]: http() },
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
    connectorChains: [mainnet, avalanche],
    network: "ethereum",
    isLedgerLive: false,
    isLedgerLiveAccountPlaceholder: false,
    ledgerAccounts: [],
  },
  ledger: disconnectedLedgerConnectorState,
});

it.effect(
  "does not close a replacement account's network dialog after a stale switch",
  () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const wallet = yield* makeTestWallet({
        initialState: stateFor(firstAddress),
        switchChain: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.as({ id: avalanche.id })
          ),
      });
      const layer = WalletPresentationService.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(wallet.layer, WalletModal.layer, WalletClipboard.layer)
        )
      );
      yield* Effect.gen(function* () {
        const presentation = yield* WalletPresentationService;
        const modal = yield* WalletModal;
        yield* modal.chainOpen.set(true);
        const pending = yield* Effect.forkChild(
          presentation.selectChain({
            chain: avalanche,
            addLedgerAccount: false,
          })
        );
        yield* Deferred.await(started);
        yield* wallet.setState(stateFor(secondAddress));
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(pending);
        expect(yield* modal.chainOpen.current).toBe(true);
      }).pipe(Effect.provide(layer));
    })
);

it.effect(
  "does not show copied feedback for a replacement wallet account",
  () =>
    Effect.gen(function* () {
      const wallet = yield* makeTestWallet({
        initialState: stateFor(firstAddress),
      });
      const layer = WalletPresentationService.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            wallet.layer,
            WalletModal.layer,
            Layer.succeed(
              WalletClipboard,
              WalletClipboard.of({ copyAddress: () => Effect.void })
            )
          )
        )
      );
      yield* Effect.gen(function* () {
        const presentation = yield* WalletPresentationService;
        yield* presentation.copyAddress;
        expect(yield* Stream.runHead(presentation.addressCopied)).toEqual(
          Option.some(true)
        );
        yield* wallet.setState(stateFor(secondAddress));
        expect(yield* Stream.runHead(presentation.addressCopied)).toEqual(
          Option.some(false)
        );
      }).pipe(Effect.provide(layer));
    })
);

it.effect(
  "does not block network selection behind a pending clipboard write",
  () =>
    Effect.gen(function* () {
      const copying = yield* Deferred.make<void>();
      const releaseCopy = yield* Deferred.make<void>();
      const switching = yield* Deferred.make<void>();
      const wallet = yield* makeTestWallet({
        initialState: stateFor(firstAddress),
        switchChain: () =>
          Deferred.succeed(switching, undefined).pipe(
            Effect.as({ id: avalanche.id })
          ),
      });
      const layer = WalletPresentationService.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            wallet.layer,
            WalletModal.layer,
            Layer.succeed(
              WalletClipboard,
              WalletClipboard.of({
                copyAddress: () =>
                  Deferred.succeed(copying, undefined).pipe(
                    Effect.andThen(Deferred.await(releaseCopy))
                  ),
              })
            )
          )
        )
      );
      yield* Effect.gen(function* () {
        const presentation = yield* WalletPresentationService;
        const copy = yield* Effect.forkChild(presentation.copyAddress, {
          startImmediately: true,
        });
        yield* Deferred.await(copying);
        const selection = yield* Effect.forkChild(
          presentation.selectChain({
            chain: avalanche,
            addLedgerAccount: false,
          }),
          { startImmediately: true }
        );
        yield* Deferred.await(switching);
        yield* Deferred.succeed(releaseCopy, undefined);
        yield* Fiber.join(copy);
        yield* Fiber.join(selection);
      }).pipe(Effect.provide(layer));
    })
);

it.effect(
  "interrupts a network switch when its dialog closes and keeps the reopened dialog open",
  () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const continued = { value: false };
      const wallet = yield* makeTestWallet({
        initialState: stateFor(firstAddress),
        switchChain: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.andThen(
              Effect.sync(() => {
                continued.value = true;
              })
            ),
            Effect.as({ id: avalanche.id })
          ),
      });
      const layer = WalletPresentationService.layer.pipe(
        Layer.provideMerge(
          Layer.mergeAll(wallet.layer, WalletModal.layer, WalletClipboard.layer)
        )
      );
      yield* Effect.gen(function* () {
        const presentation = yield* WalletPresentationService;
        const modal = yield* WalletModal;
        yield* modal.chainOpen.set(true);
        const pending = yield* Effect.forkChild(
          presentation.selectChain({
            chain: avalanche,
            addLedgerAccount: false,
          })
        );
        yield* Deferred.await(started);
        expect(yield* Stream.runHead(presentation.chainSelection)).toEqual(
          Option.some({ pendingChainId: avalanche.id })
        );

        yield* modal.chainOpen.set(false);
        expect(yield* Stream.runHead(presentation.chainSelection)).toEqual(
          Option.some({})
        );
        yield* modal.chainOpen.set(true);
        yield* Deferred.succeed(release, undefined);
        expect(Exit.hasInterrupts(yield* Fiber.await(pending))).toBe(true);
        expect(continued.value).toBe(false);
        expect(yield* modal.chainOpen.current).toBe(true);
      }).pipe(Effect.provide(layer));
    })
);
