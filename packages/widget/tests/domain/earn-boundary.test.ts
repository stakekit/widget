import { Effect, Logger, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  EarnLegacyTokenOptionsResponse,
  EarnPositionsResponse,
  EarnProvider,
  EarnTokenBalancesResponse,
  EarnTokenPage,
  EarnValidatorPage,
  EarnYield,
  EarnYieldPage,
} from "../../src/domain/schema/earn-models";
import { resolveYieldOptions } from "../../src/pages/details/earn-page/state/atoms-state/resolver/yield";
import { yieldApiYieldFixture } from "../fixtures";

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
  Effect.runPromise(
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.provide(Logger.layer([]))
    )
  );

describe("Earn API boundary policies", () => {
  it("keeps valid catalog entries and omits a complete nested-invalid yield", async () => {
    const valid = yieldApiYieldFixture({ prime: false });
    const result = await decode(EarnYieldPage, {
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
  });

  it("returns an empty catalog when every top-level yield is invalid", async () => {
    const valid = yieldApiYieldFixture({ prime: false });
    const result = await decode(EarnYieldPage, {
      items: [{ ...valid, id: "invalid-yield", prime: "no" }],
      limit: 100,
      offset: 0,
      total: 1,
    });

    expect(result.items).toEqual([]);
  });

  it("strictly rejects a malformed initial yield", async () => {
    await expect(
      decode(EarnYield, {
        ...yieldApiYieldFixture({ prime: false }),
        metadata: null,
      })
    ).rejects.toThrow();
  });

  it("strictly rejects a malformed provider", async () => {
    await expect(
      decode(EarnProvider, {
        id: "",
        name: "StakeKit",
        description: "",
        logoURI: "https://assets.stakek.it/providers/stakekit.svg",
        website: "https://stakek.it",
        tvlUsd: null,
        type: "protocol",
      })
    ).rejects.toThrow();
  });

  it("omits malformed complete token options and balances", async () => {
    const validOption = {
      availableYields: ["ethereum-eth-native-staking"],
      token,
    };
    const malformedOption = {
      ...validOption,
      token: { ...token, decimals: "18" },
    };
    const [page, legacyOptions, balances] = await Promise.all([
      decode(EarnTokenPage, {
        items: [validOption, malformedOption],
        limit: 2,
        offset: 0,
        total: 2,
      }),
      decode(EarnLegacyTokenOptionsResponse, [validOption, malformedOption]),
      decode(EarnTokenBalancesResponse, [
        { ...validOption, amount: "1.5" },
        { ...malformedOption, amount: "2" },
      ]),
    ]);

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(legacyOptions).toHaveLength(1);
    expect(balances).toHaveLength(1);
    expect(balances[0]?.amount.toFixed()).toBe("1.5");
  });

  it("partially decodes validators and derives stable keys", async () => {
    const result = await decode(EarnValidatorPage, {
      items: [
        { address: "validator-1", subnet: { id: 7 } },
        { name: "missing-address" },
      ],
      limit: 100,
      offset: 0,
      total: 2,
    });

    expect(result.items?.map((item) => item.key)).toEqual(["validator-1:7"]);
  });

  it("rejects a complete position when a nested balance is invalid", async () => {
    const result = await decode(EarnPositionsResponse, {
      errors: [],
      items: [
        {
          yieldId: "ethereum-eth-native-staking",
          balances: [
            {
              address: "wallet-1",
              type: "active",
              amount: "1.5",
              amountRaw: "1500000000000000000",
              pendingActions: [],
              token,
              isEarning: true,
            },
            {
              address: "wallet-1",
              type: "active",
              amount: "NaN",
              amountRaw: "1",
              pendingActions: [],
              token,
              isEarning: true,
            },
          ],
        },
      ],
    });

    expect(result.items).toEqual([]);
  });

  it("preserves existing token-scoped yield selection behavior", async () => {
    const yieldModel = await decode(
      EarnYield,
      yieldApiYieldFixture({ prime: false })
    );
    const options = resolveYieldOptions({
      selectedToken: {
        token: yieldModel.token,
        availableYields: [yieldModel.id],
        amount: "0",
        source: "default",
      },
      yieldsById: [yieldModel],
    });

    expect(options.map((option) => option.id)).toEqual([yieldModel.id]);
  });
});
