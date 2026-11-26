import { Data, Effect, Array as EArray, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { EarnValidator } from "../../../domain/earn/validator";
import {
  getValidatorPolicyListing,
  rankedEligibleValidators,
} from "../../../domain/earn/yield";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { Network } from "../../../domain/network/network";
import {
  preferredValidatorsResourceAtom,
  type ValidatorsError,
  ValidatorsAtAddressKey,
  ValidatorsKey,
  validatorsAtAddressAtom,
  validatorsPullAtom,
} from "../../../resources/validator-directory/validator-directory";
import { appRuntime } from "../../../runtime/app-runtime";
import { widgetConfigAtom } from "../../../runtime/widget-config";
import {
  type PullPage,
  withPullPageDone,
} from "../../../shared/effect/pagination";

const POLICY_LOOKUP_CONCURRENCY = 5;

export class PolicyValidatorsKey extends Data.Class<{
  readonly network: Network;
  readonly yieldId: YieldId;
}> {}

/** Validators and whether they are every one sought: no lookup failed. */
export type PolicyValidators = {
  readonly complete: boolean;
  readonly validators: ReadonlyArray<EarnValidator>;
};

/**
 * The active validators a network's Validator Policy names, in the policy's
 * order, looked up by address because the directory's pages may not reach
 * them. A failed lookup leaves its validators out and the result incomplete.
 */
export const policyValidatorsAtom = Atom.family((key: PolicyValidatorsKey) =>
  appRuntime
    .atom((context) =>
      Effect.forEach(
        getValidatorPolicyListing({
          network: key.network,
          validatorsConfig: context.get(widgetConfigAtom).validatorsConfig,
        }).named,
        (address) =>
          context
            .result(
              validatorsAtAddressAtom.local(
                new ValidatorsAtAddressKey({
                  address,
                  status: "active",
                  yieldId: key.yieldId,
                })
              )
            )
            .pipe(Effect.orElseSucceed(() => null)),
        { concurrency: POLICY_LOOKUP_CONCURRENCY }
      ).pipe(
        Effect.map((lookups): PolicyValidators => ({
          complete: lookups.every((lookup) => lookup !== null),
          validators: lookups.flatMap((lookup) => lookup ?? []),
        }))
      )
    )
    .pipe(Atom.withLabel("policyValidatorsAtom"))
);

/** Each validator once, where it first appears. */
export const uniqueValidators = (
  validators: ReadonlyArray<EarnValidator>
): Array<EarnValidator> => {
  const seen = new Set<string>();
  return validators.filter((validator) => {
    if (seen.has(validator.key)) return false;
    seen.add(validator.key);
    return true;
  });
};

/**
 * The whole validator list when the Validator Policy bounds it, before
 * eligibility and ranking: the API's Preferred Validators, if the policy keeps
 * them, and the named ones. Null when the directory's pages hold the list.
 * While the policy's lookups refresh, the list is not yet complete.
 */
export const policyBoundValidatorsAtom = Atom.family(
  (key: PolicyValidatorsKey) =>
    Atom.make(
      (
        get
      ): AsyncResult.AsyncResult<PolicyValidators, ValidatorsError> | null => {
        const { fromDirectory } = getValidatorPolicyListing({
          network: key.network,
          validatorsConfig: get(widgetConfigAtom).validatorsConfig,
        });
        if (fromDirectory === "all") return null;

        const named = get(policyValidatorsAtom(key));
        const current = named.pipe(
          AsyncResult.map(({ complete, validators }) => ({
            complete: complete && !named.waiting,
            validators,
          }))
        );
        if (fromDirectory === "none") return current;

        return AsyncResult.all({
          named: current,
          preferred: get(
            preferredValidatorsResourceAtom.foreground(key.yieldId)
          ),
        }).pipe(
          AsyncResult.map(({ named, preferred }) => ({
            complete: named.complete,
            validators: uniqueValidators([...preferred, ...named.validators]),
          }))
        );
      }
    ).pipe(Atom.withLabel("policyBoundValidatorsAtom"))
);

export class YieldValidatorsKey extends Data.Class<{
  readonly network: Network | null;
  readonly search: string | null;
  readonly yieldId: YieldId | null;
}> {}

type YieldValidatorsPull = Atom.PullResult<
  PullPage<EarnValidator>,
  ValidatorsError
>;

const emptyYieldValidatorsPage: PullPage<EarnValidator> = {
  hasNextPage: false,
  items: [],
};
const emptyYieldValidatorsPullAtom = Atom.pull<
  PullPage<EarnValidator>,
  ValidatorsError
>(Stream.succeed(emptyYieldValidatorsPage)).pipe(withPullPageDone);

/**
 * The eligible validators of a yield, page by page, each page in rank order.
 * Without a search, the first page also holds the validators the Validator
 * Policy names, and later pages skip them; when the policy bounds the list,
 * it is that one page.
 */
export const yieldValidatorsPullAtom = Atom.family(
  (key: YieldValidatorsKey): Atom.Writable<YieldValidatorsPull, void> => {
    if (!key.yieldId) return emptyYieldValidatorsPullAtom;

    const { network, search } = key;
    const yieldId = key.yieldId;
    const source = validatorsPullAtom.foreground(
      new ValidatorsKey({ search, status: "active", yieldId })
    );

    return Atom.transform(source, (get): YieldValidatorsPull => {
      const validatorsConfig = get(widgetConfigAtom).validatorsConfig;
      const listed = (validators: ReadonlyArray<EarnValidator>) =>
        network
          ? rankedEligibleValidators({
              network,
              validators,
              validatorsConfig,
              yieldId,
            })
          : [...validators];

      // Search reaches policy validators through the directory's own filters.
      if (!network || search) {
        return get(source).pipe(
          AsyncResult.map(({ done, items }) => ({
            done,
            items: EArray.map(items, (page) => ({
              ...page,
              items: listed(page.items),
            })),
          }))
        );
      }

      const policyKey = new PolicyValidatorsKey({ network, yieldId });
      const bounded = get(policyBoundValidatorsAtom(policyKey));
      if (bounded) {
        return bounded.pipe(
          AsyncResult.map(({ validators }) => ({
            done: true,
            items: EArray.of({
              hasNextPage: false,
              items: listed(validators),
            }),
          }))
        );
      }

      return AsyncResult.all({
        named: get(policyValidatorsAtom(policyKey)),
        pages: get(source),
      }).pipe(
        AsyncResult.map(({ named, pages }) => {
          const namedKeys = new Set(
            named.validators.map((validator) => validator.key)
          );
          return {
            done: pages.done,
            items: EArray.map(pages.items, (page, index) => ({
              ...page,
              items:
                index === 0
                  ? listed(
                      uniqueValidators([...page.items, ...named.validators])
                    )
                  : listed(
                      page.items.filter(
                        (validator) => !namedKeys.has(validator.key)
                      )
                    ),
            })),
          };
        })
      );
    });
  }
);
