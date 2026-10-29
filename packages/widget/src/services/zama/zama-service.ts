import type { BaseSigner, EIP712TypedData, ZamaSDK } from "@zama-fhe/sdk";
import type { FheChain } from "@zama-fhe/sdk/chains";
import {
  Context,
  Data,
  Effect,
  FiberSet,
  Layer,
  Option,
  Schema,
  Stream,
} from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import {
  type Address,
  createPublicClient,
  custom,
  type EIP1193Provider,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  http,
  isAddress,
  isHex,
  type PublicClient,
  parseAbi,
  parseEventLogs,
} from "viem";
import {
  type DirectTransaction,
  DirectTransactionId,
  makeErc20Approval,
} from "../../domain/action/direct-transaction";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../domain/action/models";
import {
  type ConfidentialChainId,
  type ConfidentialConversion,
  type ConfidentialEncryption,
  type ConfidentialEncryptionPlan,
  ConfidentialTokenBalanceKey,
  getConfidentialNetwork,
  planConfidentialEncryption,
  toConfidentialArguments,
} from "../../domain/earn/confidential";
import {
  ConfidentialHandle,
  type EarnYieldWithProvider,
} from "../../domain/earn/models";
import type {
  ContractAddress,
  TransactionHash,
  WalletAddress,
} from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type { Token } from "../../domain/token/token";
import { WidgetConfigService } from "../config/widget-config";
import { WidgetDomainEvents } from "../events/widget-domain-events";
import type { Eip712TypedData } from "../wallet/wallet-commands";
import { WalletService } from "../wallet/wallet-service";
import type { EncryptWorkerSource } from "./encrypt-worker";
import { RevealedBalances } from "./revealed-balances";

class ZamaError extends Data.TaggedError("ZamaError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

// viem takes 0x addresses; an EVM wallet's and contract's addresses are in them.
const toEvmAddress = (
  address: string,
  operation: string
): Effect.Effect<Address, ZamaError> =>
  isAddress(address, { strict: false })
    ? Effect.succeed(address)
    : Effect.fail(
        new ZamaError({ cause: `Not an EVM address: ${address}`, operation })
      );

// The SDK returns hex handles; the domain keeps them branded.
const EncryptedHandles = Schema.Struct({
  amount: Schema.NullOr(ConfidentialHandle),
  legs: Schema.NullOr(Schema.Array(ConfidentialHandle)),
});

/**
 * How a confidential vault's action command gets its hidden amount: the
 * amount encrypted for the signing wallet, or a withdrawal decrypted publicly.
 */
export type ConfidentialPreparation =
  | ConfidentialEncryptPreparation
  | ConfidentialDecryptPreparation;

type ConfidentialEncryptPreparation = Readonly<{
  readonly _tag: "Encrypt";
  readonly amount: bigint;
  readonly assetAddress: string | null;
  /** The hidden balance `amount` must not exceed, if it is not wrapped first. */
  readonly balance: Readonly<{
    readonly chainId: ConfidentialChainId;
    readonly token: Token;
  }> | null;
  readonly command: ActionCommand;
  readonly conversion: ConfidentialConversion | null;
  readonly instant: boolean;
  readonly intent: "enter" | "exit";
  /** A deposit whose balance the wallet could never reveal to withdraw. */
  readonly requiresPermitSigner: boolean;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type ConfidentialDecryptPreparation = Readonly<{
  readonly _tag: "Decrypt";
  readonly chainId: ConfidentialChainId;
  readonly command: ManageActionCommand;
  readonly handle: ConfidentialHandle;
}>;

export class ConfidentialPreparationError extends Data.TaggedError(
  "ConfidentialPreparationError"
)<{
  readonly cause: unknown;
  readonly message: string;
  /** False when the request itself cannot be prepared, so retrying cannot help. */
  readonly retryable: boolean;
}> {}

const wrapperAbi = parseAbi([
  "function wrap(address to, uint256 amount) returns (bytes32)",
  "function rate() view returns (uint256)",
  "function isOperator(address holder, address spender) view returns (bool)",
  "event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)",
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
  readonly encryptWorker: EncryptWorkerSource;
  readonly viem: typeof import("@zama-fhe/sdk/viem");
  readonly web: typeof import("@zama-fhe/sdk/web");
}>;

type HandleInput = Readonly<{
  readonly contract: string;
  readonly handle: ConfidentialHandle;
}>;

type ZamaServiceApi = Readonly<{
  /**
   * The approve and wrap that turn `amount` of the underlying token into its
   * confidential wrapper, by the owner's current allowance.
   */
  readonly planConversion: (input: {
    readonly amount: bigint;
    readonly conversion: ConfidentialConversion;
    readonly network: Network;
    readonly owner: WalletAddress;
  }) => Effect.Effect<ReadonlyArray<DirectTransaction>>;
  /**
   * How many of `tokens` the owner has not yet made `operator` an operator
   * on; a grant whose status cannot be read counts as missing.
   */
  readonly countMissingOperatorGrants: (input: {
    readonly chainId: ConfidentialChainId;
    readonly operator: ContractAddress;
    readonly owner: WalletAddress;
    readonly tokens: ReadonlyArray<ContractAddress>;
  }) => Effect.Effect<number>;
  /** A deposit's or exit's command with its amount encrypted instead. */
  readonly encryptCommand: (
    preparation: ConfidentialEncryptPreparation
  ) => Effect.Effect<ActionCommand, ConfidentialPreparationError>;
  /** An unwrap withdrawal's command with its publicly decrypted amount. */
  readonly decryptCommand: (
    preparation: ConfidentialDecryptPreparation
  ) => Effect.Effect<ManageActionCommand, ConfidentialPreparationError>;
  /**
   * The unwrap request an instant exit's mined transaction opened for the
   * owner: the handle its WITHDRAW publicly decrypts.
   */
  readonly readUnwrapRequest: (input: {
    readonly chainId: ConfidentialChainId;
    readonly hash: TransactionHash;
    readonly owner: WalletAddress;
  }) => Effect.Effect<ConfidentialHandle, ConfidentialPreparationError>;
  readonly revealHandles: (input: {
    readonly chainId: ConfidentialChainId;
    readonly handles: ReadonlyArray<HandleInput>;
    readonly owner: WalletAddress;
  }) => Effect.Effect<void, ZamaError>;
  readonly revealTokenBalance: (input: {
    readonly chainId: ConfidentialChainId;
    readonly owner: WalletAddress;
    readonly token: Token;
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
  const values = yield* RevealedBalances;
  const events = yield* WidgetDomainEvents;
  const runPromise = yield* FiberSet.makeRuntimePromise();
  const httpClient = yield* HttpClient.HttpClient;

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
        tryZama("load-sdk", () => import("./encrypt-worker")).pipe(
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

  // A revealed balance is stale once a Yield workflow moved funds.
  yield* events.events.pipe(
    Stream.runForEach((event) =>
      (event._tag === "TransactionWorkflowResourcesChanged" ||
        event._tag === "TransactionWorkflowEnded") &&
      event.workflowKind === "Yield"
        ? values.forgetTokenBalancesOf(event.owner)
        : Effect.void
    ),
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
    owner: WalletAddress,
    chainId: ConfidentialChainId
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
      // viem's signer seam takes hex; an EVM wallet signs in hex.
      if (!isHex(signature)) {
        return yield* new ZamaError({
          cause: "The wallet returned a non-hex permit signature",
          operation: "permit",
        });
      }
      return signature;
    });

  const makeSigner = (
    Base: typeof BaseSigner,
    owner: WalletAddress,
    address: Address,
    chainId: ConfidentialChainId
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
    })({ address, chainId });

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

  const getPublicClient = Effect.fn("ZamaService.getPublicClient")(function* (
    chainId: ConfidentialChainId
  ) {
    return publicClientFor(yield* getChain(yield* modules, chainId));
  });

  const encrypt = Effect.fn("ZamaService.encrypt")(function* ({
    owner,
    plan,
  }: {
    readonly owner: WalletAddress;
    readonly plan: ConfidentialEncryptionPlan;
  }): Effect.fn.Return<ConfidentialEncryption, ZamaError> {
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
      Effect.mapError((cause) => new ZamaError({ cause, operation: "encrypt" }))
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
  });

  const revealHandles: ZamaServiceApi["revealHandles"] = Effect.fn(
    "ZamaService.revealHandles"
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
    yield* values.addHandles(
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
    const tokenAddress = yield* toEvmAddress(address, "decrypt");
    const ownerAddress = yield* toEvmAddress(owner, "decrypt");
    const balance = yield* tryZama("decrypt", () =>
      sdk.createToken(tokenAddress).balanceOf(ownerAddress)
    );
    yield* values.addTokenBalance(
      new ConfidentialTokenBalanceKey({ owner, token }),
      balance
    );
    return balance;
  }, logRevealFailure);

  const wrappedAmount = Effect.fn("ZamaService.wrappedAmount")(function* ({
    amount,
    conversion,
  }: {
    readonly amount: bigint;
    readonly conversion: ConfidentialConversion;
  }) {
    const client = yield* getPublicClient(conversion.chainId);
    const address = yield* toEvmAddress(conversion.wrapper, "read-rate");
    // `rate()` rebases underlying decimals to the wrapper's.
    const rate = yield* tryZama("read-rate", () =>
      client.readContract({
        abi: wrapperAbi,
        address,
        functionName: "rate",
      })
    );
    return amount / rate;
  });

  const planConversion: ZamaServiceApi["planConversion"] = Effect.fn(
    "ZamaService.planConversion"
  )(function* ({ amount, conversion, network, owner }) {
    // A conversion runs on an EVM chain, so its addresses are hex.
    const allowance = yield* Effect.all({
      owner: toEvmAddress(owner, "plan-conversion"),
      spender: toEvmAddress(conversion.wrapper, "plan-conversion"),
      token: toEvmAddress(conversion.underlying, "plan-conversion"),
    }).pipe(Effect.orDie);
    const approve = (type: "APPROVAL" | "RESET_APPROVAL") =>
      makeErc20Approval({
        amount,
        chainId: conversion.chainId,
        id: DirectTransactionId.make("conversion-approval"),
        network,
        type,
        ...allowance,
      });
    const wrap: DirectTransaction = {
      approval: null,
      chainId: conversion.chainId,
      data: encodeFunctionData({
        abi: wrapperAbi,
        args: [allowance.owner, amount],
        functionName: "wrap",
      }),
      id: DirectTransactionId.make("conversion-wrap"),
      network,
      to: allowance.spender,
      type: "WRAP",
    };
    const current = yield* getPublicClient(conversion.chainId).pipe(
      Effect.flatMap((client) =>
        tryZama("read-allowance", () =>
          client.readContract({
            abi: erc20Abi,
            address: allowance.token,
            args: [allowance.owner, allowance.spender],
            functionName: "allowance",
          })
        )
      ),
      Effect.option
    );

    if (Option.isSome(current) && current.value >= amount) return [wrap];
    if (Option.isSome(current) && current.value === 0n) {
      return [approve("APPROVAL"), wrap];
    }
    // USDT reverts when changing one non-zero allowance to another, and an
    // unknown allowance may be one: reset it first. Each approval reads the
    // allowance again before signing.
    return [approve("RESET_APPROVAL"), approve("APPROVAL"), wrap];
  });

  const countMissingOperatorGrants: ZamaServiceApi["countMissingOperatorGrants"] =
    Effect.fn("ZamaService.countMissingOperatorGrants")(function* ({
      chainId,
      operator,
      owner,
      tokens,
    }) {
      const client = yield* getPublicClient(chainId).pipe(Effect.option);
      if (Option.isNone(client)) return tokens.length;
      const granted = yield* Effect.forEach(
        tokens,
        (token) =>
          Effect.all([
            toEvmAddress(token, "read-operator"),
            toEvmAddress(owner, "read-operator"),
            toEvmAddress(operator, "read-operator"),
          ]).pipe(
            Effect.flatMap(([address, holder, spender]) =>
              tryZama("read-operator", () =>
                client.value.readContract({
                  abi: wrapperAbi,
                  address,
                  args: [holder, spender],
                  functionName: "isOperator",
                })
              )
            ),
            Effect.orElseSucceed(() => false)
          ),
        { concurrency: "unbounded" }
      );
      return granted.filter((isGranted) => !isGranted).length;
    });

  const publicDecrypt = Effect.fn("ZamaService.publicDecrypt")(function* ({
    chainId,
    owner,
    requestId,
  }: {
    readonly chainId: ConfidentialChainId;
    readonly owner: WalletAddress;
    readonly requestId: ConfidentialHandle;
  }) {
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

  const retryableFailure = (error: ZamaError) =>
    new ConfidentialPreparationError({
      cause: error,
      message: `Zama ${error.operation} failed.`,
      retryable: true,
    });
  const unpreparable = (message: string, cause: unknown = null) =>
    new ConfidentialPreparationError({ cause, message, retryable: false });

  const encryptCommand: ZamaServiceApi["encryptCommand"] = Effect.fn(
    "ZamaService.encryptCommand"
  )(function* (preparation) {
    const { amount, command } = preparation;
    const owner = command.address;
    if (preparation.requiresPermitSigner) {
      const canSignPermit = yield* wallet.canSignPermit.pipe(
        Effect.mapError(
          (cause) =>
            new ConfidentialPreparationError({
              cause,
              message: "Wallet state is unavailable.",
              retryable: true,
            })
        )
      );
      if (!canSignPermit) {
        return yield* unpreparable(
          "This wallet cannot reveal confidential balances."
        );
      }
    }
    if (preparation.balance) {
      const balance = yield* revealTokenBalance({
        chainId: preparation.balance.chainId,
        owner,
        token: preparation.balance.token,
      }).pipe(Effect.mapError(retryableFailure));
      if (balance < amount) {
        return yield* unpreparable("Amount exceeds the confidential balance.", {
          amount,
          balance,
        });
      }
    }
    const value = preparation.conversion
      ? yield* wrappedAmount({
          amount,
          conversion: preparation.conversion,
        }).pipe(Effect.mapError(retryableFailure))
      : amount;
    const plan = planConfidentialEncryption({
      instant: preparation.instant,
      intent: preparation.intent,
      value,
      yieldDto: preparation.yieldDto,
    });
    if (!plan) return command;
    const encryption = yield* encrypt({ owner, plan }).pipe(
      Effect.mapError(retryableFailure)
    );
    return {
      ...command,
      arguments: toConfidentialArguments(
        command.arguments ?? {},
        encryption,
        preparation.assetAddress
      ),
    };
  });

  const decryptCommand: ZamaServiceApi["decryptCommand"] = ({
    chainId,
    command,
    handle,
  }) =>
    publicDecrypt({ chainId, owner: command.address, requestId: handle }).pipe(
      Effect.map(({ cleartext, decryptionProof }) => ({
        ...command,
        arguments: {
          ...command.arguments,
          decryptedAmount: cleartext.toString(),
          decryptionProof,
        },
      })),
      Effect.mapError(retryableFailure)
    );

  const readUnwrapRequest: ZamaServiceApi["readUnwrapRequest"] = Effect.fn(
    "ZamaService.readUnwrapRequest"
  )(function* ({ chainId, hash, owner }) {
    // viem takes hex, and an EVM transaction's hash is in it.
    if (!isHex(hash)) {
      return yield* unpreparable(
        "The unwrap transaction hash is not hex.",
        hash
      );
    }
    const client = yield* getPublicClient(chainId).pipe(
      Effect.mapError(retryableFailure)
    );
    const receipt = yield* tryZama("read-unwrap-receipt", () =>
      client.getTransactionReceipt({ hash })
    ).pipe(Effect.mapError(retryableFailure));
    const receiver = yield* toEvmAddress(owner, "read-unwrap-receipt").pipe(
      Effect.mapError((error) =>
        unpreparable("The unwrap owner is not an EVM address.", error)
      )
    );
    const [requested] = parseEventLogs({
      abi: wrapperAbi,
      args: { receiver },
      eventName: "UnwrapRequested",
      logs: receipt.logs,
    });
    const requestId = requested
      ? Schema.decodeOption(ConfidentialHandle)(requested.args.unwrapRequestId)
      : Option.none();
    return Option.isSome(requestId)
      ? requestId.value
      : yield* unpreparable("The transaction requested no unwrap.", receipt);
  });

  return {
    countMissingOperatorGrants,
    decryptCommand,
    encryptCommand,
    planConversion,
    readUnwrapRequest,
    revealHandles,
    revealTokenBalance,
  } satisfies ZamaServiceApi;
});

export class ZamaService extends Context.Service<ZamaService, ZamaServiceApi>()(
  "stakekit/widget/ZamaService"
) {
  static readonly layer = Layer.effect(ZamaService, makeZamaService()).pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
