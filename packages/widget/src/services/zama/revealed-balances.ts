import {
  Context,
  Effect,
  HashMap,
  Layer,
  PubSub,
  type Stream,
  SubscriptionRef,
} from "effect";
import type {
  ConfidentialTokenBalanceKey,
  RevealedBalances as Values,
} from "../../domain/earn/confidential";
import type { ConfidentialHandle } from "../../domain/earn/models";
import type { WalletScopeOwner } from "../../domain/wallet/wallet-scope";

type RevealedBalancesApi = Readonly<{
  readonly addHandles: (
    entries: ReadonlyArray<readonly [ConfidentialHandle, bigint]>
  ) => Effect.Effect<void>;
  readonly addTokenBalance: (
    key: ConfidentialTokenBalanceKey,
    balance: bigint
  ) => Effect.Effect<void>;
  readonly changes: Stream.Stream<Values>;
  readonly clear: Effect.Effect<void>;
  readonly current: Effect.Effect<Values>;
  readonly forgetHandles: Effect.Effect<void>;
  readonly forgetTokenBalance: (
    key: ConfidentialTokenBalanceKey
  ) => Effect.Effect<void>;
  readonly forgetTokenBalancesOf: (
    owner: WalletScopeOwner
  ) => Effect.Effect<void>;
}>;

const empty: Values = { handles: new Map(), tokenBalances: HashMap.empty() };

/** Revealed Zama cleartexts; in memory only. */
export class RevealedBalances extends Context.Service<
  RevealedBalances,
  RevealedBalancesApi
>()("stakekit/widget/RevealedBalances") {
  static readonly layer = Layer.effect(
    RevealedBalances,
    Effect.gen(function* () {
      const ref = yield* SubscriptionRef.make(empty);
      yield* Effect.addFinalizer(() => PubSub.shutdown(ref.pubsub));
      const updateTokenBalances = (
        f: (balances: Values["tokenBalances"]) => Values["tokenBalances"]
      ) =>
        SubscriptionRef.update(ref, (current) => ({
          ...current,
          tokenBalances: f(current.tokenBalances),
        }));

      return {
        addHandles: (entries) =>
          SubscriptionRef.update(ref, (current) => ({
            ...current,
            handles: new Map([...current.handles, ...entries]),
          })),
        addTokenBalance: (key, balance) =>
          updateTokenBalances(HashMap.set(key, balance)),
        changes: SubscriptionRef.changes(ref),
        clear: SubscriptionRef.set(ref, empty),
        current: SubscriptionRef.get(ref),
        forgetHandles: SubscriptionRef.update(ref, (current) => ({
          ...current,
          handles: new Map(),
        })),
        forgetTokenBalance: (key) => updateTokenBalances(HashMap.remove(key)),
        forgetTokenBalancesOf: (owner) =>
          updateTokenBalances(
            HashMap.filter((_, key) => !key.isOwnedBy(owner))
          ),
      } satisfies RevealedBalancesApi;
    })
  );
}
