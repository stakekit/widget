import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import { decodeFunctionData, erc20Abi } from "viem";
import { sepolia } from "viem/chains";
import { vi } from "vitest";
import { ConfidentialHandle } from "../../src/domain/earn/confidential";
import {
  ActionId,
  WalletAddress,
  YieldId,
} from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import type {
  ClassicActionMeta,
  WalletSignTransactionInput,
} from "../../src/services/wallet/wallet-transactions";
import { ConfidentialValues } from "../../src/services/zama/confidential-values";
import { ZamaService } from "../../src/services/zama/zama-service";
import { confidentialFixture } from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";

const sdk = vi.hoisted(() => ({
  configs: [] as Array<{
    readonly chains: ReadonlyArray<{
      readonly auth?: unknown;
      readonly network?: unknown;
      readonly relayerUrl?: string;
    }>;
    readonly signer: { signTypedData: (data: unknown) => Promise<string> };
  }>,
  decryptValues: vi.fn(),
  encrypt: vi.fn(),
}));

const clientConfigs = vi.hoisted(
  () => [] as Array<{ readonly chain?: { readonly id: number } }>
);
const client = vi.hoisted(() => ({
  estimateFeesPerGas: vi.fn(async () => ({
    maxFeePerGas: 30n,
    maxPriorityFeePerGas: 2n,
  })),
  estimateGas: vi.fn(async () => 100n),
  getChainId: vi.fn(async () => 11155111),
  getTransactionCount: vi.fn(async () => 7),
  readContract: vi.fn(),
  sendRawTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: (config: (typeof clientConfigs)[number]) => {
    clientConfigs.push(config);
    return client;
  },
}));
vi.mock("@zama-fhe/sdk/chains", () => ({
  chains: { 11155111: { id: 11155111, network: "https://rpc.test" } },
}));
vi.mock("@zama-fhe/sdk/web", () => ({ web: () => ({ type: "web" }) }));
vi.mock("@zama-fhe/sdk/viem", () => ({
  ViemProvider: class {},
}));
vi.mock("@zama-fhe/sdk", () => ({
  BaseSigner: class {},
  createConfig: (config: unknown) => config,
  memoryStorage: {},
  ZamaSDK: class {
    decryption = { decryptValues: sdk.decryptValues };
    encrypt = sdk.encrypt;
    constructor(config: (typeof sdk.configs)[number]) {
      sdk.configs.push(config);
    }
    terminate() {}
  },
}));

const owner = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const { cUsdc, usdc } = confidentialFixture;
const conversion = {
  chainId: 11155111,
  underlying: usdc.address,
  wrapper: cUsdc.address,
};
const actionMeta: ClassicActionMeta = {
  actionId: ActionId.make("action-1"),
  actionType: "STAKE",
  address: owner,
  amount: "5",
  amountRaw: null,
  inputToken: undefined,
  providersDetails: [],
  rawArguments: null,
  yieldId: YieldId.make("ethereum-sepolia-zama-vault"),
};

const revealedHandle = Schema.decodeSync(ConfidentialHandle)(
  `0x${"cd".repeat(32)}`
);
const permitHandle = Schema.decodeSync(ConfidentialHandle)(
  `0x${"ab".repeat(32)}`
);

const scope = new WalletScopeKey({
  address: owner,
  network: "ethereum-sepolia",
});

const otherScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  ),
  network: "ethereum-sepolia",
});

const makeLayer = Effect.fn("makeZamaTestLayer")(function* (options: {
  readonly apiKey?: string;
  readonly state?: SubscriptionRef.SubscriptionRef<WalletState>;
  readonly getClient?: (input: { readonly chainId: number }) => {
    readonly request: (args: unknown) => Promise<unknown>;
  };
  readonly wagmiChains?: ReadonlyArray<{ readonly id: number }>;
  readonly signTransaction?: (
    input: WalletSignTransactionInput
  ) => Effect.Effect<{ broadcasted: true; signedTx: string }>;
  readonly signPermit?: (input: unknown) => Effect.Effect<`0x${string}`>;
}) {
  const wallet = yield* makeTestWallet({
    state:
      options.state ??
      (yield* SubscriptionRef.make<WalletState>(
        makeConnectedWalletState(scope)
      )),
    wagmiConfig: {
      chains: options.wagmiChains ?? [],
      getClient: options.getClient,
    } as never,
    ...(options.signTransaction
      ? { signTransaction: options.signTransaction }
      : {}),
    ...(options.signPermit ? { signPermit: options.signPermit } : {}),
  });
  const dependencies = Layer.mergeAll(
    wallet.layer,
    ConfidentialValues.layer,
    WidgetConfigService.layer({
      apiKey: options.apiKey ?? "test",
      yieldsApiUrl: "https://api.example.test/",
    })
  );
  return Layer.merge(
    dependencies,
    ZamaService.layer.pipe(Layer.provide(dependencies))
  );
});

describe("ZamaService", () => {
  it.effect("plans only a wrap when the allowance already covers it", () =>
    Effect.gen(function* () {
      client.readContract.mockResolvedValueOnce(10_000_000n);
      const layer = yield* makeLayer({});

      const steps = yield* ZamaService.use((zama) =>
        zama.conversionSteps({ amount: 5_000_000n, conversion, owner })
      ).pipe(Effect.provide(layer));

      expect(steps).toEqual(["wrap"]);
    })
  );

  it.effect("plans an approve first when the allowance is short", () =>
    Effect.gen(function* () {
      client.readContract.mockResolvedValueOnce(0n);
      const layer = yield* makeLayer({});

      const steps = yield* ZamaService.use((zama) =>
        zama.conversionSteps({ amount: 5_000_000n, conversion, owner })
      ).pipe(Effect.provide(layer));

      expect(steps).toEqual(["approve", "wrap"]);
    })
  );

  it.effect("plans an allowance reset when a partial allowance is left", () =>
    Effect.gen(function* () {
      client.readContract.mockResolvedValueOnce(1_000_000n);
      const layer = yield* makeLayer({});

      const steps = yield* ZamaService.use((zama) =>
        zama.conversionSteps({ amount: 5_000_000n, conversion, owner })
      ).pipe(Effect.provide(layer));

      expect(steps).toEqual(["approve-reset", "approve", "wrap"]);
    })
  );

  it.effect(
    "sends one conversion step and reports the broadcast before the receipt",
    () =>
      Effect.gen(function* () {
        const events: Array<string> = [];
        client.readContract.mockResolvedValueOnce(0n);
        client.waitForTransactionReceipt.mockImplementationOnce(async () => {
          events.push("receipt");
          return { status: "success" };
        });
        const sent: Array<WalletSignTransactionInput> = [];
        const layer = yield* makeLayer({
          signTransaction: (input) =>
            Effect.sync(() => {
              sent.push(input);
              return { broadcasted: true, signedTx: "0xhash" } as const;
            }),
        });

        yield* ZamaService.use((zama) =>
          Effect.all([
            zama.convertStep({
              actionMeta,
              amount: 5_000_000n,
              conversion,
              network: "ethereum-sepolia",
              onBroadcast: Effect.sync(() => events.push("broadcast")),
              owner,
              step: "approve",
              walletScope: scope,
            }),
            zama.convertStep({
              actionMeta,
              amount: 5_000_000n,
              conversion,
              network: "ethereum-sepolia",
              onBroadcast: Effect.void,
              owner,
              step: "wrap",
              walletScope: scope,
            }),
          ])
        ).pipe(Effect.provide(layer));

        expect(events).toEqual(["broadcast", "receipt"]);
        expect(sent.map((input) => input.txMeta.txId)).toEqual([
          "action-1-approve",
          "action-1-wrap",
        ]);
        expect(JSON.parse(sent[0]!.tx).to).toBe(usdc.address);
        expect(JSON.parse(sent[1]!.tx)).toMatchObject({
          chainId: 11155111,
          from: owner,
          gasLimit: "0x78",
          to: cUsdc.address,
          type: 2,
        });
      })
  );

  it.effect("resets the allowance to zero and approves as separate steps", () =>
    Effect.gen(function* () {
      const sent: Array<WalletSignTransactionInput> = [];
      const layer = yield* makeLayer({
        signTransaction: (input) =>
          Effect.sync(() => {
            sent.push(input);
            return { broadcasted: true, signedTx: "0xhash" } as const;
          }),
      });

      yield* ZamaService.use((zama) =>
        Effect.forEach(["approve-reset", "approve"] as const, (step) =>
          zama.convertStep({
            actionMeta,
            amount: 5_000_000n,
            conversion,
            network: "ethereum-sepolia",
            onBroadcast: Effect.void,
            owner,
            step,
            walletScope: scope,
          })
        )
      ).pipe(Effect.provide(layer));

      expect(sent.map((input) => input.txMeta.txId)).toEqual([
        "action-1-approve-reset",
        "action-1-approve",
      ]);
      expect(
        sent.map(
          (input) =>
            decodeFunctionData({
              abi: erc20Abi,
              data: JSON.parse(input.tx).data,
            }).args
        )
      ).toEqual([
        [cUsdc.address, 0n],
        [cUsdc.address, 5_000_000n],
      ]);
    })
  );

  it.effect(
    "reveals handles through the Yield API relayer proxy and the wallet-signed permit",
    () =>
      Effect.gen(function* () {
        const handle = permitHandle;
        sdk.decryptValues.mockResolvedValueOnce({ [handle]: 42n });
        const signed: Array<unknown> = [];
        const layer = yield* makeLayer({
          apiKey: "yield-key",
          signPermit: (input) =>
            Effect.sync(() => {
              signed.push(input);
              return "0xsig" as const;
            }),
        });

        const permit = {
          domain: { chainId: 11155111n, name: "Decryption", version: "1" },
          message: { publicKey: "0x00" },
          primaryType: "UserDecryptRequestVerification",
          types: {
            UserDecryptRequestVerification: [
              { name: "publicKey", type: "bytes" },
            ],
          },
        };
        const { signature, values } = yield* Effect.gen(function* () {
          const zama = yield* ZamaService;
          yield* zama.revealHandles({
            chainId: 11155111,
            handles: [{ contract: cUsdc.address, handle }],
            owner,
          });
          const signer = sdk.configs.at(-1)?.signer;
          return {
            signature: yield* Effect.promise(
              () => signer?.signTypedData(permit) ?? Promise.resolve(null)
            ),
            values: yield* (yield* ConfidentialValues).current,
          };
        }).pipe(Effect.provide(layer));

        expect(sdk.configs.at(-1)?.chains[0]).toMatchObject({
          auth: { __type: "ApiKeyHeader", value: "yield-key" },
          relayerUrl: "https://api.example.test/v1/zama/relayer/11155111/",
        });
        expect(values.get(handle)).toBe(42n);
        expect(signature).toBe("0xsig");
        expect(signed).toEqual([
          {
            expectedOwner: { address: owner, network: "ethereum-sepolia" },
            meta: { address: owner, chainId: 11155111, contracts: [] },
            typedData: {
              ...permit,
              domain: { ...permit.domain, chainId: 11155111 },
            },
          },
        ]);
      })
  );

  it.effect(
    "gives the SDK the widget's RPC for its own reads instead of the public preset",
    () =>
      Effect.gen(function* () {
        sdk.encrypt.mockResolvedValue({
          encryptedValues: ["0xhandle"],
          inputProof: "0xproof",
        });
        const forwarded: Array<unknown> = [];
        const encrypt = ZamaService.use((zama) =>
          zama.encrypt({
            owner,
            plan: {
              amount: { contract: cUsdc.address, value: 1n },
              chainId: 11155111,
              legs: null,
            },
          })
        );

        yield* encrypt.pipe(
          Effect.provide(
            yield* makeLayer({
              getClient: () => ({
                request: async (args) => {
                  forwarded.push(args);
                  return "0xaa36a7";
                },
              }),
              wagmiChains: [sepolia],
            })
          )
        );
        const network = sdk.configs.at(-1)?.chains[0]?.network as {
          readonly request: (args: unknown) => Promise<unknown>;
        };
        yield* Effect.promise(() => network.request({ method: "eth_chainId" }));
        yield* encrypt.pipe(Effect.provide(yield* makeLayer({})));

        expect(forwarded).toEqual([{ method: "eth_chainId" }]);
        expect(sdk.configs.at(-1)?.chains[0]?.network).toBe("https://rpc.test");
      })
  );

  it.effect("forgets revealed values when the wallet account changes", () =>
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<WalletState>(
        makeConnectedWalletState(scope)
      );
      const layer = yield* makeLayer({ state });

      const { after, before } = yield* Effect.gen(function* () {
        yield* ZamaService;
        const values = yield* ConfidentialValues;
        yield* values.add([[revealedHandle, 1n]]);
        yield* SubscriptionRef.set(state, makeConnectedWalletState(scope));
        yield* Effect.yieldNow;
        const before = yield* values.current;
        yield* SubscriptionRef.set(state, makeConnectedWalletState(otherScope));
        const after = yield* values.changes.pipe(
          Stream.filter((current) => current.size === 0),
          Stream.runHead
        );
        return { after, before };
      }).pipe(Effect.provide(layer));

      expect(before.get(revealedHandle)).toBe(1n);
      expect(after._tag).toBe("Some");
    })
  );
});
