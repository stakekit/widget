import { Data, Duration, Effect, Option, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";

import {
  type EarnValidator,
  validatorAddressIdentities,
  validatorAddressIdentity,
} from "../../domain/earn/validator";
import type {
  ValidatorAddress,
  YieldId,
} from "../../domain/identity/identifiers";
import { appRuntime } from "../../runtime/app-runtime";
import {
  type ApiRequestError,
  type ResponseDecodeError,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  getNextPageOffset,
  loadAllPages,
  withPullPageDone,
} from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const CONCURRENCY = 5;

export class ValidatorsKey extends Data.TaggedClass("ValidatorsKey")<{
  readonly preferred: boolean | null;
  readonly search: string | null;
  readonly status: "active" | null;
  readonly yieldId: YieldId;
}> {
  constructor(input: {
    readonly preferred?: boolean | null;
    readonly search?: string | null;
    readonly status?: "active" | null;
    readonly yieldId: YieldId;
  }) {
    super({
      preferred: input.preferred ?? null,
      search: input.search?.trim() || null,
      status: input.status ?? null,
      yieldId: input.yieldId,
    });
  }
}

export class ValidatorsError extends Data.TaggedError("ValidatorsError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

type ValidatorPage = {
  readonly items: ReadonlyArray<EarnValidator>;
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
};

type ValidatorCursor = {
  list: number | null;
  name: number | null;
  address: number | null;
};

type ValidatorPaginationState = {
  readonly cursor: ValidatorCursor;
  readonly seen: Set<string>;
};

type ValidatorBranch = keyof ValidatorCursor;

const validatorPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(2),
});

const toRequest = ({
  branch,
  key,
  offset,
}: {
  readonly branch: ValidatorBranch;
  readonly key: ValidatorsKey;
  readonly offset: number;
}): ValidatorDirectoryRequest => ({
  limit: API_MAX_PAGE_SIZE,
  offset,
  yieldId: key.yieldId,
  ...(branch === "address" && key.search ? { address: key.search } : {}),
  ...(branch === "name" && key.search ? { name: key.search } : {}),
  ...(key.preferred === null ? {} : { preferred: key.preferred }),
  ...(key.status ? { status: key.status } : {}),
});

const validatorBranches = [
  "list",
  "name",
  "address",
] as const satisfies ReadonlyArray<ValidatorBranch>;

const validatorsCanonicalPullAtom = Atom.family((key: ValidatorsKey) =>
  appRuntime
    .pull(() => {
      const initialCursor: ValidatorCursor = key.search
        ? { list: null, name: 0, address: 0 }
        : { list: 0, name: null, address: null };

      return Stream.paginate(
        {
          cursor: initialCursor,
          seen: new Set<string>(),
        } satisfies ValidatorPaginationState,
        (state) =>
          Effect.gen(function* () {
            const activeBranches = validatorBranches.flatMap(
              (branch): Array<readonly [ValidatorBranch, number]> => {
                const offset = state.cursor[branch];
                return offset === null ? [] : [[branch, offset]];
              }
            );
            const pages = yield* Effect.forEach(
              activeBranches,
              ([branch, offset]) =>
                YieldResourceSource.use((source) =>
                  source
                    .listValidators(toRequest({ branch, key, offset }))
                    .pipe(
                      Effect.map((page): [ValidatorBranch, ValidatorPage] => [
                        branch,
                        { ...page, items: page.items ?? [] },
                      ])
                    )
                ),
              { concurrency: 2 }
            );
            const nextCursor: ValidatorCursor = { ...state.cursor };

            for (const [branch, page] of pages) {
              nextCursor[branch] = Option.getOrNull(getNextPageOffset(page));
            }

            const nextSeen = new Set(state.seen);
            const validators = pages
              .flatMap(([, page]) => page.items)
              .filter((validator) => {
                if (nextSeen.has(validator.key)) return false;
                nextSeen.add(validator.key);
                return true;
              });
            const hasNextPage = Object.values(nextCursor).some(
              (offset) => offset !== null
            );

            return [
              [{ hasNextPage, items: validators }],
              hasNextPage
                ? Option.some({ cursor: nextCursor, seen: nextSeen })
                : Option.none<ValidatorPaginationState>(),
            ] as const;
          })
      ).pipe(Stream.mapError((cause) => new ValidatorsError({ cause })));
    })
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
      withPullPageDone,
      validatorPolicy,
      Atom.withLabel("validatorsPullAtom")
    )
);

export const validatorsPullAtom = makePresentableResourceFamily(
  validatorsCanonicalPullAtom
);

const preferredValidatorsCanonicalAtom = Atom.family((yieldId: YieldId) =>
  appRuntime
    .atom(() =>
      YieldResourceSource.use((source) =>
        loadAllPages({
          concurrency: CONCURRENCY,
          fetchPage: (offset) =>
            source.listValidators({
              limit: API_MAX_PAGE_SIZE,
              offset,
              preferred: true,
              status: "active",
              yieldId,
            }),
          pageSize: API_MAX_PAGE_SIZE,
        }).pipe(
          Effect.mapBoth({
            onFailure: (cause) => new ValidatorsError({ cause }),
            onSuccess: (validators) => {
              const seen = new Set<string>();
              return validators.filter((validator) => {
                if (seen.has(validator.key)) return false;
                seen.add(validator.key);
                return true;
              });
            },
          })
        )
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
      validatorPolicy,
      Atom.withLabel("preferredValidatorsResourceAtom")
    )
);

export const preferredValidatorsResourceAtom = makePresentableResourceFamily(
  preferredValidatorsCanonicalAtom
);

type ValidatorsAtAddresses = {
  readonly addresses: ReadonlyArray<ValidatorAddress>;
  readonly status: "active" | null;
  readonly yieldId: YieldId;
};

/**
 * Every page of the validators at exactly these addresses, one per subnet
 * where the network has subnets, in the directory's order.
 */
const loadValidatorsAt = ({
  addresses,
  status,
  yieldId,
}: ValidatorsAtAddresses) =>
  YieldResourceSource.use((source) =>
    loadAllPages({
      concurrency: CONCURRENCY,
      fetchPage: (offset) =>
        source.listValidators({
          addresses,
          limit: API_MAX_PAGE_SIZE,
          offset,
          yieldId,
          ...(status ? { status } : {}),
        }),
      pageSize: API_MAX_PAGE_SIZE,
    }).pipe(
      Effect.mapBoth({
        onFailure: (cause) => new ValidatorsError({ cause }),
        onSuccess: (validators) => {
          // The API matches addresses in any case; only hex ones ignore it.
          const sought = new Set(validatorAddressIdentities(addresses));
          return validators.filter((validator) =>
            sought.has(validatorAddressIdentity(validator.address))
          );
        },
      })
    )
  );

export class ValidatorsAtAddressKey extends Data.TaggedClass(
  "ValidatorsAtAddressKey"
)<{
  readonly address: ValidatorAddress;
  readonly status: "active" | null;
  readonly yieldId: YieldId;
}> {}

/**
 * The validators at exactly this address, one per subnet where the network
 * has subnets; none when the directory lists none there.
 */
const validatorsAtAddressCanonicalAtom = Atom.family(
  (key: ValidatorsAtAddressKey) =>
    appRuntime
      .atom(() =>
        loadValidatorsAt({
          addresses: [key.address],
          status: key.status,
          yieldId: key.yieldId,
        })
      )
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
        validatorPolicy,
        Atom.withLabel("validatorsAtAddressAtom")
      )
);

export const validatorsAtAddressAtom = makePresentableResourceFamily(
  validatorsAtAddressCanonicalAtom
);

/** Up to `API_MAX_VALIDATOR_ADDRESSES` addresses, sorted so a batch has one key. */
export class ValidatorsAtAddressesKey extends Data.TaggedClass(
  "ValidatorsAtAddressesKey"
)<ValidatorsAtAddresses> {
  constructor(input: ValidatorsAtAddresses) {
    super({ ...input, addresses: input.addresses.toSorted() });
  }
}

/**
 * The validators at exactly these addresses, one per subnet where the
 * network has subnets, in the directory's order.
 */
const validatorsAtAddressesCanonicalAtom = Atom.family(
  (key: ValidatorsAtAddressesKey) =>
    appRuntime
      .atom(() => loadValidatorsAt(key))
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.yieldCatalog()),
        validatorPolicy,
        Atom.withLabel("validatorsAtAddressesAtom")
      )
);

export const validatorsAtAddressesAtom = makePresentableResourceFamily(
  validatorsAtAddressesCanonicalAtom
);
