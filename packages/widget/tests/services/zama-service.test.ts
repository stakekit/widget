import { describe, expect, it } from "@effect/vitest";
import {
  Effect,
  HashMap,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { decodeFunctionData, erc20Abi } from "viem";
import { sepolia } from "viem/chains";
import { vi } from "vitest";
import {
  type ConfidentialConversion,
  ConfidentialTokenBalanceKey,
} from "../../src/domain/earn/confidential";
import { ConfidentialHandle } from "../../src/domain/earn/models";
import {
  WalletAddress,
  WalletSignature,
} from "../../src/domain/identity/identifiers";
import { EvmChainIds } from "../../src/domain/wallet/chain-ids";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../src/domain/wallet/wallet-scope";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { RevealedBalances } from "../../src/services/zama/revealed-balances";
import {
  type ConfidentialPreparation,
  ZamaService,
} from "../../src/services/zama/zama-service";
import { confidentialFixture, confidentialYieldFixture } from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeTestWallet } from "../utils/services/wallet-service";
import { makeTestDomainEvents } from "../utils/transaction-workflow-test-kit";

const sdk = vi.hoisted(() => ({
  balanceOf: vi.fn(),
  configs: [] as Array<{
    readonly chains: ReadonlyArray<{
      readonly auth?: unknown;
      readonly network?: unknown;
      readonly relayerUrl?: string;
    }>;
    readonly signer: { signTypedData: (data: unknown) => Promise<string> };
  }>,
  decryptPublicValues: vi.fn(),
  decryptValues: vi.fn(),
  encrypt: vi.fn(),
}));

const clientConfigs = vi.hoisted(
  () => [] as Array<{ readonly chain?: { readonly id: number } }>
);
const client = vi.hoisted(() => ({
  readContract: vi.fn(),
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
// Probes the page's origin, which Node does not have.
vi.mock("../../src/services/zama/encrypt-worker", () => ({
  loadEncryptWorker: () => Effect.succeed("encrypt.worker.js"),
}));
vi.mock("@zama-fhe/sdk/viem", () => ({
  ViemProvider: class {},
}));
vi.mock("@zama-fhe/sdk", () => ({
  BaseSigner: class {},
  createConfig: (config: unknown) => config,
  memoryStorage: {},
  ZamaSDK: class {
    decryption = {
      decryptPublicValues: sdk.decryptPublicValues,
      decryptValues: sdk.decryptValues,
    };
    encrypt = sdk.encrypt;
    constructor(config: (typeof sdk.configs)[number]) {
      sdk.configs.push(config);
    }
    createToken() {
      return { balanceOf: sdk.balanceOf };
    }
    terminate() {}
  },
}));

const owner = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const { cUsdc, router, usdc } = confidentialFixture;
const conversion = {
  chainId: EvmChainIds.EthereumSepolia,
  underlying: usdc.address,
  wrapper: cUsdc.address,
} satisfies ConfidentialConversion;

// The SDK returns 32-byte hex handles.
const amountHandle = `0x${"01".repeat(32)}`;
const legHandles = [`0x${"02".repeat(32)}`, `0x${"03".repeat(32)}`];

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
  readonly canSignPermit?: boolean;
  readonly state?: SubscriptionRef.SubscriptionRef<WalletState>;
  readonly getClient?: (input: { readonly chainId: number }) => {
    readonly request: (args: unknown) => Promise<unknown>;
  };
  readonly wagmiChains?: ReadonlyArray<{ readonly id: number }>;
  readonly signPermit?: (input: unknown) => Effect.Effect<WalletSignature>;
}) {
  const wallet = yield* makeTestWallet({
    canSignPermit: Effect.succeed(options.canSignPermit ?? true),
    state:
      options.state ??
      (yield* SubscriptionRef.make<WalletState>(
        makeConnectedWalletState(scope)
      )),
    wagmiConfig: {
      chains: options.wagmiChains ?? [],
      getClient: options.getClient,
    } as never,
    ...(options.signPermit ? { signPermit: options.signPermit } : {}),
  });
  const events = yield* makeTestDomainEvents();
  const dependencies = Layer.mergeAll(
    wallet.layer,
    events.layer,
    RevealedBalances.layer,
    WidgetConfigService.layer({
      apiKey: options.apiKey ?? "test",
      yieldsApiUrl: "https://api.example.test/",
    })
  );
  return {
    events: events.service,
    layer: Layer.merge(
      dependencies,
      ZamaService.layer.pipe(Layer.provide(dependencies))
    ),
  };
});

const planConversion = (readAllowance: () => Promise<bigint>) =>
  Effect.gen(function* () {
    client.readContract.mockImplementationOnce(readAllowance);
    const { layer } = yield* makeLayer({});
    const planned = yield* ZamaService.use((zama) =>
      zama.planConversion({
        amount: 5_000_000n,
        conversion,
        network: "ethereum-sepolia",
        owner,
      })
    ).pipe(Effect.provide(layer));

    return planned.map((transaction) => ({
      args:
        transaction.type === "WRAP"
          ? null
          : decodeFunctionData({ abi: erc20Abi, data: transaction.data }).args,
      to: transaction.to,
      type: transaction.type,
    }));
  });

const depositPreparation = (
  pick: "asset" | "underlying"
): Extract<ConfidentialPreparation, { readonly _tag: "Encrypt" }> => {
  const yieldDto = confidentialYieldFixture();
  const token = pick === "asset" ? yieldDto.inputTokens[0]! : yieldDto.token;
  return {
    _tag: "Encrypt",
    amount: 5_000_000n,
    assetAddress: cUsdc.address,
    balance: pick === "asset" ? { chainId: 11155111, token } : null,
    command: {
      address: owner,
      arguments: {
        amount: "5",
        ...(token.address === undefined ? {} : { inputToken: token.address }),
      },
      yieldId: yieldDto.id,
    },
    conversion: pick === "asset" ? null : conversion,
    instant: false,
    intent: "enter",
    requiresPermitSigner: true,
    yieldDto,
  };
};

const encryptAs = (handles: ReadonlyArray<string>, inputProof: string) =>
  Promise.resolve({ encryptedValues: handles, inputProof });

describe("ZamaService", () => {
  it.effect("plans only a wrap when the allowance already covers it", () =>
    Effect.gen(function* () {
      const planned = yield* planConversion(async () => 10_000_000n);

      expect(planned).toEqual([
        { args: null, to: cUsdc.address, type: "WRAP" },
      ]);
    })
  );

  it.effect("plans an approve first when the allowance is short", () =>
    Effect.gen(function* () {
      const planned = yield* planConversion(async () => 0n);

      expect(planned).toEqual([
        {
          args: [cUsdc.address, 5_000_000n],
          to: usdc.address,
          type: "APPROVAL",
        },
        { args: null, to: cUsdc.address, type: "WRAP" },
      ]);
    })
  );

  it.effect("plans an allowance reset when a partial allowance is left", () =>
    Effect.gen(function* () {
      const planned = yield* planConversion(async () => 1_000_000n);

      expect(planned.map(({ args, type }) => [type, args])).toEqual([
        ["RESET_APPROVAL", [cUsdc.address, 0n]],
        ["APPROVAL", [cUsdc.address, 5_000_000n]],
        ["WRAP", null],
      ]);
    })
  );

  it.effect("resets an allowance it cannot read before approving", () =>
    Effect.gen(function* () {
      const planned = yield* planConversion(() =>
        Promise.reject(new Error("rpc down"))
      );

      expect(planned.map(({ type }) => type)).toEqual([
        "RESET_APPROVAL",
        "APPROVAL",
        "WRAP",
      ]);
    })
  );

  it.effect(
    "encrypts a cUSDC deposit's amount and its zero-padded legs into the request",
    () =>
      Effect.gen(function* () {
        sdk.balanceOf.mockResolvedValueOnce(5_000_000n);
        sdk.encrypt
          .mockImplementationOnce(() => encryptAs([amountHandle], "0xap"))
          .mockImplementationOnce(() => encryptAs(legHandles, "0xlp"));
        const { layer } = yield* makeLayer({});

        const command = yield* ZamaService.use((zama) =>
          zama.encryptCommand(depositPreparation("asset"))
        ).pipe(Effect.provide(layer));

        expect(
          sdk.encrypt.mock.calls.map(([input]) => [
            input.contractAddress,
            input.values.map(({ value }: { value: bigint }) => value),
          ])
        ).toEqual([
          [cUsdc.address, [5_000_000n]],
          [router, [0n, 5_000_000n]],
        ]);
        expect(command.arguments).toEqual({
          encryptedAmount: amountHandle,
          encryptedAmountProof: "0xap",
          encryptedLegAmounts: legHandles,
          encryptedLegProof: "0xlp",
          inputToken: cUsdc.address,
        });
      })
  );

  it.effect("encrypts the wrapped amount of an underlying deposit", () =>
    Effect.gen(function* () {
      client.readContract.mockResolvedValueOnce(2n);
      sdk.encrypt.mockImplementation(() => encryptAs([amountHandle], "0xp"));
      const { layer } = yield* makeLayer({});

      yield* ZamaService.use((zama) =>
        zama.encryptCommand(depositPreparation("underlying"))
      ).pipe(Effect.provide(layer));

      expect(
        sdk.encrypt.mock.calls.map(([input]) =>
          input.values.map(({ value }: { value: bigint }) => value)
        )
      ).toEqual([[2_500_000n], [0n, 2_500_000n]]);
      sdk.encrypt.mockReset();
    })
  );

  it.effect(
    "rejects a cUSDC deposit above the hidden balance without encrypting",
    () =>
      Effect.gen(function* () {
        sdk.balanceOf.mockResolvedValueOnce(4_999_999n);
        const { layer } = yield* makeLayer({});

        const error = yield* ZamaService.use((zama) =>
          zama.encryptCommand(depositPreparation("asset"))
        ).pipe(Effect.provide(layer), Effect.flip);

        expect(error).toMatchObject({ retryable: false });
        expect(sdk.encrypt).not.toHaveBeenCalled();
      })
  );

  it.effect("rejects a deposit the wallet could never reveal again", () =>
    Effect.gen(function* () {
      const { layer } = yield* makeLayer({ canSignPermit: false });

      const error = yield* ZamaService.use((zama) =>
        zama.encryptCommand(depositPreparation("asset"))
      ).pipe(Effect.provide(layer), Effect.flip);

      expect(error).toMatchObject({
        message: "This wallet cannot reveal confidential balances.",
        retryable: false,
      });
    })
  );

  it.effect("withdraws an unwrap with its publicly decrypted amount", () =>
    Effect.gen(function* () {
      sdk.decryptPublicValues.mockResolvedValueOnce({
        clearValues: { [`0x${"ab".repeat(32)}`]: 7_000_000n },
        decryptionProof: "0xproof",
      });
      const { layer } = yield* makeLayer({});
      const yieldDto = confidentialYieldFixture();

      const command = yield* ZamaService.use((zama) =>
        zama.decryptCommand({
          _tag: "Decrypt",
          chainId: 11155111,
          command: {
            action: "WITHDRAW",
            address: owner,
            passthrough: "unwrap",
            yieldId: yieldDto.id,
          },
          handle: Schema.decodeSync(ConfidentialHandle)(`0x${"ab".repeat(32)}`),
        })
      ).pipe(Effect.provide(layer));

      expect(sdk.decryptPublicValues).toHaveBeenCalledWith([
        `0x${"ab".repeat(32)}`,
      ]);
      expect(command.arguments).toMatchObject({
        decryptedAmount: "7000000",
        decryptionProof: "0xproof",
      });
    })
  );

  it.effect(
    "reveals handles through the Yield API relayer proxy and the wallet-signed permit",
    () =>
      Effect.gen(function* () {
        const handle = permitHandle;
        sdk.decryptValues.mockResolvedValueOnce({ [handle]: 42n });
        const signed: Array<unknown> = [];
        const { layer } = yield* makeLayer({
          apiKey: "yield-key",
          signPermit: (input) =>
            Effect.sync(() => {
              signed.push(input);
              return WalletSignature.make("0x5167");
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
            values: yield* (yield* RevealedBalances).current,
          };
        }).pipe(Effect.provide(layer));

        expect(sdk.configs.at(-1)?.chains[0]).toMatchObject({
          auth: { __type: "ApiKeyHeader", value: "yield-key" },
          relayerUrl: "https://api.example.test/v1/zama/relayer/11155111/",
        });
        expect(values.handles.get(handle)).toBe(42n);
        expect(signature).toBe("0x5167");
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
        sdk.decryptValues.mockResolvedValue({});
        const forwarded: Array<unknown> = [];
        const reveal = ZamaService.use((zama) =>
          zama.revealHandles({ chainId: 11155111, handles: [], owner })
        );

        const own = yield* makeLayer({
          getClient: () => ({
            request: async (args) => {
              forwarded.push(args);
              return "0xaa36a7";
            },
          }),
          wagmiChains: [sepolia],
        });
        yield* reveal.pipe(Effect.provide(own.layer));
        const network = sdk.configs.at(-1)?.chains[0]?.network as {
          readonly request: (args: unknown) => Promise<unknown>;
        };
        yield* Effect.promise(() => network.request({ method: "eth_chainId" }));
        yield* reveal.pipe(Effect.provide((yield* makeLayer({})).layer));

        expect(forwarded).toEqual([{ method: "eth_chainId" }]);
        expect(sdk.configs.at(-1)?.chains[0]?.network).toBe("https://rpc.test");
      })
  );

  it.effect("forgets revealed values when the wallet account changes", () =>
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<WalletState>(
        makeConnectedWalletState(scope)
      );
      const { layer } = yield* makeLayer({ state });

      const { after, before } = yield* Effect.gen(function* () {
        yield* ZamaService;
        const values = yield* RevealedBalances;
        yield* values.addHandles([[revealedHandle, 1n]]);
        yield* SubscriptionRef.set(state, makeConnectedWalletState(scope));
        yield* Effect.yieldNow;
        const before = yield* values.current;
        yield* SubscriptionRef.set(state, makeConnectedWalletState(otherScope));
        const after = yield* values.changes.pipe(
          Stream.filter((current) => current.handles.size === 0),
          Stream.runHead
        );
        return { after, before };
      }).pipe(Effect.provide(layer));

      expect(before.handles.get(revealedHandle)).toBe(1n);
      expect(after._tag).toBe("Some");
    })
  );

  it.effect(
    "forgets the owner's revealed balances once a Yield workflow moves funds",
    () =>
      Effect.gen(function* () {
        const { events, layer } = yield* makeLayer({});
        const [token] = confidentialYieldFixture().inputTokens;
        const ownBalance = new ConfidentialTokenBalanceKey({
          owner,
          token: token!,
        });
        const otherBalance = new ConfidentialTokenBalanceKey({
          owner: otherScope.address,
          token: token!,
        });

        const remaining = yield* Effect.gen(function* () {
          yield* ZamaService;
          const values = yield* RevealedBalances;
          yield* values.addTokenBalance(ownBalance, 1n);
          yield* values.addTokenBalance(otherBalance, 2n);
          yield* values.addHandles([[revealedHandle, 3n]]);
          yield* Effect.yieldNow;
          yield* events.publish({
            _tag: "TransactionWorkflowResourcesChanged",
            owner: walletScopeOwnerKey(scope),
            workflowKind: "Yield",
          });
          return yield* values.changes.pipe(
            Stream.filter(
              (current) => !HashMap.has(current.tokenBalances, ownBalance)
            ),
            Stream.runHead
          );
        }).pipe(Effect.provide(layer));

        expect(
          remaining._tag === "Some"
            ? {
                handles: [...remaining.value.handles.keys()],
                tokenBalances: [...HashMap.keys(remaining.value.tokenBalances)],
              }
            : null
        ).toEqual({ handles: [revealedHandle], tokenBalances: [otherBalance] });
      })
  );
});
