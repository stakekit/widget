import { Data, Duration, Effect, Option, Schema, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import { EarnValidator } from "../../domain/earn/models";
import type {
  ValidatorAddress,
  YieldId,
} from "../../domain/identity/identifiers";
import {
  type ApiRequestError,
  ResponseDecodeError,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../services/api/resource-sources";
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
  readonly items: ReadonlyArray<typeof EarnValidator.Type>;
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
            const activeBranches = (
              Object.entries(state.cursor) as ReadonlyArray<
                readonly [ValidatorBranch, number | null]
              >
            ).filter(
              (entry): entry is [ValidatorBranch, number] => entry[1] !== null
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
          Effect.map((validators) => {
            const seen = new Set<string>();
            return validators.filter((validator) => {
              if (seen.has(validator.key)) return false;
              seen.add(validator.key);
              return true;
            });
          }),
          Effect.mapError((cause) => new ValidatorsError({ cause }))
        )
      )
    )
    .pipe(validatorPolicy, Atom.withLabel("preferredValidatorsResourceAtom"))
);

export const preferredValidatorsResourceAtom = makePresentableResourceFamily(
  preferredValidatorsCanonicalAtom
);

export class ValidatorByAddressKey extends Data.TaggedClass(
  "ValidatorByAddressKey"
)<{
  readonly address: ValidatorAddress;
  readonly yieldId: YieldId;
}> {}

const validatorByAddressCanonicalAtom = Atom.family(
  (key: ValidatorByAddressKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source
            .listValidators({
              address: key.address,
              limit: API_MAX_PAGE_SIZE,
              offset: 0,
              yieldId: key.yieldId,
            })
            .pipe(
              Effect.mapError((cause) => new ValidatorsError({ cause })),
              Effect.flatMap((page) => {
                const normalizedAddress = key.address.toLowerCase();
                const validator = page.items?.find(
                  (item) => item.address.toLowerCase() === normalizedAddress
                );

                return validator
                  ? Effect.succeed(validator)
                  : Schema.decodeUnknownEffect(EarnValidator)({
                      address: key.address,
                    }).pipe(
                      Effect.mapError(
                        (cause) =>
                          new ValidatorsError({
                            cause: new ResponseDecodeError({
                              cause,
                              issue: cause.message,
                              operation: "validator-by-address-fallback",
                            }),
                          })
                      )
                    );
              })
            )
        )
      )
      .pipe(validatorPolicy, Atom.withLabel("validatorByAddressAtom"))
);

export const validatorByAddressAtom = makePresentableResourceFamily(
  validatorByAddressCanonicalAtom
);
