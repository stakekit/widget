import { describe, expect, it, vi } from "@effect/vitest";
import type { Connection as SolanaConnection } from "@solana/web3.js";
import { Cause, Effect, Exit, Schema } from "effect";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/wallet/address";
import { EnabledWalletNetworksResponse } from "../../src/domain/wallet/models";
import { InitParams } from "../../src/services/wallet/init-params";
import { getConfig as getEvmConfig } from "../../src/services/wallet/internal/adapters/evm/config";
import { StellarWalletsKitPlatform } from "../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";
import {
  WagmiOperations,
  WagmiOperationsError,
  type WagmiOperationsService,
  wagmiOperations,
} from "../../src/services/wallet/internal/platform/wagmi-operations";
import {
  makeInitializeWallet,
  type WalletInitialConnectionInput,
} from "../../src/services/wallet/internal/runtime/initial-connection";
import { makeWagmiActions } from "../../src/services/wallet/internal/runtime/wagmi-actions";
import {
  buildWagmiConfig,
  getUnseenMipdProviders,
  scopedMipdSubscription,
} from "../../src/services/wallet/internal/runtime/wagmi-config";

const emptyInitParams = {
  accountId: null,
  balanceId: null,
  network: null,
  pendingaction: null,
  tab: null,
  token: null,
  validator: null,
  yieldId: null,
} as const;

const unusedStellarWalletsKitPlatform = StellarWalletsKitPlatform.of({
  load: Effect.succeed([]),
});

type InitialConnectionOperations = Pick<
  WagmiOperationsService,
  "connect" | "reconnect" | "switchChain"
>;

const operationFailure = (cause: unknown) =>
  new WagmiOperationsError({ cause, operation: "reconnect" });

const makeInitializer = (operations: InitialConnectionOperations) =>
  makeInitializeWallet.pipe(
    Effect.provideService(
      WagmiOperations,
      WagmiOperations.of({ ...wagmiOperations, ...operations })
    )
  );

const initialize = (
  operations: InitialConnectionOperations,
  input: Omit<
    WalletInitialConnectionInput,
    "isLedgerDappBrowser" | "isMobileWallet"
  > & {
    readonly isLedgerDappBrowser?: boolean;
    readonly isMobileWallet?: boolean;
  }
) =>
  Effect.gen(function* () {
    const run = yield* makeInitializer(operations);
    return yield* run({
      ...input,
      isLedgerDappBrowser: input.isLedgerDappBrowser ?? false,
      isMobileWallet: input.isMobileWallet ?? false,
    });
  });

describe("wallet Effect Atom boundaries", () => {
  it("reconciles cumulative MIPD snapshots without duplicating providers", () => {
    const provider = (rdns: string) => ({ info: { rdns } });
    const configuredConnector = { id: "configured" };
    const firstSnapshot = [provider("wallet.a")];
    const firstNew = getUnseenMipdProviders({
      connectors: [configuredConnector],
      providers: firstSnapshot as never,
    });
    const connectorsAfterFirst = [
      configuredConnector,
      ...firstNew.map((details) => ({ id: details.info.rdns })),
    ];
    const secondNew = getUnseenMipdProviders({
      connectors: connectorsAfterFirst,
      providers: [provider("wallet.a"), provider("wallet.b")] as never,
    });
    const connectorsAfterSecond = [
      ...connectorsAfterFirst,
      ...secondNew.map((details) => ({ id: details.info.rdns })),
    ];

    expect(firstNew.map((details) => details.info.rdns)).toEqual(["wallet.a"]);
    expect(secondNew.map((details) => details.info.rdns)).toEqual(["wallet.b"]);
    expect(
      getUnseenMipdProviders({
        connectors: connectorsAfterSecond,
        providers: [provider("wallet.a"), provider("wallet.b")] as never,
      })
    ).toEqual([]);
    expect(connectorsAfterSecond.map((connector) => connector.id)).toEqual([
      "configured",
      "wallet.a",
      "wallet.b",
    ]);
  });

  it("applies Wallet Policy to newly discovered injected providers", () => {
    const provider = (rdns: string) => ({ info: { rdns } });

    const discovered = getUnseenMipdProviders({
      connectors: [],
      providers: [
        provider("wallet.alpha"),
        provider("wallet.beta"),
        provider("wallet.gamma"),
      ] as never,
      walletPolicy: {
        allow: ["wallet.alpha", "wallet.beta", "wallet.gamma"],
        deny: ["wallet.beta"],
        order: ["wallet.gamma"],
      },
    });

    expect(discovered.map((details) => details.info.rdns)).toEqual([
      "wallet.gamma",
      "wallet.alpha",
    ]);
  });

  it("decodes Yield network IDs into distinct Enabled Wallet Networks", () => {
    const networks = Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([
      { id: "ethereum" },
      { id: "plume" },
      { id: "robinhood" },
      { id: "robinhood-testnet" },
      { id: "ethereum" },
    ]);

    expect(networks).toEqual(
      new Set(["ethereum", "robinhood", "robinhood-testnet"])
    );
  });

  it("accepts projects without Enabled Wallet Networks", () => {
    expect(Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([])).toEqual(
      new Set()
    );
  });

  it("rejects unknown Yield network IDs", () => {
    expect(() =>
      Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([
        { id: "not-a-network" },
      ])
    ).toThrow(/Expected Networks[\s\S]*at \[0\]\["id"\]/);
  });

  it("decodes valid initialization parameters and ignores invalid fields", () => {
    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        network: "ethereum",
        pendingaction: "UNSTAKE",
        yieldId: "ethereum-eth-native-staking",
      })
    ).toMatchObject({
      network: "ethereum",
      pendingaction: "UNSTAKE",
      yieldId: "ethereum-eth-native-staking",
    });

    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        network: "ethereum-holesky",
      })
    ).toMatchObject({ network: null });
    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        pendingaction: "unstake",
      })
    ).toMatchObject({ pendingaction: null });
  });

  it("validates wallet-provided additional address data with Schema", () => {
    const cosmosPubKey = "A".repeat(44);

    expect(
      Schema.decodeUnknownSync(AdditionalAddresses)({ cosmosPubKey })
    ).toEqual({ cosmosPubKey });
    expect(() =>
      Schema.decodeUnknownSync(AdditionalAddresses)({ cosmosPubKey: "short" })
    ).toThrow();
  });

  it.effect(
    "constructs EVM configuration directly from validated networks",
    () =>
      Effect.gen(function* () {
        const config = yield* getEvmConfig({
          enabledNetworks: new Set(["robinhood", "robinhood-testnet"]),
          forceWalletConnectOnly: true,
          institutionalWallets: false,
          variant: "default",
        });

        expect(config.evmChains).toHaveLength(2);
        expect(Object.keys(config.evmChainsMap)).toEqual([
          "robinhood",
          "robinhood-testnet",
        ]);
      })
  );

  it.effect(
    "runs reconnect, mobile fallback, and requested chain switching in order",
    () =>
      Effect.gen(function* () {
        const calls: string[] = [];
        const injectedConnector = { id: "injected" } as Connector;
        const wagmiConfig = {
          connectors: [injectedConnector],
          state: { chainId: 1 },
        } as unknown as ReturnType<typeof createConfig>;
        const operations: InitialConnectionOperations = {
          reconnect: vi.fn(() =>
            Effect.sync(() => {
              calls.push("reconnect");
              return [];
            })
          ),
          connect: vi.fn(() =>
            Effect.sync(() => {
              calls.push("connect");
              return { accounts: [], chainId: 1 };
            })
          ),
          switchChain: vi.fn(() =>
            Effect.sync(() => {
              calls.push("switch");
              return { id: 2 };
            })
          ),
        };

        const initializeWallet = yield* makeInitializer(operations);
        yield* initializeWallet({
          hasExternalProvider: false,
          isLedgerDappBrowser: false,
          isMobileWallet: true,
          queryParamsInitChainId: 2,
          wagmiConfig,
        });

        expect(calls).toEqual(["reconnect", "connect", "switch"]);
        expect(operations.reconnect).toHaveBeenCalledOnce();
        expect(operations.connect).toHaveBeenCalledOnce();
        expect(operations.switchChain).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "continues after reconnect, fallback connect, and initial switch failures",
    () =>
      Effect.gen(function* () {
        const injectedConnector = { id: "injected" } as Connector;
        const wagmiConfig = {
          connectors: [injectedConnector],
          state: { chainId: 1 },
        } as unknown as ReturnType<typeof createConfig>;
        const cause = new Error("initialization failed");
        const baseOperations: InitialConnectionOperations = {
          connect: vi.fn(() => Effect.succeed({ accounts: [], chainId: 1 })),
          reconnect: vi.fn(() => Effect.succeed([{} as never])),
          switchChain: vi.fn(() => Effect.succeed({ id: 2 })),
        };
        const run = (
          operations: InitialConnectionOperations,
          isMobileWallet = false
        ) =>
          initialize(operations, {
            hasExternalProvider: false,
            isMobileWallet,
            queryParamsInitChainId: 2,
            wagmiConfig,
          });

        const reconnectFailure = vi.fn(() =>
          Effect.fail(operationFailure(cause))
        );
        const reconnectConnect = vi.fn(() =>
          Effect.succeed({ accounts: [], chainId: 1 })
        );
        const reconnectSwitch = vi.fn(() => Effect.succeed({ id: 2 }));
        yield* run(
          {
            ...baseOperations,
            connect: reconnectConnect,
            reconnect: reconnectFailure,
            switchChain: reconnectSwitch,
          },
          true
        );
        const fallbackConnectFailure = vi.fn(() =>
          Effect.fail(operationFailure(cause))
        );
        yield* run(
          {
            ...baseOperations,
            connect: fallbackConnectFailure,
            reconnect: vi.fn(() => Effect.succeed([])),
          },
          true
        );
        const switchFailure = vi.fn(() => Effect.fail(operationFailure(cause)));
        yield* run({
          ...baseOperations,
          switchChain: switchFailure,
        });

        expect(reconnectFailure).toHaveBeenCalledOnce();
        expect(reconnectSwitch).toHaveBeenCalledOnce();
        expect(reconnectConnect).toHaveBeenCalledOnce();
        expect(reconnectConnect).toHaveBeenCalledWith(wagmiConfig, {
          chainId: 2,
          connector: injectedConnector,
        });
        expect(fallbackConnectFailure).toHaveBeenCalledOnce();
        expect(switchFailure).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "retains configured connectors and manual connect after initial switching fails",
    () =>
      Effect.gen(function* () {
        const configuredConnector = { id: "configured" } as Connector;
        const wagmiConfig = {
          connectors: [configuredConnector],
          state: { chainId: 1 },
        } as unknown as ReturnType<typeof createConfig>;
        const connect = vi.fn(() =>
          Effect.succeed({ accounts: [], chainId: 1 })
        );
        const operations: InitialConnectionOperations = {
          connect,
          reconnect: vi.fn(() => Effect.succeed([{} as never])),
          switchChain: vi.fn(() =>
            Effect.fail(operationFailure(new Error("switch rejected")))
          ),
        };

        const initializeWallet = yield* makeInitializer(operations);
        yield* initializeWallet({
          hasExternalProvider: false,
          isLedgerDappBrowser: false,
          isMobileWallet: false,
          queryParamsInitChainId: 2,
          wagmiConfig,
        });

        expect(wagmiConfig.connectors).toEqual([configuredConnector]);

        yield* operations.connect(wagmiConfig, {
          connector: configuredConnector,
        });
        expect(connect).toHaveBeenCalledOnce();
      })
  );

  it.effect("keeps wallet configuration construction failures fatal", () =>
    Effect.gen(function* () {
      const cause = new Error("connector construction failed");
      const exit = yield* Effect.exit(
        Effect.scoped(
          Effect.gen(function* () {
            const buildActions = yield* makeWagmiActions;
            return yield* buildWagmiConfig(
              {
                chainIconMapping: undefined,
                walletListFactory: () => {
                  throw cause;
                },
                disableInjectedProviderDiscovery: true,
                enabledNetworks: new Set(["ethereum"]),
                forceWalletConnectOnly: false,
                institutionalWallets: false,
                isLedgerLive: false,
                isMobileWallet: false,
                isSafe: false,
                mapWalletFn: undefined,
                walletPolicy: undefined,
                persistPublicKey: () => Effect.void,
                queryParams: Schema.decodeSync(InitParams)(emptyInitParams),
                solanaConnection: {} as SolanaConnection,
                solanaWallets: [],
                tonConnectManifestUrl: undefined,
                variant: "default",
              },
              buildActions,
              unusedStellarWalletsKitPlatform
            );
          }).pipe(Effect.provide(WagmiOperations.layer))
        )
      );
      if (Exit.isSuccess(exit)) {
        throw new Error("Expected wallet configuration construction to fail");
      }

      expect(() => {
        throw Cause.squash(exit.cause);
      }).toThrow(cause.message);
    })
  );

  it.effect(
    "builds an empty wallet topology when no Wallet Networks are enabled",
    () =>
      Effect.gen(function* () {
        const walletListFactory = vi.fn(() => {
          throw new Error("must not build connectors without Wallet Networks");
        });
        const controller = yield* Effect.scoped(
          Effect.gen(function* () {
            const buildActions = yield* makeWagmiActions;
            return yield* buildWagmiConfig(
              {
                chainIconMapping: undefined,
                walletListFactory,
                disableInjectedProviderDiscovery: true,
                enabledNetworks: new Set(),
                forceWalletConnectOnly: false,
                institutionalWallets: false,
                isLedgerLive: false,
                isMobileWallet: false,
                isSafe: false,
                mapWalletFn: undefined,
                walletPolicy: undefined,
                persistPublicKey: () => Effect.void,
                queryParams: Schema.decodeSync(InitParams)(emptyInitParams),
                solanaConnection: {} as SolanaConnection,
                solanaWallets: [],
                tonConnectManifestUrl: undefined,
                variant: "default",
              },
              buildActions,
              unusedStellarWalletsKitPlatform
            );
          }).pipe(Effect.provide(WagmiOperations.layer))
        );

        expect(controller.enabledNetworks).toEqual(new Set());
        expect(controller.evmConfig.evmChains).toEqual([]);
        expect(controller.cosmosConfig.cosmosWagmiChains).toEqual([]);
        expect(controller.miscConfig.miscChains).toEqual([]);
        expect(controller.substrateConfig.substrateChains).toEqual([]);
        expect(controller.wagmiConfig.connectors).toEqual([]);
        expect(walletListFactory).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "disposes MIPD ownership and ignores callbacks from the released scope",
    () =>
      Effect.gen(function* () {
        const publish = vi.fn();
        const unsubscribe = vi.fn();
        let publishAfterRelease: (() => void) | undefined;

        yield* Effect.scoped(
          scopedMipdSubscription({
            initialProviders: [],
            publish,
            subscribe: (onProviders) => {
              publishAfterRelease = () => onProviders([]);
              return unsubscribe;
            },
          })
        );

        expect(publish).toHaveBeenCalledOnce();
        expect(unsubscribe).toHaveBeenCalledOnce();

        publishAfterRelease?.();
        expect(publish).toHaveBeenCalledOnce();
      })
  );
});
