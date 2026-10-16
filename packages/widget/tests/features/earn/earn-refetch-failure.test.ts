import { Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { tokenString } from "../../../src/domain/token/token";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  mergedTokenOptionsAtom,
  yieldValidatorsAtom,
} from "../../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  TokenOptionsKey,
  YieldValidatorsKey,
} from "../../../src/features/earn/state/earn-selection/catalog/keys";
import { tokenBalancesResourceAtom } from "../../../src/resources/token-balances/index";
import { preferredValidatorsResourceAtom } from "../../../src/resources/validator-directory/index";
import {
  ApiRequestError,
  LegacyResourceSource,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const earnYield = yieldApiYieldFixture();
const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
});

describe("Earn derived atoms after a failed refetch", () => {
  it("keeps the balance-enriched token options when a balances refetch fails", () => {
    let offline = false;
    const balances = Schema.decodeSync(TokenBalancesResponse)([
      {
        amount: "5",
        availableYields: [earnYield.id],
        token: earnYield.token,
      },
    ]);
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              LegacyResourceSource,
              LegacyResourceSource.of({
                getTokenOptions: () =>
                  Effect.succeed([
                    {
                      availableYields: [earnYield.id],
                      token: earnYield.token,
                    },
                  ]),
                scanTokenBalances: () =>
                  offline
                    ? Effect.fail(
                        new ApiRequestError({
                          cause: new Error("offline"),
                          failure: { _tag: "Unreachable" },
                          operation: "token-balances-scan",
                        })
                      )
                    : Effect.succeed(balances),
              } as never)
            ),
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({} as never)
            )
          ) as never
        ),
      ],
    });
    const tokenOptions = mergedTokenOptionsAtom(
      new TokenOptionsKey({ category: null, scope })
    );
    const unmount = registry.mount(tokenOptions);

    try {
      expect(AsyncResult.getOrThrow(registry.get(tokenOptions))).toMatchObject([
        { amount: "5", source: "balance" },
      ]);

      offline = true;
      registry.refresh(tokenBalancesResourceAtom.local(scope));
      const refetched = registry.get(tokenOptions);

      expect(AsyncResult.isFailure(refetched)).toBe(true);
      const [option] = refetched.pipe(AsyncResult.value, Option.getOrThrow);
      expect(option && tokenString(option.token)).toBe(
        tokenString(earnYield.token)
      );
      expect(option).toMatchObject({ amount: "5", source: "balance" });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps the merged validators when a preferred validators refetch fails", () => {
    let offline = false;
    const preferred = {
      ...yieldApiValidatorFixture({ address: "preferred-validator" }),
      key: "preferred-validator" as never,
      preferred: true,
    };
    const fallback = {
      ...yieldApiValidatorFixture({ address: "default-validator" }),
      key: "default-validator" as never,
    };
    const listValidators = (request: ValidatorDirectoryRequest) =>
      request.preferred && offline
        ? Effect.fail(
            new ApiRequestError({
              cause: new Error("offline"),
              failure: { _tag: "Unreachable" },
              operation: "validators",
            })
          )
        : Effect.succeed({
            items: request.preferred ? [preferred] : [fallback],
            limit: request.limit,
            offset: request.offset,
            total: 1,
          });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({ listValidators } as never)
          )
        ),
      ],
    });
    const resource = yieldValidatorsAtom(
      new YieldValidatorsKey({ selectedYieldId: earnYield.id })
    );
    const unmount = registry.mount(resource.initialValidatorsResultAtom);

    try {
      expect(
        AsyncResult.getOrThrow(
          registry.get(resource.initialValidatorsResultAtom)
        ).items.map((validator) => validator.key)
      ).toEqual(["preferred-validator", "default-validator"]);

      offline = true;
      registry.refresh(preferredValidatorsResourceAtom.local(earnYield.id));
      const refetched = registry.get(resource.initialValidatorsResultAtom);

      expect(AsyncResult.isFailure(refetched)).toBe(true);
      expect(
        refetched
          .pipe(AsyncResult.value, Option.getOrThrow)
          .items.map((validator) => validator.key)
      ).toEqual(["preferred-validator", "default-validator"]);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
