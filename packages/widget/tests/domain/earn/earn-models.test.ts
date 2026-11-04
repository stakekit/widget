import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Effect, Logger, Schema } from "effect";
import {
  EarnBalance,
  EarnPosition,
  EarnProvider,
  EarnValidator,
  EarnValidatorPage,
  EarnYield,
} from "../../../src/domain/earn/models";
import { Token } from "../../../src/domain/token/token";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../../fixtures";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  address: "0xAbCd",
} as const;

describe("Earn application models", () => {
  it("brands token/provider identifiers without changing case-sensitive addresses", () => {
    const decodedToken = Schema.decodeSync(Token)(token);
    const provider = Schema.decodeSync(EarnProvider)({
      id: "stakekit",
      name: "StakeKit",
      logoURI:
        "https://assets.stakek.it/app/composition/providers/stakekit.svg",
      website: "https://stakek.it",
      tvlUsd: null,
    });

    expect(decodedToken.address).toBe("0xAbCd");
    expect(provider.id).toBe("stakekit");
  });

  it("derives stable validator keys through Schema", () => {
    const validator = Schema.decodeSync(EarnValidator)({
      address: "validator-1",
      subnet: { id: 7, name: "Subnet 7" },
    });

    expect(validator.key).toBe("validator-1:7");
  });

  const tangemValidator = {
    address: "BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x",
    preferred: true,
    provider: {
      id: "tangem",
      name: "Tangem",
      logoURI: "https://example.com/logo.png",
      description: "Tangem validator provider",
      website: "https://tangem.com",
      tvlUsd: null,
      rank: 99,
      preferred: true,
      revshare: null,
      type: "provider-kind-added-later",
    },
  };

  it("decodes a validator without its unread provider", () => {
    const validator = Schema.decodeSync(EarnValidator)(tangemValidator);

    expect(validator).not.toHaveProperty("provider");
    expect(validator.key).toBe("BbM5kJgrwEj3tYFfBPnjcARB54wDUHkXmLUTkazUmt2x");
  });

  it("keeps validators with unread provider metadata in EarnValidatorPage", () => {
    const page = Schema.decodeSync(EarnValidatorPage)({
      total: 1,
      offset: 0,
      limit: 100,
      items: [tangemValidator],
    });

    expect(page.items).toHaveLength(1);
    expect(page.items?.[0]?.preferred).toBe(true);
  });

  it("uses lossless balance amount and raw-unit representations", () => {
    const balance = Schema.decodeSync(EarnBalance)({
      address: "wallet-1",
      type: "active",
      amount: "9007199254740993.000000000000000001",
      amountRaw: "9007199254740993000000000000000001",
      pendingActions: [],
      token,
      amountUsd: "12345678901234567890.12",
    });

    expect(BigNumber.isBigNumber(balance.amount)).toBe(true);
    expect(balance.amount.toFixed()).toBe(
      "9007199254740993.000000000000000001"
    );
    expect(balance.amountRaw).toBe(9007199254740993000000000000000001n);
    expect(balance.amountUsd?.toFixed()).toBe("12345678901234567890.12");
  });

  it.effect("decodes an encrypted balance's shares as its handle", () =>
    Effect.gen(function* () {
      const balance = yield* Schema.decodeEffect(EarnBalance)({
        address: "wallet-1",
        type: "active",
        amount: "0",
        amountRaw: "0",
        isEncrypted: true,
        pendingActions: [],
        shareAmount: "0",
        shareAmountRaw: `0x${"AB".repeat(32)}`,
        token,
      }).pipe(Effect.provide(Logger.layer([])));

      expect(balance.shares).toEqual({
        _tag: "Encrypted",
        handle: `0x${"ab".repeat(32)}`,
      });
    })
  );

  it.effect("decodes a plain balance's shares as exact amounts", () =>
    Effect.gen(function* () {
      const balance = yield* Schema.decodeEffect(EarnBalance)({
        address: "wallet-1",
        type: "active",
        amount: "1.6",
        amountRaw: "1600000",
        pendingActions: [],
        shareAmount: "1.500000000000000001",
        shareAmountRaw: "1500000000000000001",
        token,
      }).pipe(Effect.provide(Logger.layer([])));

      expect(balance.shares).toEqual({
        _tag: "Plain",
        amount: new BigNumber("1.500000000000000001"),
        amountRaw: 1500000000000000001n,
      });
    })
  );

  it.effect("drops only a malformed plain share count", () =>
    Effect.gen(function* () {
      const balance = yield* Schema.decodeEffect(EarnBalance)({
        address: "wallet-1",
        type: "active",
        amount: "1",
        amountRaw: "1",
        pendingActions: [],
        shareAmount: "2.5",
        shareAmountRaw: "not-a-quantity",
        token,
      }).pipe(Effect.provide(Logger.layer([])));

      expect(balance.amount.toFixed()).toBe("1");
      expect(balance.shares).toEqual({
        _tag: "Plain",
        amount: new BigNumber("2.5"),
      });
    })
  );

  it.effect("drops only a raw share count of the wrong wire type", () =>
    Effect.gen(function* () {
      const balance = yield* Schema.decodeEffect(EarnBalance)({
        address: "wallet-1",
        type: "active",
        amount: "1",
        amountRaw: "1",
        pendingActions: [],
        shareAmount: "2.5",
        shareAmountRaw: { value: 25 },
        token,
      }).pipe(Effect.provide(Logger.layer([])));

      expect(balance.shares).toEqual({
        _tag: "Plain",
        amount: new BigNumber("2.5"),
      });
    })
  );

  it.effect("safely omits an invalid optional balance timestamp", () =>
    Effect.gen(function* () {
      const balance = yield* Schema.decodeEffect(EarnBalance)({
        address: "wallet-1",
        type: "active",
        amount: "1",
        amountRaw: "1",
        date: "invalid",
        pendingActions: [],
        token,
      }).pipe(Effect.provide(Logger.layer([])));

      expect(balance.date).toBeUndefined();
    })
  );

  it("decodes a position whose balances carry null validator metadata", () => {
    const balance = {
      address: "wallet-1",
      type: "active",
      amount: "1",
      amountRaw: "1",
      pendingActions: [],
      token,
      isEarning: true,
    };
    const position = Schema.decodeSync(EarnPosition)({
      yieldId: "ethereum-eth-native-staking",
      balances: [
        { ...balance, validator: null },
        { ...balance, validators: null },
        { ...balance, validator: null, validators: null },
      ],
    });

    expect(position.balances).toHaveLength(3);
    for (const decoded of position.balances) {
      expect(decoded).not.toHaveProperty("validator");
      expect(decoded).not.toHaveProperty("validators");
    }
  });

  it("decodes complete yield and position models with branded yield IDs", () => {
    const yieldModel = yieldApiYieldFixture({ prime: false });
    const position = Schema.decodeSync(EarnPosition)({
      yieldId: yieldModel.id,
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
      ],
      outputTokenBalance: null,
    });

    expect(yieldModel.id).toBe("ethereum-eth-native-staking");
    expect(position.yieldId).toBe(yieldModel.id);
    expect(position.balances[0]?.amount.toFixed()).toBe("1.5");
  });

  it("projects the generated API amount representation into normalized domain constraints", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          enter: {
            fields: [
              {
                label: "Amount",
                minimum: null,
                name: "amount",
                type: "string",
              },
            ],
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments?.enter?.fields).toEqual({
      amount: {
        maximum: null,
        minimum: new BigNumber(0),
        required: false,
      },
    });
  });

  it("accepts the Cardano unbounded-maximum amount representation", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          enter: {
            fields: [
              {
                label: "Amount",
                maximum: "-1",
                minimum: "5",
                name: "amount",
                required: false,
                type: "string",
              },
            ],
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments?.enter?.fields.amount).toEqual({
      maximum: null,
      minimum: new BigNumber(5),
      required: false,
    });
  });

  it("decodes a yield without its unread liquidity state", () => {
    const yieldModel = yieldApiYieldFixture({
      state: {
        liquidityState: {
          liquidity: "8045570",
          utilization: "0",
        },
      },
    });

    expect(yieldModel.state).toEqual({});
  });

  const decodeYieldQuietly = (wire: unknown) =>
    Schema.decodeUnknownEffect(EarnYield)(wire).pipe(
      Effect.provide(Logger.layer([]))
    );

  it.effect("drops only a malformed fee and keeps the yield", () =>
    Effect.gen(function* () {
      const base = yieldApiYieldDtoFixture();
      const yieldModel = yield* decodeYieldQuietly({
        ...base,
        mechanics: {
          ...base.mechanics,
          fee: { deposit: "abc", management: "2.00" },
        },
      });

      expect(yieldModel.mechanics.fee).toEqual({
        deposit: null,
        management: new BigNumber("2"),
      });
    })
  );

  it.effect("drops only a malformed entry limit and keeps the yield", () =>
    Effect.gen(function* () {
      const base = yieldApiYieldDtoFixture();
      const yieldModel = yield* decodeYieldQuietly({
        ...base,
        mechanics: {
          ...base.mechanics,
          entryLimits: {
            maximum: null,
            minimum: "ten",
            subsequentMinimum: "10000",
          },
        },
      });

      expect(yieldModel.mechanics.entryLimits).toEqual({
        maximum: null,
        minimum: null,
        subsequentMinimum: new BigNumber("10000"),
      });
    })
  );

  it.effect("drops only malformed TVL values and keeps their models", () =>
    Effect.gen(function* () {
      const yieldModel = yield* decodeYieldQuietly({
        ...yieldApiYieldDtoFixture(),
        statistics: { tvlUsd: "1,200,000", averagePositionSizeUsd: "3448.27" },
      });
      const provider = yield* Schema.decodeEffect(EarnProvider)({
        id: "stakekit",
        name: "StakeKit",
        logoURI: "https://stakek.it/logo.svg",
        website: "https://stakek.it",
        tvlUsd: "",
      }).pipe(Effect.provide(Logger.layer([])));
      const validator = yield* Schema.decodeUnknownEffect(EarnValidator)({
        address: "validator-1",
        tvl: "lots",
        tvlRaw: "8250450000000000000000",
      }).pipe(Effect.provide(Logger.layer([])));
      const validatorWithTvl = yield* Schema.decodeEffect(EarnValidator)({
        address: "validator-2",
        tvl: "8250.45",
      });

      expect(yieldModel.statistics).toEqual({
        averagePositionSizeUsd: new BigNumber("3448.27"),
        tvlUsd: null,
      });
      expect(provider.tvlUsd).toBeNull();
      expect(validator.tvl).toBeNull();
      expect(validator).not.toHaveProperty("tvlRaw");
      expect(validatorWithTvl.tvl).toEqual(new BigNumber("8250.45"));
    })
  );

  it.effect(
    "drops only a malformed price-per-share state and keeps the yield",
    () =>
      Effect.gen(function* () {
        const base = yieldApiYieldDtoFixture();
        const malformed = yield* decodeYieldQuietly({
          ...base,
          state: {
            pricePerShareState: {
              price: "not-a-price",
              quoteToken: base.token,
              shareToken: base.token,
            },
          },
        });
        const priced = yield* decodeYieldQuietly({
          ...base,
          state: {
            pricePerShareState: {
              price: 1.05,
              quoteToken: base.token,
              shareToken: base.token,
            },
          },
        });

        expect(malformed.state).toEqual({ pricePerShareState: null });
        expect(priced.state?.pricePerShareState?.price).toEqual(
          new BigNumber("1.05")
        );
      })
  );

  it("decodes advertised provider options as opaque values", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          enter: {
            fields: [
              {
                label: "Provider",
                name: "providerId",
                options: ["P2P", "figment"],
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments?.enter?.fields.providerId).toEqual({
      options: ["P2P", "figment"],
      required: true,
    });
  });

  it("keeps only widget-consumed mechanic argument fields", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          enter: {
            fields: [
              {
                label: "Amount",
                maximum: "100",
                minimum: "0.000000000000000001",
                name: "amount",
                required: true,
                type: "string",
              },
              {
                label: "Provider",
                name: "providerId",
                options: ["provider-a"],
                required: true,
                type: "string",
              },
              {
                label: "Resource",
                name: "tronResource",
                options: ["BANDWIDTH", "ENERGY"],
                type: "enum",
              },
              {
                label: "Validator",
                name: "validatorAddress",
                required: true,
                type: "string",
              },
              {
                label: "Validators",
                name: "validatorAddresses",
                type: "string",
              },
              {
                label: "Subnet",
                name: "subnetId",
                type: "number",
              },
              {
                label: "Ignored",
                name: "duration",
                type: "number",
              },
            ],
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments?.enter?.fields).toEqual({
      amount: {
        maximum: new BigNumber(100),
        minimum: new BigNumber("0.000000000000000001"),
        required: true,
      },
      providerId: {
        options: ["provider-a"],
        required: true,
      },
      subnetId: {
        required: false,
      },
      tronResource: {
        options: ["BANDWIDTH", "ENERGY"],
        required: false,
      },
      validatorAddress: {
        required: true,
      },
      validatorAddresses: {
        required: false,
      },
    });
  });

  it("validates read mechanic argument fields before projection", () => {
    const baseYield = yieldApiYieldDtoFixture();

    expect(() =>
      yieldApiYieldFixture({
        mechanics: {
          ...baseYield.mechanics,
          arguments: {
            enter: {
              fields: [
                {
                  name: "duration",
                  required: "yes",
                  type: "number",
                } as never,
              ],
            },
          },
        },
      })
    ).toThrow();
  });

  it("projects consumed fields from every mechanic argument container", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          balance: {
            fields: [
              {
                label: "Resource",
                name: "tronResource",
                options: ["ENERGY"],
                type: "enum",
              },
            ],
          },
          enter: {
            fields: [
              {
                label: "Amount",
                name: "amount",
                type: "string",
              },
            ],
          },
          exit: {
            fields: [
              {
                label: "Validator",
                name: "validatorAddress",
                required: true,
                type: "string",
              },
            ],
          },
          manage: {
            CLAIM_REWARDS: {
              fields: [
                {
                  label: "Provider",
                  name: "providerId",
                  options: ["provider-a"],
                  type: "string",
                },
              ],
            },
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments).toEqual({
      balance: {
        fields: {
          tronResource: {
            options: ["ENERGY"],
            required: false,
          },
        },
      },
      enter: {
        fields: {
          amount: {
            maximum: null,
            minimum: new BigNumber(0),
            required: false,
          },
        },
      },
      exit: {
        fields: {
          validatorAddress: {
            required: true,
          },
        },
      },
      manage: {
        CLAIM_REWARDS: {
          fields: {
            providerId: {
              options: ["provider-a"],
              required: false,
            },
          },
        },
      },
    });
  });

  it("projects exit receive-token options from the Yield API contract", () => {
    const baseYield = yieldApiYieldDtoFixture();
    const yieldModel = yieldApiYieldFixture({
      mechanics: {
        ...baseYield.mechanics,
        arguments: {
          exit: {
            fields: [
              {
                label: "Output Token",
                name: "outputToken",
                options: [
                  "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
                  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                ],
                required: false,
                type: "string",
              },
            ],
          },
        },
      },
    });

    expect(yieldModel.mechanics.arguments?.exit?.fields.outputToken).toEqual({
      options: [
        "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      ],
      required: false,
    });
  });

  it.each([
    {
      field: {
        label: "Amount",
        name: "amount",
        type: "number",
      },
      name: "an amount with a non-canonical type",
    },
    {
      field: {
        label: "Amount",
        minimum: "not-a-number",
        name: "amount",
        type: "string",
      },
      name: "non-finite amount bounds",
    },
    {
      field: {
        label: "Amount",
        maximum: "2",
        minimum: "3",
        name: "amount",
        type: "string",
      },
      name: "an amount maximum below its minimum",
    },
    {
      field: {
        label: "Amount",
        maximum: null,
        minimum: "-1",
        name: "amount",
        type: "string",
      },
      name: "a partial force-max sentinel",
    },
    {
      field: {
        label: "Provider",
        name: "providerId",
        options: [],
        required: true,
        type: "string",
      },
      name: "a required provider without options",
    },
    {
      field: {
        label: "Provider",
        name: "providerId",
        options: [""],
        type: "string",
      },
      name: "an invalid provider option",
    },
    {
      field: {
        label: "Resource",
        name: "tronResource",
        options: ["COMPUTE"],
        type: "enum",
      },
      name: "an invalid Tron resource option",
    },
    {
      field: {
        label: "Provider",
        name: "providerId",
        options: ["provider-a"],
        type: "enum",
      },
      name: "a provider with a non-canonical type",
    },
    {
      field: {
        label: "Resource",
        name: "tronResource",
        options: ["ENERGY"],
        type: "string",
      },
      name: "a Tron resource with a non-canonical type",
    },
    {
      field: {
        label: "Validator",
        name: "validatorAddress",
        type: "address",
      },
      name: "a validator address with a non-canonical type",
    },
    {
      field: {
        label: "Validators",
        name: "validatorAddresses",
        type: "address",
      },
      name: "validator addresses with a non-canonical type",
    },
    {
      field: {
        label: "Subnet",
        name: "subnetId",
        type: "string",
      },
      name: "a subnet ID with a non-canonical type",
    },
  ])("rejects $name", ({ field }) => {
    const baseYield = yieldApiYieldDtoFixture();

    expect(() =>
      yieldApiYieldFixture({
        mechanics: {
          ...baseYield.mechanics,
          arguments: {
            enter: {
              fields: [field as never],
            },
          },
        },
      })
    ).toThrow();
  });

  it("rejects a present argument container without a fields array", () => {
    const valid = yieldApiYieldDtoFixture();

    expect(() =>
      Schema.decodeUnknownSync(EarnYield)({
        ...valid,
        mechanics: {
          ...valid.mechanics,
          arguments: { enter: {} },
        },
      })
    ).toThrow();
  });
});
