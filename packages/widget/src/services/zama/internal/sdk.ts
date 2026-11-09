import type * as ZamaCore from "@zama-fhe/sdk";
import type { ZamaSDK } from "@zama-fhe/sdk";
import type { FheChain } from "@zama-fhe/sdk/chains";
import type * as ZamaViem from "@zama-fhe/sdk/viem";
import type * as ZamaWeb from "@zama-fhe/sdk/web";
import { Effect, Schema } from "effect";
import { HttpClient } from "effect/http";
import {
  createPublicClient,
  custom,
  type EIP1193Provider,
  type Hex,
  http,
  type PublicClient,
} from "viem";
import { ConfidentialHandle } from "../../../domain/earn/balance";
import type {
  ConfidentialChainId,
  ConfidentialEncryption,
  ConfidentialEncryptionPlan,
} from "../../../domain/earn/confidential";
import type { WalletAddress } from "../../../domain/identity/identifiers";
import type { Token } from "../../../domain/token/token";
import { WidgetConfigService } from "../../config/widget-config";
import { WalletService } from "../../wallet/wallet-service";
import type { EncryptWorkerSource } from "../encrypt-worker";
import { makePermitSigner } from "./permit-signer";
import { toEvmAddress, tryZama, ZamaError } from "./zama-error";

// The SDK returns hex handles; the domain keeps them branded.
const EncryptedHandles = Schema.Struct({
  amount: Schema.NullOr(ConfidentialHandle),
  legs: Schema.NullOr(Schema.Array(ConfidentialHandle)),
});

type ZamaModules = Readonly<{
  readonly chains: Record<number, FheChain>;
  readonly core: typeof ZamaCore;
  readonly encryptWorker: EncryptWorkerSource;
  readonly viem: typeof ZamaViem;
  readonly web: typeof ZamaWeb;
}>;

export type HandleInput = Readonly<{
  readonly contract: string;
  readonly handle: ConfidentialHandle;
}>;

type DecryptInput = {
  readonly chainId: ConfidentialChainId;
  readonly owner: WalletAddress;
};

/**
 * The Zama SDK adapter: loads the SDK lazily, keeps one SDK per owner and
 * relayer, signs its permits through the wallet, and encrypts and decrypts.
 * It stores no cleartext; the service does.
 */
export type ZamaSdkAdapter = Readonly<{
  /** The amounts `handles` hide from everyone but `owner`; may ask for a permit. */
  readonly decryptHandles: (
    input: DecryptInput & { readonly handles: ReadonlyArray<HandleInput> }
  ) => Effect.Effect<
    ReadonlyArray<readonly [ConfidentialHandle, bigint]>,
    ZamaError
  >;
  /** `owner`'s hidden balance of `token`; may ask for a permit. */
  readonly decryptTokenBalance: (
    input: DecryptInput & { readonly token: Token }
  ) => Effect.Effect<bigint, ZamaError>;
  /** `plan`'s amounts encrypted for `owner`; asks the wallet for nothing. */
  readonly encrypt: (input: {
    readonly owner: WalletAddress;
    readonly plan: ConfidentialEncryptionPlan;
  }) => Effect.Effect<ConfidentialEncryption, ZamaError>;
  /** The chain's widget RPC when it is configured, else Zama's preset RPC. */
  readonly getPublicClient: (
    chainId: ConfidentialChainId
  ) => Effect.Effect<PublicClient, ZamaError>;
  /** A publicly decryptable handle's amount, with the proof a contract checks. */
  readonly publicDecrypt: (
    input: DecryptInput & { readonly requestId: ConfidentialHandle }
  ) => Effect.Effect<
    { readonly cleartext: bigint; readonly decryptionProof: Hex },
    ZamaError
  >;
}>;

export const makeZamaSdk = Effect.gen(function* () {
  const wallet = yield* WalletService;
  const widgetConfig = yield* WidgetConfigService;
  const httpClient = yield* HttpClient.HttpClient;
  const makeSigner = yield* makePermitSigner;

  // Lazy: the SDK pulls in FHE WASM.
  const modules = yield* Effect.cached(
    Effect.all(
      [
        tryZama("load-sdk", () =>
          Promise.all([
            import("@zama-fhe/sdk"),
            import("@zama-fhe/sdk/viem"),
            import("@zama-fhe/sdk/web"),
            import("@zama-fhe/sdk/chains"),
          ])
        ),
        tryZama("load-sdk", () => import("../encrypt-worker")).pipe(
          Effect.flatMap((worker) => worker.loadEncryptWorker(httpClient))
        ),
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.map(
        ([[core, viem, web, chains], encryptWorker]) =>
          ({
            chains: chains.chains,
            core,
            encryptWorker,
            viem,
            web,
          }) satisfies ZamaModules
      )
    )
  );

  const sdks = new Map<string, ZamaSDK>();
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      for (const sdk of sdks.values()) sdk.terminate();
    })
  );

  // Read-only, so wallet events never fire.
  const widgetRpcProvider = (chainId: ConfidentialChainId): EIP1193Provider => {
    const client = wallet.wagmiConfig.getClient({ chainId });
    return {
      on: () => {},
      removeListener: () => {},
      // biome-ignore lint/nursery/noUnsafeTypeAssertion: viem types a client's `request` by its RPC schema, which its own `EIP1193Provider["request"]` overloads do not accept though both send the same EIP-1193 requests.
      request: client.request as EIP1193Provider["request"],
    };
  };

  const getChain = (zama: ZamaModules, chainId: ConfidentialChainId) =>
    Effect.gen(function* () {
      const preset = zama.chains[chainId];
      if (!preset) {
        return yield* new ZamaError({
          cause: `No Zama deployment on chain ${chainId}`,
          operation: "chain",
        });
      }
      const { apiKey, yieldsApiUrl } = yield* widgetConfig.current;
      const ownRpc = wallet.wagmiConfig.chains.some(({ id }) => id === chainId);
      // The Yield API proxies the relayer and adds the Zama key server-side.
      return {
        ...preset,
        ...(ownRpc ? { network: widgetRpcProvider(chainId) } : {}),
        auth: { __type: "ApiKeyHeader", value: apiKey },
        relayerUrl: `${yieldsApiUrl.replace(/\/$/, "")}/v1/zama/relayer/${chainId}/`,
      } satisfies FheChain;
    });

  // The Zama preset RPC is only a fallback.
  const publicClientFor = (chain: FheChain): PublicClient =>
    createPublicClient({
      chain: wallet.wagmiConfig.chains.find(({ id }) => id === chain.id),
      transport:
        typeof chain.network === "string"
          ? http(chain.network)
          : custom(chain.network),
    });

  const getSdk = Effect.fn("ZamaService.getSdk")(function* (
    chainId: ConfidentialChainId,
    owner: WalletAddress
  ) {
    const zama = yield* modules;
    const chain = yield* getChain(zama, chainId);
    const apiKey =
      chain.auth?.__type === "ApiKeyHeader" ? chain.auth.value : "";
    const key = `${chainId}:${owner.toLowerCase()}:${chain.relayerUrl}:${apiKey}`;
    const cached = sdks.get(key);
    if (cached) return cached;

    const sdk = new zama.core.ZamaSDK(
      zama.core.createConfig({
        chains: [chain],
        provider: new zama.viem.ViemProvider({
          publicClient: publicClientFor(chain),
        }),
        relayers: {
          [chain.id]: zama.web.web(
            zama.encryptWorker === undefined
              ? {}
              : { offloadWorker: zama.encryptWorker }
          ),
        },
        signer: makeSigner(
          zama.core.BaseSigner,
          owner,
          yield* toEvmAddress(owner, "signer"),
          chainId
        ),
        // The default IndexedDB would keep keys and cleartexts for 30 days.
        storage: zama.core.memoryStorage,
      })
    );
    sdks.set(key, sdk);
    return sdk;
  });

  const getPublicClient: ZamaSdkAdapter["getPublicClient"] = Effect.fn(
    "ZamaService.getPublicClient"
  )(function* (chainId) {
    return publicClientFor(yield* getChain(yield* modules, chainId));
  });

  const encrypt: ZamaSdkAdapter["encrypt"] = Effect.fn("ZamaService.encrypt")(
    function* ({ owner, plan }) {
      const sdk = yield* getSdk(plan.chainId, owner);
      const userAddress = yield* toEvmAddress(owner, "encrypt");
      const encryptValues = (contract: string, inputs: ReadonlyArray<bigint>) =>
        toEvmAddress(contract, "encrypt").pipe(
          Effect.flatMap((contractAddress) =>
            tryZama("encrypt", () =>
              sdk.encrypt({
                contractAddress,
                userAddress,
                values: inputs.map((value) => ({ type: "euint64", value })),
              })
            )
          )
        );

      const [amount, legs] = yield* Effect.all([
        plan.amount
          ? encryptValues(plan.amount.contract, [plan.amount.value])
          : Effect.succeed(null),
        plan.legs
          ? encryptValues(plan.legs.contract, plan.legs.values)
          : Effect.succeed(null),
      ]);
      const handles = yield* Schema.decodeEffect(EncryptedHandles)({
        amount: amount?.encryptedValues[0] ?? null,
        legs: legs?.encryptedValues ?? null,
      }).pipe(
        Effect.mapError(
          (cause) => new ZamaError({ cause, operation: "encrypt" })
        )
      );

      return {
        amount:
          amount && handles.amount
            ? { handle: handles.amount, proof: amount.inputProof }
            : null,
        legs:
          legs && handles.legs
            ? { handles: handles.legs, proof: legs.inputProof }
            : null,
      } satisfies ConfidentialEncryption;
    }
  );

  const decryptHandles: ZamaSdkAdapter["decryptHandles"] = Effect.fn(
    "ZamaService.decryptHandles"
  )(function* ({ chainId, handles, owner }) {
    const sdk = yield* getSdk(chainId, owner);
    const inputs = yield* Effect.forEach(handles, (input) =>
      toEvmAddress(input.contract, "decrypt").pipe(
        Effect.map((contractAddress) => ({
          contractAddress,
          encryptedValue: input.handle,
        }))
      )
    );
    const clear = yield* tryZama("decrypt", () =>
      sdk.decryption.decryptValues(inputs)
    );
    const cleartexts = new Map(
      Object.entries(clear).map(([handle, value]) => [
        handle.toLowerCase(),
        value,
      ])
    );
    return handles.flatMap(({ handle }) => {
      const value = cleartexts.get(handle);
      return typeof value === "bigint" ? [[handle, value] as const] : [];
    });
  });

  const decryptTokenBalance: ZamaSdkAdapter["decryptTokenBalance"] = Effect.fn(
    "ZamaService.decryptTokenBalance"
  )(function* ({ chainId, owner, token }) {
    const address = token.address;
    if (!address) {
      return yield* new ZamaError({
        cause: "Token has no address",
        operation: "decrypt",
      });
    }
    const sdk = yield* getSdk(chainId, owner);
    const tokenAddress = yield* toEvmAddress(address, "decrypt");
    const ownerAddress = yield* toEvmAddress(owner, "decrypt");
    return yield* tryZama("decrypt", () =>
      sdk.createToken(tokenAddress).balanceOf(ownerAddress)
    );
  });

  const publicDecrypt: ZamaSdkAdapter["publicDecrypt"] = Effect.fn(
    "ZamaService.publicDecrypt"
  )(function* ({ chainId, owner, requestId }) {
    const sdk = yield* getSdk(chainId, owner);
    const decrypted = yield* tryZama("public-decrypt", () =>
      sdk.decryption.decryptPublicValues([requestId])
    );
    const cleartext = decrypted.clearValues[requestId];
    if (typeof cleartext !== "bigint") {
      return yield* new ZamaError({
        cause: decrypted,
        operation: "public-decrypt",
      });
    }
    return { cleartext, decryptionProof: decrypted.decryptionProof };
  });

  return {
    decryptHandles,
    decryptTokenBalance,
    encrypt,
    getPublicClient,
    publicDecrypt,
  } satisfies ZamaSdkAdapter;
});
