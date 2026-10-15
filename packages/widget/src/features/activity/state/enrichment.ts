import { Data, Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { YieldAction } from "../../../domain/action/models";
import { getActionValidatorAddresses } from "../../../domain/action/rules";
import type { Integration } from "../../../domain/borrow/catalog/integration";
import type { Market } from "../../../domain/borrow/catalog/market";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { ActivityHistoryEntry } from "../../../resources/activity-history/index";
import { borrowIntegrationsResourceAtom } from "../../../resources/borrow-integrations/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../../../resources/borrow-markets/index";
import {
  ValidatorByAddressKey,
  validatorByAddressAtom,
} from "../../../resources/validator-directory/index";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/index";
import {
  type ActivityEnrichmentFacts,
  validatorFactKey,
} from "../model/activity-enrichment";

const ACTIVITY_ENRICHMENT_CONCURRENCY = 5;

/** The yield, validator, market, and integration facts a set of Activity rows needs. */
export class ActivityEnrichmentKey extends Data.Class<{
  readonly borrowNetworks: ReadonlyArray<BorrowNetwork>;
  readonly validatorKeys: ReadonlyArray<ValidatorByAddressKey>;
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(entries: ReadonlyArray<ActivityHistoryEntry>) {
    const validatorKeys = new Map<string, ValidatorByAddressKey>();
    const yieldActions: Array<YieldAction> = [];
    const borrowNetworks = new Set<BorrowNetwork>();

    for (const entry of entries) {
      if (entry._tag === "borrow") {
        borrowNetworks.add(entry.network);
        continue;
      }

      const action = entry.action;
      yieldActions.push(action);
      for (const address of getActionValidatorAddresses(action) ?? []) {
        const key = new ValidatorByAddressKey({
          address,
          yieldId: action.yieldId,
        });
        validatorKeys.set(validatorFactKey(key), key);
      }
    }

    super({
      borrowNetworks: [...borrowNetworks].sort(),
      validatorKeys: [...validatorKeys.values()].sort((first, second) =>
        validatorFactKey(first).localeCompare(validatorFactKey(second))
      ),
      yieldIds: [
        ...new Set(yieldActions.map((action) => action.yieldId)),
      ].sort(),
    });
  }
}

type ActivityEnrichmentFact =
  | {
      readonly _tag: "borrowIntegrations";
      readonly value: ReadonlyArray<Integration>;
    }
  | {
      readonly _tag: "borrowMarkets";
      readonly value: ReadonlyArray<Market>;
    }
  | {
      readonly _tag: "validator";
      readonly key: ValidatorByAddressKey;
      readonly value: EarnValidator | null;
    }
  | {
      readonly _tag: "yield";
      readonly value: EarnYieldWithProvider | null;
      readonly yieldId: YieldId;
    };

type ActivityEnrichmentRequest =
  | { readonly _tag: "borrowIntegrations" }
  | { readonly _tag: "borrowMarkets"; readonly network: BorrowNetwork }
  | { readonly _tag: "validator"; readonly validatorKey: ValidatorByAddressKey }
  | { readonly _tag: "yield"; readonly yieldId: YieldId };

type ResourceRead = <A, E>(
  resource: Atom.Atom<AsyncResult.AsyncResult<A, E>>
) => Effect.Effect<A, E>;

/**
 * Enrichment facts are optional: a typed resource failure leaves its fact
 * absent, while defects and interruptions fail the enrichment. `read` decides
 * whether the caller tracks the Resources (`context.result`) or takes them
 * once (`context.resultOnce`).
 */
export const loadActivityEnrichmentFacts = (
  key: ActivityEnrichmentKey,
  read: ResourceRead
): Effect.Effect<ActivityEnrichmentFacts> => {
  const requests: Array<ActivityEnrichmentRequest> = [
    ...key.yieldIds.map((yieldId) => ({
      _tag: "yield" as const,
      yieldId,
    })),
    ...key.validatorKeys.map((validatorKey) => ({
      _tag: "validator" as const,
      validatorKey,
    })),
    ...key.borrowNetworks.map((network) => ({
      _tag: "borrowMarkets" as const,
      network,
    })),
    // Every Borrow row names a network, so networks imply Borrow rows.
    ...(key.borrowNetworks.length > 0
      ? [{ _tag: "borrowIntegrations" as const }]
      : []),
  ];
  const loadFact = (
    request: ActivityEnrichmentRequest
  ): Effect.Effect<ActivityEnrichmentFact> => {
    switch (request._tag) {
      case "yield":
        return read(
          enrichedYieldOpportunityResourceAtom.local(request.yieldId)
        ).pipe(
          Effect.orElseSucceed(() => null),
          Effect.map((value) => ({
            _tag: "yield" as const,
            value,
            yieldId: request.yieldId,
          }))
        );
      case "validator":
        return read(validatorByAddressAtom.local(request.validatorKey)).pipe(
          Effect.orElseSucceed(() => null),
          Effect.map((value) => ({
            _tag: "validator" as const,
            key: request.validatorKey,
            value,
          }))
        );
      case "borrowMarkets":
        return read(
          borrowMarketsResourceAtom.local(
            new BorrowMarketsKey({
              network: request.network,
              scope: "all",
            })
          )
        ).pipe(
          Effect.orElseSucceed((): ReadonlyArray<Market> => []),
          Effect.map((value) => ({
            _tag: "borrowMarkets" as const,
            value,
          }))
        );
      case "borrowIntegrations":
        return read(borrowIntegrationsResourceAtom.local).pipe(
          Effect.orElseSucceed((): ReadonlyArray<Integration> => []),
          Effect.map((value) => ({
            _tag: "borrowIntegrations" as const,
            value,
          }))
        );
    }
  };

  return Effect.forEach(requests, loadFact, {
    concurrency: ACTIVITY_ENRICHMENT_CONCURRENCY,
  }).pipe(
    Effect.map((facts): ActivityEnrichmentFacts => {
      const borrowIntegrationsById = new Map<string, Integration>();
      const borrowMarketsById = new Map<string, Market>();
      const validatorsByKey = new Map<string, EarnValidator>();
      const yieldsById = new Map<YieldId, EarnYieldWithProvider | null>();

      for (const fact of facts) {
        switch (fact._tag) {
          case "yield":
            yieldsById.set(fact.yieldId, fact.value);
            break;
          case "borrowMarkets":
            for (const market of fact.value) {
              borrowMarketsById.set(market.id, market);
            }
            break;
          case "borrowIntegrations":
            for (const integration of fact.value) {
              borrowIntegrationsById.set(integration.id, integration);
            }
            break;
          case "validator":
            if (fact.value) {
              validatorsByKey.set(validatorFactKey(fact.key), fact.value);
            }
            break;
        }
      }

      return {
        borrowIntegrationsById,
        borrowMarketsById,
        validatorsByKey,
        yieldsById,
      };
    })
  );
};

/**
 * One-shot facts for a loaded feed page: a later Resource change does not
 * re-enrich rows already on screen.
 */
export const activityEnrichmentFactsAtom = Atom.family(
  (key: ActivityEnrichmentKey) =>
    appRuntime
      .atom((context) =>
        loadActivityEnrichmentFacts(key, (resource) =>
          context.resultOnce(resource)
        )
      )
      .pipe(Atom.withLabel("activityEnrichmentFactsAtom"))
);
