import { EventEmitter } from "node:events";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Queue, Stream } from "effect";
import { afterEach, vi } from "vitest";
import { createConfig, http } from "wagmi";
import { connect, getAccount } from "wagmi/actions";
import { mainnet } from "wagmi/chains";
import type * as WagmiConnectors from "wagmi/connectors";
import { createEvmWallets } from "../../../src/services/wallet/internal/adapters/evm/wallets";
import {
  makeWalletConnectPresentation,
  type WalletConnectModal,
} from "../../../src/services/wallet/internal/platform/wallet-connect-presentation";
import { isWalletCancellation } from "../../../src/services/wallet/wallet-cancellation";
import { connectorsForWallets } from "../../../src/services/wallet/wallet-descriptors";
import { WalletIntegrationError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { runWalletEffect } from "../../utils/run-wallet-effect";

const nativeAddress = "0x0000000000000000000000000000000000000001";
const metaMaskAddress = "0x0000000000000000000000000000000000000002";
const otherAddress = "0x0000000000000000000000000000000000000003";
const uri = "wc:proposal@2?relay-protocol=irn&symKey=0123456789abcdef";

const nativeSession = vi.hoisted(() => {
  const state: {
    approval: Promise<void> | undefined;
    providerReady?: Promise<void>;
    onProvider?: () => void;
    onConnected?: () => void;
    requests: number;
    changeAccounts: ((accounts: string[]) => void) | undefined;
    disconnect: (() => void) | undefined;
  } = {
    approval: undefined,
    requests: 0,
    changeAccounts: undefined,
    disconnect: undefined,
  };
  return state;
});

vi.mock("wagmi/connectors", async (importOriginal) => {
  const connectors = await importOriginal<typeof WagmiConnectors>();
  return {
    ...connectors,
    walletConnect: () => {
      const factory = connectors.mock({
        accounts: ["0x0000000000000000000000000000000000000001"],
      });
      const nativeProvider = new EventEmitter<{
        display_uri: [uri: string];
        accountsChanged: [accounts: string[]];
        disconnect: [];
      }>();
      nativeSession.changeAccounts = (accounts) =>
        nativeProvider.emit("accountsChanged", accounts);
      nativeSession.disconnect = () => nativeProvider.emit("disconnect");
      return (config: Parameters<typeof factory>[0]) => {
        const connector = factory(config);
        return {
          ...connector,
          async connect(parameters: Parameters<typeof connector.connect>[0]) {
            nativeSession.requests += 1;
            nativeProvider.emit("display_uri", uri);
            await nativeSession.approval;
            const result = await connector.connect(parameters);
            nativeProvider.on(
              "accountsChanged",
              connector.onAccountsChanged.bind(connector)
            );
            nativeProvider.on(
              "disconnect",
              connector.onDisconnect.bind(connector)
            );
            nativeSession.onConnected?.();
            return result;
          },
          getProvider: async () => {
            nativeSession.onProvider?.();
            await nativeSession.providerReady;
            return nativeProvider;
          },
        };
      };
    },
  };
});

const provider = (address: string, flags: Record<string, unknown>) => ({
  ...flags,
  on: vi.fn(),
  removeListener: vi.fn(),
  request: vi.fn(async ({ method }: { method: string }) => {
    if (method === "wallet_requestPermissions") return [];
    if (method === "eth_chainId") return "0x1";
    if (method === "eth_accounts" || method === "eth_requestAccounts")
      return [address];
    throw new Error(`Unexpected provider request: ${method}`);
  }),
});

const makeMetaMaskConfig = (discover = false) => {
  const { metaMaskWallet } = createEvmWallets({
    walletConnectPresentation: { connect: ({ connection }) => connection },
    runWalletEffect,
  });
  return createConfig({
    chains: [mainnet],
    connectors: connectorsForWallets(
      [{ groupName: "Ethereum", wallets: [metaMaskWallet] }],
      { appName: "StakeKit", projectId: "project-id" }
    ),
    multiInjectedProviderDiscovery: discover,
    storage: null,
    transports: { [mainnet.id]: http() },
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, "ethereum");
  nativeSession.approval = undefined;
  nativeSession.providerReady = undefined;
  nativeSession.onProvider = undefined;
  nativeSession.onConnected = undefined;
  nativeSession.requests = 0;
  nativeSession.changeAccounts = undefined;
  nativeSession.disconnect = undefined;
});

describe("MetaMask provider targeting", () => {
  it("uses native handoff rather than authorizing a wallet masquerading as MetaMask", async () => {
    const frame = provider(otherAddress, { isMetaMask: true, isFrame: true });
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: frame,
    });
    const config = makeMetaMaskConfig();

    const result = await config.connectors[0]!.connect();

    expect(result.accounts).toEqual([nativeAddress]);
    expect(frame.request).not.toHaveBeenCalled();
  });

  it("selects valid MetaMask from a legacy provider list instead of the first masquerading wallet", async () => {
    const exodus = provider(otherAddress, { isMetaMask: true, isExodus: true });
    const metaMask = provider(metaMaskAddress, { isMetaMask: true });
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { ...exodus, providers: [exodus, metaMask] },
    });
    const config = makeMetaMaskConfig();

    const result = await config.connectors[0]!.connect();

    expect(result.accounts).toEqual([metaMaskAddress]);
    expect(exodus.request).not.toHaveBeenCalled();
  });

  it("prefers the discovered MetaMask provider over ambiguous legacy injection", async () => {
    const legacy = provider(otherAddress, { isMetaMask: true });
    const discovered = provider(metaMaskAddress, {});
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: legacy,
    });
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
              name: "MetaMask",
              rdns: "io.metamask",
              uuid: "8a5fa43b-a5ce-4a34-b2d4-711cf8cbe505",
            },
            provider: discovered,
          },
        })
      );
    window.addEventListener("eip6963:requestProvider", announce);
    const config = makeMetaMaskConfig(true);
    try {
      const result = await config.connectors[0]!.connect();

      expect(result.accounts).toEqual([metaMaskAddress]);
      expect(legacy.request).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("eip6963:requestProvider", announce);
      config._internal.mipd?.destroy();
    }
  });
});

const awaitHandoffStage = <A>(name: string, promise: Promise<A>) =>
  Effect.promise(() => promise).pipe(
    Effect.timeoutOrElse({
      duration: "2 seconds",
      orElse: () => Effect.die(new Error(`Timed out waiting for ${name}`)),
    })
  );

describe("named EVM native handoff", () => {
  it.live(
    "resumes one pending approval across named choices without wrapping the protocol URI",
    () =>
      Effect.gen(function* () {
        const approval = Promise.withResolvers<void>();
        nativeSession.approval = approval.promise;
        const firstOpen = Promise.withResolvers<void>();
        const secondOpen = Promise.withResolvers<void>();
        const visibleUris: string[] = [];
        const listeners = new Set<(state: { open: boolean }) => void>();
        const modal: WalletConnectModal = {
          open: async ({ uri }) => {
            visibleUris.push(uri);
            listeners.forEach((listener) => listener({ open: true }));
            if (visibleUris.length === 1) firstOpen.resolve();
            else secondOpen.resolve();
          },
          close: async () => {
            listeners.forEach((listener) => listener({ open: false }));
          },
          resetWcConnection: () => {},
          subscribeState: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
        const walletConnectPresentation = yield* makeWalletConnectPresentation(
          Effect.succeed(modal),
          () => {}
        ).pipe(Effect.provide(WalletModal.layer));
        const wallets = createEvmWallets({
          walletConnectPresentation,
          runWalletEffect,
        });
        const config = createConfig({
          chains: [mainnet],
          connectors: connectorsForWallets(
            [
              {
                groupName: "Ethereum",
                wallets: [
                  wallets.metaMaskWallet,
                  (options) => ({
                    ...wallets.ledgerWallet(options),
                    desktop: undefined,
                  }),
                ],
              },
            ],
            { appName: "StakeKit", projectId: "project-id" }
          ),
          multiInjectedProviderDiscovery: false,
          storage: null,
          transports: { [mainnet.id]: http() },
        });
        const first = connect(config, {
          connector: config.connectors[0]!,
        }).then(
          () => undefined,
          (cause: unknown) => cause
        );
        yield* awaitHandoffStage("MetaMask QR", firstOpen.promise);
        listeners.forEach((listener) => listener({ open: false }));
        expect(
          yield* awaitHandoffStage("MetaMask dismissal", first)
        ).toMatchObject({
          cause: { code: 4001 },
        });

        const second = connect(config, { connector: config.connectors[1]! });
        yield* awaitHandoffStage("Ledger QR replay", secondOpen.promise);
        const requestsBeforeApproval = nativeSession.requests;
        approval.resolve();
        expect(
          (yield* awaitHandoffStage("Ledger approval", second)).accounts
        ).toEqual([nativeAddress]);
        expect(requestsBeforeApproval).toBe(1);
        expect(visibleUris).toEqual([uri, uri]);
        nativeSession.changeAccounts?.([otherAddress]);
        expect(getAccount(config).address).toBe(otherAddress);
        nativeSession.disconnect?.();
        expect(getAccount(config).isDisconnected).toBe(true);
      }).pipe(Effect.scoped)
  );
});

describe("cross-ecosystem WalletConnect handoff", () => {
  for (const firstNamespace of ["eip155", "cosmos"] as const) {
    it.live(
      `switches from ${firstNamespace} after dismissal without accepting its late approval`,
      () =>
        Effect.gen(function* () {
          const walletModal = yield* WalletModal;
          yield* walletModal.openConnect;
          const revision = yield* walletModal.connectOpen.revision;
          const opened = yield* Queue.unbounded<string>();
          const listeners = new Set<(state: { open: boolean }) => void>();
          let visible: string | undefined;
          const presentation = yield* makeWalletConnectPresentation(
            Effect.succeed({
              open: async ({ uri, namespace }) => {
                visible = uri;
                listeners.forEach((listener) => listener({ open: true }));
                Queue.offerUnsafe(opened, namespace ?? "");
              },
              close: async () => {
                visible = undefined;
                listeners.forEach((listener) => listener({ open: false }));
              },
              resetWcConnection: () => {},
              subscribeState: (listener) => {
                listeners.add(listener);
                return () => {
                  listeners.delete(listener);
                };
              },
            }),
            () => {}
          );
          const evmApproval = Promise.withResolvers<void>();
          const evmCompleted = Promise.withResolvers<void>();
          const cosmosApproval = Promise.withResolvers<string>();
          const cosmosCompleted = Promise.withResolvers<void>();
          nativeSession.approval = evmApproval.promise;
          nativeSession.onConnected = () => evmCompleted.resolve();
          const wallets = createEvmWallets({
            walletConnectPresentation: presentation,
            runWalletEffect,
          });
          const config = createConfig({
            chains: [mainnet],
            connectors: connectorsForWallets(
              [
                {
                  groupName: "Ethereum",
                  wallets: [wallets.walletConnectWallet],
                },
              ],
              { appName: "StakeKit", projectId: "project-id" }
            ),
            multiInjectedProviderDiscovery: false,
            storage: null,
            transports: { [mainnet.id]: http() },
          });
          const evm = Effect.tryPromise({
            try: () => connect(config, { connector: config.connectors[0]! }),
            catch: (cause) =>
              new WalletIntegrationError({
                cause,
                message: "EVM approval failed",
                operation: "evm-connect",
              }),
          }).pipe(Effect.asVoid);
          const cosmos = presentation
            .connect({
              namespace: "cosmos",
              connection: Effect.tryPromise({
                try: async () => {
                  const result = await cosmosApproval.promise;
                  cosmosCompleted.resolve();
                  return result;
                },
                catch: (cause) =>
                  new WalletIntegrationError({
                    cause,
                    message: "Cosmos approval failed",
                    operation: "cosmos-connect",
                  }),
              }),
              subscribeUri: (publish) =>
                Effect.sync(() => publish("wc:cosmos@2")),
            })
            .pipe(Effect.asVoid);
          const first = yield* (
            firstNamespace === "eip155" ? evm : cosmos
          ).pipe(Effect.forkScoped({ startImmediately: true }));
          expect(yield* Queue.take(opened)).toBe(firstNamespace);
          listeners.forEach((listener) => listener({ open: false }));
          expect(
            isWalletCancellation(yield* Effect.flip(Fiber.join(first)))
          ).toBe(true);
          expect(yield* walletModal.presentationOpen.current).toBe(false);
          expect(yield* walletModal.connectOpen.current).toBe(true);
          expect(yield* walletModal.connectOpen.revision).toBe(revision);

          const second = yield* (
            firstNamespace === "eip155" ? cosmos : evm
          ).pipe(Effect.forkScoped({ startImmediately: true }));
          const secondNamespace =
            firstNamespace === "eip155" ? "cosmos" : "eip155";
          expect(yield* Queue.take(opened)).toBe(secondNamespace);
          yield* walletModal.presentationOpen.changes.pipe(
            Stream.filter((open) => open),
            Stream.take(1),
            Stream.runDrain
          );
          if (firstNamespace === "eip155") {
            evmApproval.resolve();
            yield* awaitHandoffStage(
              "abandoned EVM approval",
              evmCompleted.promise
            );
            nativeSession.changeAccounts?.([otherAddress]);
            expect(getAccount(config).isDisconnected).toBe(true);
          } else {
            cosmosApproval.resolve("cosmos-account");
            yield* awaitHandoffStage(
              "abandoned Cosmos approval",
              cosmosCompleted.promise
            );
          }
          expect(visible).toBe(
            secondNamespace === "cosmos" ? "wc:cosmos@2" : uri
          );
          expect(yield* walletModal.presentationOpen.current).toBe(true);
          if (secondNamespace === "cosmos")
            cosmosApproval.resolve("cosmos-account");
          else evmApproval.resolve();
          yield* Fiber.join(second);
          if (secondNamespace === "eip155") {
            expect(getAccount(config).address).toBe(nativeAddress);
          }
          expect(visible).toBeUndefined();
          expect(listeners.size).toBe(0);
        }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
    );
  }

  it.live(
    "cancels generic EVM during provider initialization before a URI exists",
    () =>
      Effect.gen(function* () {
        const walletModal = yield* WalletModal;
        yield* walletModal.openConnect;
        const providerReady = Promise.withResolvers<void>();
        const preparing = Promise.withResolvers<void>();
        const approval = Promise.withResolvers<void>();
        const completed = Promise.withResolvers<void>();
        nativeSession.providerReady = providerReady.promise;
        nativeSession.onProvider = () => preparing.resolve();
        nativeSession.approval = approval.promise;
        nativeSession.onConnected = () => completed.resolve();
        const visibleUris: string[] = [];
        const opened = Promise.withResolvers<void>();
        const listeners = new Set<(state: { open: boolean }) => void>();
        const presentation = yield* makeWalletConnectPresentation(
          Effect.succeed({
            open: async ({ uri }) => {
              visibleUris.push(uri);
              listeners.forEach((listener) => listener({ open: true }));
              opened.resolve();
            },
            close: async () => {
              listeners.forEach((listener) => listener({ open: false }));
            },
            resetWcConnection: () => {},
            subscribeState: (listener) => {
              listeners.add(listener);
              return () => {
                listeners.delete(listener);
              };
            },
          }),
          () => {}
        );
        const wallets = createEvmWallets({
          walletConnectPresentation: presentation,
          runWalletEffect,
        });
        const config = createConfig({
          chains: [mainnet],
          connectors: connectorsForWallets(
            [{ groupName: "Ethereum", wallets: [wallets.walletConnectWallet] }],
            { appName: "StakeKit", projectId: "project-id" }
          ),
          multiInjectedProviderDiscovery: false,
          storage: null,
          transports: { [mainnet.id]: http() },
        });
        const first = connect(config, {
          connector: config.connectors[0]!,
        }).then(
          () => undefined,
          (cause: unknown) => cause
        );
        yield* awaitHandoffStage("provider initialization", preparing.promise);
        expect(yield* walletModal.presentationOpen.current).toBe(false);
        yield* walletModal.connectOpen.set(true);
        expect(
          yield* awaitHandoffStage("early EVM cancellation", first)
        ).toMatchObject({
          cause: { code: 4001 },
        });
        const other = yield* presentation
          .connect({
            namespace: "cosmos",
            connection: Effect.never,
            subscribeUri: (publish) =>
              Effect.sync(() => publish("wc:cosmos@2")),
          })
          .pipe(Effect.forkScoped({ startImmediately: true }));
        yield* awaitHandoffStage("next ecosystem handoff", opened.promise);
        providerReady.resolve();
        approval.resolve();
        yield* awaitHandoffStage("late EVM approval", completed.promise);
        expect(visibleUris).toEqual(["wc:cosmos@2"]);
        expect(getAccount(config).isDisconnected).toBe(true);
        yield* Fiber.interrupt(other);
        expect(listeners.size).toBe(0);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
