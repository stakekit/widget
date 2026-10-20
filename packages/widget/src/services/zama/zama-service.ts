import type { BaseSigner, EIP712TypedData, ZamaSDK } from "@zama-fhe/sdk";
import type { FheChain } from "@zama-fhe/sdk/chains";
import { Context, Data, Effect, FiberSet, Layer, Schema, Stream } from "effect";
import {
  type Address,
  createPublicClient,
  custom,
  type EIP1193Provider,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  http,
  numberToHex,
  type PublicClient,
  parseAbi,
} from "viem";
import {
  type ConfidentialConversion,
  type ConfidentialEncryption,
  type ConfidentialEncryptionPlan,
  type ConfidentialHandle,
  confidentialTokenBalanceKey,
  getConfidentialNetwork,
} from "../../domain/earn/confidential";
import { TransactionId } from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type { Token } from "../../domain/token/token";
import type { WalletScopeOwner } from "../../domain/wallet/wallet-scope";
import { WidgetConfigService } from "../config/widget-config";
import type { Eip712TypedData } from "../wallet/wallet-commands";
import { WalletService } from "../wallet/wallet-service";
import type { ClassicActionMeta } from "../wallet/wallet-transactions";
import { ConfidentialValues } from "./confidential-values";

export type ConfidentialConversionStep = "approve-reset" | "approve" | "wrap";

class ZamaError extends Data.TaggedError("ZamaError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

const wrapperAbi = parseAbi([
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function rate() view returns (uint256)",
]);

const PermitTypedData = Schema.Struct({
  domain: Schema.Struct({
    chainId: Schema.optionalKey(Schema.Union([Schema.Finite, Schema.BigInt])),
    name: Schema.optionalKey(Schema.String),
    verifyingContract: Schema.optionalKey(
      Schema.TemplateLiteral(["0x", Schema.String])
    ),
    version: Schema.optionalKey(Schema.String),
  }),
  message: Schema.Record(Schema.String, Schema.Unknown),
  primaryType: Schema.String,
  types: Schema.Record(
    Schema.String,
    Schema.Array(Schema.Struct({ name: Schema.String, type: Schema.String }))
  ),
});

type ZamaModules = Readonly<{
  readonly chains: Record<number, FheChain>;
  readonly core: typeof import("@zama-fhe/sdk");
  readonly viem: typeof import("@zama-fhe/sdk/viem");
  readonly web: typeof import("@zama-fhe/sdk/web");
}>;

type HandleInput = Readonly<{
  readonly contract: string;
  readonly handle: ConfidentialHandle;
}>;

type PublicDecryption = Readonly<{
  readonly cleartext: bigint;
  readonly decryptionProof: string;
}>;
type ZamaServiceApi = Readonly<{
  readonly conversionSteps: (input: {
    readonly amount: bigint;
    readonly conversion: ConfidentialConversion;
    readonly owner: string;
  }) => Effect.Effect<ReadonlyArray<ConfidentialConversionStep>, ZamaError>;
  readonly convertStep: (input: {
    readonly actionMeta: ClassicActionMeta;
    readonly amount: bigint;
    readonly conversion: ConfidentialConversion;
    readonly network: Network;
    /** Runs once the wallet has signed or broadcast, before the receipt arrives. */
    readonly onBroadcast: Effect.Effect<void>;
    readonly owner: string;
    readonly step: ConfidentialConversionStep;
    readonly walletScope: WalletScopeOwner;
  }) => Effect.Effect<void, ZamaError>;
  readonly publicDecrypt: (input: {
    readonly chainId: number;
    readonly owner: string;
    readonly requestId: string;
  }) => Effect.Effect<PublicDecryption, ZamaError>;
  readonly encrypt: (input: {
    readonly owner: string;
    readonly plan: ConfidentialEncryptionPlan;
  }) => Effect.Effect<ConfidentialEncryption, ZamaError>;
  readonly revealHandles: (input: {
    readonly chainId: number;
    readonly handles: ReadonlyArray<HandleInput>;
    readonly owner: string;
  }) => Effect.Effect<void, ZamaError>;
  readonly revealTokenBalance: (input: {
    readonly chainId: number;
    readonly owner: string;
    readonly token: Token;
  }) => Effect.Effect<bigint, ZamaError>;
  readonly wrappedAmount: (input: {
    readonly amount: bigint;
    readonly conversion: ConfidentialConversion;
  }) => Effect.Effect<bigint, ZamaError>;
}>;

const logRevealFailure = <A, R>(effect: Effect.Effect<A, ZamaError, R>) =>
  effect.pipe(
    Effect.tapError((error) =>
      Effect.logError("Zama reveal failed").pipe(
        Effect.annotateLogs({ cause: error.cause, operation: error.operation })
      )
    )
  );

const tryZama = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ZamaError({ cause, operation }),
  });

const makeZamaService = Effect.fn("makeZamaService")(function* () {
  const wallet = yield* WalletService;
  const widgetConfig = yield* WidgetConfigService;
  const values = yield* ConfidentialValues;
  const runPromise = yield* FiberSet.makeRuntimePromise();

  // Lazy: the SDK pulls in FHE WASM.
  const modules = yield* Effect.cached(
    tryZama("load-sdk", async () => {
      const [core, viem, web, chains] = await Promise.all([
        import("@zama-fhe/sdk"),
        import("@zama-fhe/sdk/viem"),
        import("@zama-fhe/sdk/web"),
        import("@zama-fhe/sdk/chains"),
      ]);
      return { chains: chains.chains, core, viem, web } satisfies ZamaModules;
    })
  );

  // Cleartext belongs to one account.
  yield* Stream.concat(
    Stream.succeed((yield* wallet.state).connection.address),
    wallet.states.pipe(Stream.map((state) => state.connection.address))
  ).pipe(
    Stream.map((address) => address?.toLowerCase() ?? null),
    Stream.changes,
    Stream.drop(1),
    Stream.runForEach(() => values.clear),
    Effect.forkScoped
  );

  const sdks = new Map<string, ZamaSDK>();
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      for (const sdk of sdks.values()) sdk.terminate();
    })
  );

  const signPermit = (
    typedData: EIP712TypedData,
    owner: string,
    chainId: number
  ) =>
    Effect.gen(function* () {
      const network = getConfidentialNetwork(chainId);
      if (!network) {
        return yield* new ZamaError({
          cause: `No confidential network for chain ${chainId}`,
          operation: "permit",
        });
      }
      // The SDK builds the domain chainId as a bigint; wallets take a number.
      const {
        domain: { chainId: domainChainId, ...domain },
        ...permit
      } = yield* Schema.decodeUnknownEffect(PermitTypedData)(typedData);
      const contracts = permit.message.contractAddresses;
      const signature = yield* wallet.signPermit({
        expectedOwner: { address: owner, network },
        meta: {
          address: owner,
          chainId,
          contracts: Array.isArray(contracts)
            ? contracts.filter((value) => typeof value === "string")
            : [],
        },
        typedData: {
          ...permit,
          domain: {
            ...domain,
            ...(domainChainId === undefined
              ? {}
              : { chainId: Number(domainChainId) }),
          },
        } satisfies Eip712TypedData,
      });
      return signature as Hex;
    });

  const makeSigner = (
    Base: typeof BaseSigner,
    owner: string,
    chainId: number
  ) =>
    new (class WidgetPermitSigner extends Base {
      signTypedData(typedData: EIP712TypedData) {
        return runPromise(signPermit(typedData, owner, chainId));
      }
      writeContract(): Promise<Hex> {
        return Promise.reject(
          new Error("Zama transactions go through the widget transaction flow")
        );
      }
    })({ address: owner as Address, chainId });

  const getChain = (zama: ZamaModules, chainId: number) =>
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

  // Read-only, so wallet events never fire.
  const widgetRpcProvider = (chainId: number): EIP1193Provider => ({
    on: () => {},
    removeListener: () => {},
    request: wallet.wagmiConfig.getClient({ chainId })
      .request as EIP1193Provider["request"],
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
    chainId: number,
    owner: string
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
        relayers: { [chain.id]: zama.web.web() },
        signer: makeSigner(zama.core.BaseSigner, owner, chainId),
        // The default IndexedDB would keep keys and cleartexts for 30 days.
        storage: zama.core.memoryStorage,
      })
    );
    sdks.set(key, sdk);
    return sdk;
  });

  const getPublicClient = Effect.fn("ZamaService.getPublicClient")(function* (
    chainId: number
  ) {
    return publicClientFor(yield* getChain(yield* modules, chainId));
  });

  const encrypt: ZamaServiceApi["encrypt"] = Effect.fn("ZamaService.encrypt")(
    function* ({ owner, plan }) {
      const sdk = yield* getSdk(plan.chainId, owner);
      const encryptValues = (contract: string, inputs: ReadonlyArray<bigint>) =>
        tryZama("encrypt", () =>
          sdk.encrypt({
            contractAddress: contract as Address,
            userAddress: owner as Address,
            values: inputs.map((value) => ({ type: "euint64", value })),
          })
        );

      const [amount, legs] = yield* Effect.all([
        plan.amount
          ? encryptValues(plan.amount.contract, [plan.amount.value])
          : Effect.succeed(null),
        plan.legs
          ? encryptValues(plan.legs.contract, plan.legs.values)
          : Effect.succeed(null),
      ]);
      const amountHandle = amount?.encryptedValues[0];

      return {
        amount:
          amount && amountHandle
            ? { handle: amountHandle, proof: amount.inputProof }
            : null,
        legs: legs
          ? { handles: legs.encryptedValues, proof: legs.inputProof }
          : null,
      } satisfies ConfidentialEncryption;
    }
  );

  const revealHandles: ZamaServiceApi["revealHandles"] = Effect.fn(
    "ZamaService.revealHandles"
  )(function* ({ chainId, handles, owner }) {
    const sdk = yield* getSdk(chainId, owner);
    const clear = yield* tryZama("decrypt", () =>
      sdk.decryption.decryptValues(
        handles.map((input) => ({
          contractAddress: input.contract as Address,
          encryptedValue: input.handle as Hex,
        }))
      )
    );
    const cleartexts = new Map(
      Object.entries(clear).map(([handle, value]) => [
        handle.toLowerCase(),
        value,
      ])
    );
    yield* values.add(
      handles.flatMap(({ handle }) => {
        const value = cleartexts.get(handle);
        return typeof value === "bigint" ? [[handle, value] as const] : [];
      })
    );
  }, logRevealFailure);

  const revealTokenBalance: ZamaServiceApi["revealTokenBalance"] = Effect.fn(
    "ZamaService.revealTokenBalance"
  )(function* ({ chainId, owner, token }) {
    const address = token.address;
    if (!address) {
      return yield* new ZamaError({
        cause: "Token has no address",
        operation: "decrypt",
      });
    }
    const sdk = yield* getSdk(chainId, owner);
    const balance = yield* tryZama("decrypt", () =>
      sdk.createToken(address as Address).balanceOf(owner as Address)
    );
    yield* values.add([
      [confidentialTokenBalanceKey({ owner, token }), balance],
    ]);
    return balance;
  }, logRevealFailure);

  const wrappedAmount: ZamaServiceApi["wrappedAmount"] = Effect.fn(
    "ZamaService.wrappedAmount"
  )(function* ({ amount, conversion }) {
    const client = yield* getPublicClient(conversion.chainId);
    // `rate()` rebases underlying decimals to the wrapper's.
    const rate = yield* tryZama("read-rate", () =>
      client.readContract({
        abi: wrapperAbi,
        address: conversion.wrapper as Address,
        functionName: "rate",
      })
    );
    return amount / rate;
  });

  // A retry waits on the sent tx instead of signing again.
  const sentTransactions = new Map<string, Hex>();

  const awaitReceipt = Effect.fn("ZamaService.awaitReceipt")(function* (
    client: PublicClient,
    hash: Hex,
    txType: "APPROVAL" | "WRAP",
    txId: string
  ) {
    const receipt = yield* tryZama("wait-receipt", () =>
      client.waitForTransactionReceipt({ hash })
    );
    sentTransactions.delete(txId);
    if (receipt.status !== "success") {
      return yield* new ZamaError({ cause: receipt, operation: txType });
    }
  });

  const sendStep = Effect.fn("ZamaService.sendStep")(function* ({
    actionMeta,
    client,
    data,
    network,
    onBroadcast,
    owner,
    step,
    to,
    txType,
    walletScope,
  }: {
    readonly actionMeta: ClassicActionMeta;
    readonly client: PublicClient;
    readonly data: Hex;
    readonly network: Network;
    readonly onBroadcast: Effect.Effect<void>;
    readonly owner: Address;
    readonly step: string;
    readonly to: Address;
    readonly txType: "APPROVAL" | "WRAP";
    readonly walletScope: WalletScopeOwner;
  }) {
    const txId = `${actionMeta.actionId}-${step}`;
    const pending = sentTransactions.get(txId);
    if (pending) {
      yield* onBroadcast;
      return yield* awaitReceipt(client, pending, txType, txId);
    }
    const [chainId, gas, fees] = yield* tryZama("prepare-transaction", () =>
      Promise.all([
        client.getChainId(),
        client.estimateGas({ account: owner, data, to }),
        client.estimateFeesPerGas(),
      ])
    );
    const tx = JSON.stringify({
      chainId,
      data,
      from: owner,
      gasLimit: numberToHex((gas * 12n) / 10n),
      maxFeePerGas: numberToHex(fees.maxFeePerGas),
      maxPriorityFeePerGas: numberToHex(fees.maxPriorityFeePerGas),
      to,
      type: 2,
    });
    const result = yield* wallet
      .signTransaction({
        expectedOwner: walletScope,
        family: "classic",
        ledgerHwAppId: null,
        network,
        tx,
        txMeta: {
          ...actionMeta,
          annotatedTransaction: null,
          gasEstimate: undefined,
          structuredTransaction: null,
          txId: TransactionId.make(txId),
          txType,
        },
      })
      .pipe(
        Effect.mapError((cause) => new ZamaError({ cause, operation: txType }))
      );
    const hash = result.broadcasted
      ? (result.signedTx as Hex)
      : yield* tryZama("broadcast", () =>
          client.sendRawTransaction({
            serializedTransaction: result.signedTx as Hex,
          })
        );
    sentTransactions.set(txId, hash);
    yield* onBroadcast;
    return yield* awaitReceipt(client, hash, txType, txId);
  });

  const readAllowance = (
    client: PublicClient,
    conversion: ConfidentialConversion,
    owner: Address
  ) =>
    tryZama("read-allowance", () =>
      client.readContract({
        abi: erc20Abi,
        address: conversion.underlying as Address,
        args: [owner, conversion.wrapper as Address],
        functionName: "allowance",
      })
    );

  const conversionSteps: ZamaServiceApi["conversionSteps"] = Effect.fn(
    "ZamaService.conversionSteps"
  )(function* ({ amount, conversion, owner }) {
    const client = yield* getPublicClient(conversion.chainId);
    const allowance = yield* readAllowance(
      client,
      conversion,
      owner as Address
    );
    if (allowance >= amount) return ["wrap"];
    // USDT reverts when changing one non-zero allowance to another.
    return allowance > 0n
      ? ["approve-reset", "approve", "wrap"]
      : ["approve", "wrap"];
  });

  const convertStep: ZamaServiceApi["convertStep"] = Effect.fn(
    "ZamaService.convertStep"
  )(function* ({
    actionMeta,
    amount,
    conversion,
    network,
    onBroadcast,
    owner,
    step,
    walletScope,
  }) {
    const client = yield* getPublicClient(conversion.chainId);
    const account = owner as Address;
    const wrapper = conversion.wrapper as Address;
    return yield* sendStep(
      step === "wrap"
        ? {
            actionMeta,
            client,
            data: encodeFunctionData({
              abi: wrapperAbi,
              args: [account, amount],
              functionName: "wrap",
            }),
            network,
            onBroadcast,
            owner: account,
            step,
            to: wrapper,
            txType: "WRAP",
            walletScope,
          }
        : {
            actionMeta,
            client,
            data: encodeFunctionData({
              abi: erc20Abi,
              args: [wrapper, step === "approve" ? amount : 0n],
              functionName: "approve",
            }),
            network,
            onBroadcast,
            owner: account,
            step,
            to: conversion.underlying as Address,
            txType: "APPROVAL",
            walletScope,
          }
    );
  });

  const publicDecrypt: ZamaServiceApi["publicDecrypt"] = Effect.fn(
    "ZamaService.publicDecrypt"
  )(function* ({ chainId, owner, requestId }) {
    const sdk = yield* getSdk(chainId, owner);
    const decrypted = yield* tryZama("public-decrypt", () =>
      sdk.decryption.decryptPublicValues([requestId as Hex])
    );
    const cleartext = decrypted.clearValues[requestId as Hex];
    if (typeof cleartext !== "bigint") {
      return yield* new ZamaError({
        cause: decrypted,
        operation: "public-decrypt",
      });
    }
    return { cleartext, decryptionProof: decrypted.decryptionProof };
  });

  return {
    conversionSteps,
    publicDecrypt,
    convertStep,
    encrypt,
    revealHandles,
    revealTokenBalance,
    wrappedAmount,
  } satisfies ZamaServiceApi;
});

export class ZamaService extends Context.Service<ZamaService, ZamaServiceApi>()(
  "stakekit/widget/ZamaService"
) {
  static readonly layer = Layer.effect(ZamaService, makeZamaService());
}
