import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, Schema } from "effect";
import {
  EarnLegacyTokenOptionsResponse,
  EarnProvider,
  EarnValidatorPage,
  EarnYield,
  EarnYieldPage,
} from "../../src/domain/earn/models";
import { TokenBalancesResponse } from "../../src/domain/finance/models";
import { yieldApiYieldDtoFixture } from "../fixtures";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  address: "0xAbCd",
} as const;

const decode = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
) =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.provide(Logger.layer([]))
  );

describe("Earn API boundary policies", () => {
  it.effect(
    "keeps valid catalog entries and omits a complete nested-invalid yield",
    () =>
      Effect.gen(function* () {
        const valid = yieldApiYieldDtoFixture({ prime: false });
        const result = yield* decode(EarnYieldPage, {
          items: [
            valid,
            {
              ...valid,
              id: "invalid-yield",
              token: { ...valid.token, decimals: "18" },
            },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        });

        expect(result.items?.map((item) => item.id)).toEqual([valid.id]);
        expect(result.total).toBe(2);
      })
  );

  it.effect(
    "omits only the yield with an invalid consumed mechanic argument",
    () =>
      Effect.gen(function* () {
        const valid = yieldApiYieldDtoFixture({ prime: false });
        const result = yield* decode(EarnYieldPage, {
          items: [
            valid,
            {
              ...valid,
              id: "invalid-mechanic-yield",
              mechanics: {
                ...valid.mechanics,
                arguments: {
                  enter: {
                    fields: [
                      {
                        label: "Amount",
                        minimum: "not-a-number",
                        name: "amount",
                        type: "string",
                      },
                    ],
                  },
                },
              },
            },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        });

        expect(result.items?.map((item) => item.id)).toEqual([valid.id]);
      })
  );

  it.effect("keeps a yield whose argument field has a scalar default", () =>
    Effect.gen(function* () {
      const valid = yieldApiYieldDtoFixture({ prime: false });
      const withScalarDefault = {
        ...valid,
        id: "ethereum-usdc-aave-v3-lending",
        mechanics: {
          ...valid.mechanics,
          arguments: {
            enter: {
              fields: [
                {
                  default: "individual",
                  label: "Transaction Execution Mode",
                  name: "executionMode",
                  options: ["individual", "batched"],
                  type: "enum",
                },
              ],
            },
          },
        },
      };
      const result = yield* decode(EarnYieldPage, {
        items: [withScalarDefault],
        limit: 100,
        offset: 0,
        total: 1,
      });

      expect(result.items?.map((item) => item.id)).toEqual([
        withScalarDefault.id,
      ]);
    })
  );

  it.effect(
    "returns an empty catalog when every top-level yield is invalid",
    () =>
      Effect.gen(function* () {
        const valid = yieldApiYieldDtoFixture({ prime: false });
        const result = yield* decode(EarnYieldPage, {
          items: [{ ...valid, id: "invalid-yield", prime: "no" }],
          limit: 100,
          offset: 0,
          total: 1,
        });

        expect(result.items).toEqual([]);
      })
  );

  it.effect("strictly rejects a malformed initial yield", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        decode(EarnYield, {
          ...yieldApiYieldDtoFixture({ prime: false }),
          metadata: null,
        })
      );
      expect(() => {
        throw failure;
      }).toThrow();
    })
  );

  it.effect("strictly rejects a malformed provider", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        decode(EarnProvider, {
          id: "",
          name: "StakeKit",
          description: "",
          logoURI:
            "https://assets.stakek.it/app/composition/providers/stakekit.svg",
          website: "https://stakek.it",
          tvlUsd: null,
          type: "protocol",
        })
      );
      expect(() => {
        throw failure;
      }).toThrow();
    })
  );

  it.effect("omits malformed complete token options and balances", () =>
    Effect.gen(function* () {
      const validOption = {
        availableYields: ["ethereum-eth-native-staking"],
        token,
      };
      const malformedOption = {
        ...validOption,
        token: { ...token, decimals: "18" },
      };
      const [legacyOptions, balances] = yield* Effect.all(
        [
          decode(EarnLegacyTokenOptionsResponse, [
            validOption,
            malformedOption,
          ]),
          decode(TokenBalancesResponse, [
            { ...validOption, amount: "1.5" },
            { ...malformedOption, amount: "2" },
          ]),
        ],
        { concurrency: "unbounded" }
      );

      expect(legacyOptions).toHaveLength(1);
      expect(balances).toHaveLength(1);
      expect(balances[0]?.amount.toFixed()).toBe("1.5");
    })
  );

  it.effect("partially decodes validators and derives stable keys", () =>
    Effect.gen(function* () {
      const result = yield* decode(EarnValidatorPage, {
        items: [
          { address: "validator-1", subnet: { id: 7 } },
          { name: "missing-address" },
        ],
        limit: 100,
        offset: 0,
        total: 2,
      });

      expect(result.items?.map((item) => item.key)).toEqual(["validator-1:7"]);
    })
  );
});
