import { Context, Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import type { DirectTransaction } from "../../domain/action/direct-transaction";
import type {
  ConfidentialChainId,
  ConfidentialConversion,
} from "../../domain/earn/confidential";
import { ConfidentialTokenBalanceKey } from "../../domain/earn/confidential-balance";
import type {
  ContractAddress,
  WalletAddress,
} from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type { Token } from "../../domain/token/token";
import { WidgetDomainEvents } from "../events/widget-domain-events";
import { WalletService } from "../wallet/wallet-service";
import type { ConfidentialPreparationApi } from "./confidential-preparation";
import { makeConfidentialPreparation } from "./internal/action-preparation";
import {
  countMissingOperatorGrants,
  planConversion,
} from "./internal/confidential-contracts";
import { type HandleInput, makeZamaSdk } from "./internal/sdk";
import type { ZamaError } from "./internal/zama-error";
import { RevealedBalances } from "./revealed-balances";

type ZamaServiceApi = ConfidentialPreparationApi &
  Readonly<{
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

const makeZamaService = Effect.fn("makeZamaService")(function* () {
  const wallet = yield* WalletService;
  const values = yield* RevealedBalances;
  const events = yield* WidgetDomainEvents;

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

  const sdk = yield* makeZamaSdk;

  const revealHandles: ZamaServiceApi["revealHandles"] = Effect.fn(
    "ZamaService.revealHandles"
  )(function* (input) {
    yield* values.addHandles(yield* sdk.decryptHandles(input));
  }, logRevealFailure);

  const revealTokenBalance: ZamaServiceApi["revealTokenBalance"] = Effect.fn(
    "ZamaService.revealTokenBalance"
  )(function* (input) {
    const balance = yield* sdk.decryptTokenBalance(input);
    yield* values.addTokenBalance(
      new ConfidentialTokenBalanceKey({
        owner: input.owner,
        token: input.token,
      }),
      balance
    );
    return balance;
  }, logRevealFailure);

  const preparation = yield* makeConfidentialPreparation({
    revealTokenBalance,
    sdk,
  });

  return {
    ...preparation,
    countMissingOperatorGrants: (input) =>
      countMissingOperatorGrants(sdk, input),
    planConversion: (input) => planConversion(sdk, input),
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
