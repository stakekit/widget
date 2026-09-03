import {
  Clock,
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Schedule,
  Schema,
} from "effect";
import { getProtocolChainIdentity } from "../../../../domain/wallet/network";
import { config } from "../../../../shared/config/widget-defaults";
import { WalletIntegrationError } from "../../wallet-errors";

const publicNetworkPassphrase =
  getProtocolChainIdentity("stellar").networkPassphrase;
const walletConnectPublicChain = "stellar:pubnet";
const walletConnectSignMethod = "stellar_signXDR";

const AddressResult = Schema.Struct({ address: Schema.String });
const NetworkResult = Schema.Struct({
  network: Schema.String,
  networkPassphrase: Schema.String,
});
const SignedTransactionResult = Schema.Struct({
  signedTxXdr: Schema.String,
  signerAddress: Schema.optionalKey(Schema.String),
});
const WalletConnectSession = Schema.Struct({
  expiry: Schema.Finite,
  namespaces: Schema.Struct({
    stellar: Schema.Struct({
      accounts: Schema.Array(Schema.String),
      methods: Schema.Array(Schema.String),
    }),
  }),
  topic: Schema.String,
});
const WalletConnectSessionCandidates = Schema.Array(Schema.Unknown);

export type StellarWalletId =
  | "albedo"
  | "freighter"
  | "lobstr"
  | "stellar-wallet-connect"
  | "xbull";

export type StellarWalletModule = Readonly<{
  disconnect?: () => Promise<void>;
  getAddress: (params: {
    path?: string;
    skipRequestAccess?: boolean;
  }) => Promise<unknown>;
  getNetwork: () => Promise<unknown>;
  isAvailable: () => Promise<boolean>;
  productIcon: string;
  productId: string;
  productName: string;
  productUrl: string;
  signTransaction: (
    transactionXdr: string,
    options?: Readonly<{
      address?: string;
      networkPassphrase?: string;
      path?: string;
    }>
  ) => Promise<unknown>;
}>;

type WalletConnectModule = StellarWalletModule &
  Readonly<{ getSessions: () => Promise<unknown> }>;

type WalletConnectSessionPaths = {
  value: Array<{ publicKey: string; topic: string }>;
};

export type StellarWalletClient = Readonly<{
  connect: Effect.Effect<Readonly<{ address: string }>, WalletIntegrationError>;
  disconnect: Effect.Effect<void, WalletIntegrationError>;
  iconUrl: string;
  id: StellarWalletId;
  installed: boolean;
  name: string;
  productUrl: string;
  reconnect: (
    address: string
  ) => Effect.Effect<Readonly<{ address: string }>, WalletIntegrationError>;
  signTransaction: (input: {
    readonly address: string;
    readonly networkPassphrase: string;
    readonly transactionXdr: string;
  }) => Effect.Effect<
    Readonly<{ signedTxXdr: string; signerAddress?: string }>,
    WalletIntegrationError
  >;
}>;

const integrationError = (operation: string, cause?: unknown) =>
  new WalletIntegrationError({
    cause,
    message: "Stellar wallet request failed",
    operation,
  });

const callModule = <A, I>(
  operation: string,
  call: () => Promise<I>,
  schema: Schema.Codec<A, I>
) =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => integrationError(operation, cause),
  }).pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError((cause) => integrationError(operation, cause))
      )
    )
  );

const validateMainnet = (module: StellarWalletModule) =>
  callModule(
    "stellar-read-network",
    () => module.getNetwork(),
    NetworkResult
  ).pipe(
    Effect.filterOrFail(
      (network) => network.networkPassphrase === publicNetworkPassphrase,
      () =>
        new WalletIntegrationError({
          message: "Switch the Stellar wallet to Mainnet",
          operation: "stellar-read-network",
        })
    )
  );

const moduleAddress = (
  module: StellarWalletModule,
  params: { readonly skipRequestAccess?: boolean } = {}
) =>
  callModule(
    "stellar-read-address",
    () => module.getAddress(params),
    AddressResult
  ).pipe(
    Effect.filterOrFail(
      ({ address }) => address.length > 0,
      () =>
        new WalletIntegrationError({
          message: "Select an account in the Stellar wallet",
          operation: "stellar-read-address",
        })
    )
  );

const moduleDisconnect = (module: StellarWalletModule) =>
  module.disconnect
    ? Effect.tryPromise({
        try: () => module.disconnect?.() ?? Promise.resolve(),
        catch: (cause) => integrationError("stellar-disconnect", cause),
      })
    : Effect.void;

const moduleAvailability = (module: StellarWalletModule) =>
  callModule(
    "stellar-read-availability",
    () => module.isAvailable(),
    Schema.Boolean
  );

const moduleSignTransaction = (
  module: StellarWalletModule,
  input: {
    readonly address: string;
    readonly networkPassphrase: string;
    readonly transactionXdr: string;
  }
) =>
  callModule(
    "stellar-sign-transaction",
    () =>
      module.signTransaction(input.transactionXdr, {
        address: input.address,
        networkPassphrase: input.networkPassphrase,
      }),
    SignedTransactionResult
  );

export const makeDirectStellarWalletClient = ({
  id,
  installed,
  module,
  validateMainnet: shouldValidateMainnet,
}: {
  readonly id: Exclude<StellarWalletId, "stellar-wallet-connect">;
  readonly installed: boolean;
  readonly module: StellarWalletModule;
  readonly validateMainnet: boolean;
}): StellarWalletClient => {
  const readAddress = (skipRequestAccess: boolean) =>
    moduleAddress(module, { skipRequestAccess }).pipe(
      Effect.tap(() =>
        shouldValidateMainnet ? validateMainnet(module) : Effect.void
      )
    );

  return {
    connect: readAddress(false),
    disconnect: moduleDisconnect(module),
    iconUrl: module.productIcon,
    id,
    installed,
    name: module.productName,
    productUrl: module.productUrl,
    reconnect: () =>
      id === "freighter"
        ? readAddress(true)
        : Effect.fail(
            new WalletIntegrationError({
              message: "Reconnect this Stellar wallet manually",
              operation: "stellar-reconnect",
            })
          ),
    signTransaction: (input) => moduleSignTransaction(module, input),
  };
};

const waitForWalletConnect = (module: WalletConnectModule) =>
  moduleAvailability(module).pipe(
    Effect.filterOrFail(
      (available) => available,
      () => integrationError("stellar-wallet-connect-ready")
    ),
    Effect.retry({
      schedule: Schedule.spaced(Duration.millis(50)),
      times: 100,
    }),
    Effect.asVoid
  );

export const makeWalletConnectStellarWalletClient = ({
  module,
  sessionPaths,
}: {
  readonly module: WalletConnectModule;
  readonly sessionPaths: WalletConnectSessionPaths;
}): StellarWalletClient => {
  const ready = waitForWalletConnect(module);
  return {
    connect: ready.pipe(Effect.andThen(moduleAddress(module))),
    disconnect: moduleDisconnect(module),
    iconUrl: module.productIcon,
    id: "stellar-wallet-connect",
    installed: true,
    name: module.productName,
    productUrl: module.productUrl,
    reconnect: (address) =>
      Effect.gen(function* () {
        yield* ready;
        const now = yield* Clock.currentTimeMillis;
        const candidates = yield* callModule(
          "stellar-wallet-connect-sessions",
          () => module.getSessions(),
          WalletConnectSessionCandidates
        );
        const sessions = candidates.flatMap((candidate) => {
          const decoded =
            Schema.decodeUnknownOption(WalletConnectSession)(candidate);
          return Option.isSome(decoded) ? [decoded.value] : [];
        });
        const account = `${walletConnectPublicChain}:${address}`;
        const session = sessions.find(
          (candidate) =>
            candidate.expiry * 1000 > now &&
            candidate.namespaces.stellar.accounts.includes(account) &&
            candidate.namespaces.stellar.methods.includes(
              walletConnectSignMethod
            )
        );
        if (!session) {
          return yield* new WalletIntegrationError({
            message: "The Stellar WalletConnect session expired",
            operation: "stellar-reconnect",
          });
        }
        sessionPaths.value = [{ publicKey: address, topic: session.topic }];
        return { address };
      }),
    signTransaction: (input) => moduleSignTransaction(module, input),
  };
};

export type StellarWalletsKitPlatformService = Readonly<{
  load: Effect.Effect<
    ReadonlyArray<StellarWalletClient>,
    WalletIntegrationError
  >;
}>;

const initializeKit = Effect.tryPromise({
  try: async () => {
    const [
      { AlbedoModule },
      { FreighterModule },
      { LobstrModule },
      { xBullModule },
      { WalletConnectModule, WalletConnectTargetChain },
      { Networks },
      state,
    ] = await Promise.all([
      import("@creit-tech/stellar-wallets-kit/modules/albedo"),
      import("@creit-tech/stellar-wallets-kit/modules/freighter"),
      import("@creit-tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit-tech/stellar-wallets-kit/modules/xbull"),
      import("@creit-tech/stellar-wallets-kit/modules/wallet-connect"),
      import("@creit-tech/stellar-wallets-kit/types"),
      import("@creit-tech/stellar-wallets-kit/state"),
    ] as const);

    state.selectedNetwork.value = Networks.PUBLIC;
    const directModules = [
      {
        id: "freighter",
        module: new FreighterModule(),
        validateMainnet: true,
      },
      {
        id: "albedo",
        module: new AlbedoModule(),
        validateMainnet: false,
      },
      {
        id: "xbull",
        module: new xBullModule(),
        validateMainnet: false,
      },
      {
        id: "lobstr",
        module: new LobstrModule(),
        validateMainnet: false,
      },
    ] as const;
    const walletConnectModule = new WalletConnectModule({
      allowedChains: [WalletConnectTargetChain.PUBLIC],
      metadata: {
        description: `${config.appName} wallet connection`,
        icons: [config.appIcon],
        name: config.appName,
        url: config.appUrl,
      },
      projectId: config.walletConnectV2.projectId,
    });

    return {
      directModules,
      sessionPaths: state.wcSessionPaths,
      walletConnectModule,
    };
  },
  catch: (cause) =>
    new WalletIntegrationError({
      cause,
      message: "Could not load Stellar Wallets Kit",
      operation: "stellar-wallets-kit-load",
    }),
});

const load = Effect.gen(function* () {
  const { directModules, sessionPaths, walletConnectModule } =
    yield* initializeKit;
  const installed = yield* Effect.all(
    directModules.map(({ module }) =>
      moduleAvailability(module).pipe(Effect.orElseSucceed(() => false))
    ),
    { concurrency: "unbounded" }
  );

  return [
    ...directModules.map(({ id, module, validateMainnet }, index) =>
      makeDirectStellarWalletClient({
        id,
        installed: installed[index] ?? false,
        module,
        validateMainnet,
      })
    ),
    makeWalletConnectStellarWalletClient({
      module: walletConnectModule,
      sessionPaths,
    }),
  ];
});

export class StellarWalletsKitPlatform extends Context.Service<
  StellarWalletsKitPlatform,
  StellarWalletsKitPlatformService
>()("stakekit/widget/wallet/platform/StellarWalletsKitPlatform") {
  static readonly layer = Layer.succeed(
    StellarWalletsKitPlatform,
    StellarWalletsKitPlatform.of({ load })
  );
}
