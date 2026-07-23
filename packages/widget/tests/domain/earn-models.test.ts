import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  EarnBalance,
  EarnPosition,
  EarnProvider,
  EarnToken,
  EarnValidator,
  EarnYield,
} from "../../src/domain/schema/earn-models";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  address: "0xAbCd",
} as const;

describe("Earn application models", () => {
  it("brands token/provider identifiers without changing case-sensitive addresses", () => {
    const decodedToken = Schema.decodeUnknownSync(EarnToken)(token);
    const provider = Schema.decodeUnknownSync(EarnProvider)({
      id: "stakekit",
      name: "StakeKit",
      description: "",
      logoURI:
        "https://assets.stakek.it/app/composition/providers/stakekit.svg",
      website: "https://stakek.it",
      tvlUsd: null,
      type: "protocol",
    });

    expect(decodedToken.address).toBe("0xAbCd");
    expect(provider.id).toBe("stakekit");
  });

  it("derives stable validator keys through Schema", () => {
    const validator = Schema.decodeUnknownSync(EarnValidator)({
      address: "validator-1",
      subnet: { id: 7, name: "Subnet 7" },
    });

    expect(validator.key).toBe("validator-1:7");
  });

  it("uses lossless balance amount and raw-unit representations", () => {
    const balance = Schema.decodeUnknownSync(EarnBalance)({
      address: "wallet-1",
      type: "active",
      amount: "9007199254740993.000000000000000001",
      amountRaw: "9007199254740993000000000000000001",
      pendingActions: [],
      token,
      amountUsd: "12345678901234567890.12",
      isEarning: true,
    });

    expect(BigNumber.isBigNumber(balance.amount)).toBe(true);
    expect(balance.amount.toFixed()).toBe(
      "9007199254740993.000000000000000001"
    );
    expect(balance.amountRaw).toBe(9007199254740993000000000000000001n);
    expect(balance.amountUsd?.toFixed()).toBe("12345678901234567890.12");
  });

  it("decodes complete yield and position models with branded yield IDs", () => {
    const yieldModel = yieldApiYieldFixture({ prime: false });
    const position = Schema.decodeUnknownSync(EarnPosition)({
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
        minimum: "0",
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
      minimum: "5",
      required: false,
    });
  });

  it("accepts string-valued liquidity state from the Yield API", () => {
    const yieldModel = yieldApiYieldFixture({
      state: {
        liquidityState: {
          liquidity: "8045570",
          utilization: "0",
        },
      },
    });

    expect(yieldModel.state?.liquidityState).toEqual({
      liquidity: "8045570",
      utilization: "0",
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
        maximum: "100",
        minimum: "0.000000000000000001",
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

  it("validates unconsumed mechanic fields through the API schema before projection", () => {
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
            minimum: "0",
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
