import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import {
  getEnterAmountConstraint,
  getMinStakeAmount,
} from "../../src/domain/earn/stake";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

type EntryLimits = {
  readonly maximum: string | null;
  readonly minimum: string | null;
  readonly subsequentMinimum: string | null;
};

const yieldWithEnterLimits = ({
  amountMinimum,
  amountMaximum,
  entryLimits,
  id,
  network,
}: {
  readonly amountMaximum?: string;
  readonly amountMinimum?: string;
  readonly entryLimits?: EntryLimits;
  readonly id?: string;
  readonly network?: string;
}) => {
  const base = yieldApiYieldDtoFixture();

  return yieldApiYieldFixture({
    ...(id === undefined ? {} : { id }),
    mechanics: {
      ...base.mechanics,
      ...(entryLimits === undefined ? {} : { entryLimits }),
      ...(network === undefined
        ? {}
        : {
            gasFeeToken: {
              ...base.mechanics.gasFeeToken,
              network: network as typeof base.mechanics.gasFeeToken.network,
            },
          }),
      arguments: {
        ...base.mechanics.arguments,
        enter: {
          fields: [
            {
              label: "Amount",
              name: "amount",
              required: true,
              type: "string",
              ...(amountMinimum === undefined
                ? {}
                : { minimum: amountMinimum }),
              ...(amountMaximum === undefined
                ? {}
                : { maximum: amountMaximum }),
            },
          ],
        },
      },
    },
  });
};

const acredLikeYield = yieldWithEnterLimits({
  amountMinimum: "10000",
  entryLimits: {
    maximum: null,
    minimum: "50000",
    subsequentMinimum: "10000",
  },
});

describe("getMinStakeAmount", () => {
  it("requires the first-entry minimum from a non-holder", () => {
    expect(getMinStakeAmount(acredLikeYield, false)).toEqual(
      new BigNumber("50000")
    );
  });

  it("requires the subsequent minimum from a holder", () => {
    expect(getMinStakeAmount(acredLikeYield, true)).toEqual(
      new BigNumber("10000")
    );
  });

  it("falls back to the first-entry minimum for a holder without a subsequent minimum", () => {
    const yieldDto = yieldWithEnterLimits({
      amountMinimum: "1",
      entryLimits: { maximum: null, minimum: "2.5", subsequentMinimum: null },
    });

    expect(getMinStakeAmount(yieldDto, true)).toEqual(new BigNumber("2.5"));
  });

  it("falls back to the amount argument minimum without entry limits", () => {
    const yieldDto = yieldWithEnterLimits({
      amountMinimum: "0.000000000000000001",
    });

    expect(getMinStakeAmount(yieldDto, false)).toEqual(
      new BigNumber("0.000000000000000001")
    );
    expect(getMinStakeAmount(yieldDto, true)).toEqual(
      new BigNumber("0.000000000000000001")
    );
  });

  it("is zero without any advertised minimum", () => {
    expect(getMinStakeAmount(yieldWithEnterLimits({}), false)).toEqual(
      new BigNumber(0)
    );
  });

  it("keeps a zero minimum for Polkadot holders without a subsequent minimum", () => {
    const yieldDto = yieldWithEnterLimits({
      amountMinimum: "250",
      entryLimits: { maximum: null, minimum: "250", subsequentMinimum: null },
      id: "polkadot-dot-validator-staking",
      network: "polkadot",
    });

    expect(getMinStakeAmount(yieldDto, true)).toEqual(new BigNumber(0));
    expect(getMinStakeAmount(yieldDto, false)).toEqual(new BigNumber("250"));
  });

  it("honors an explicit subsequent minimum for Polkadot holders", () => {
    const yieldDto = yieldWithEnterLimits({
      amountMinimum: "250",
      entryLimits: { maximum: null, minimum: "250", subsequentMinimum: "1" },
      id: "polkadot-dot-validator-staking",
      network: "polkadot",
    });

    expect(getMinStakeAmount(yieldDto, true)).toEqual(new BigNumber("1"));
  });
});

describe("getEnterAmountConstraint", () => {
  it("keeps force-max ahead of entry limits", () => {
    const yieldDto = yieldWithEnterLimits({
      amountMaximum: "-1",
      amountMinimum: "-1",
      entryLimits: {
        maximum: null,
        minimum: "50000",
        subsequentMinimum: "10000",
      },
    });

    expect(getEnterAmountConstraint(yieldDto, false)).toEqual({
      type: "force-max",
    });
  });

  it("uses the holder-aware minimum in the range constraint", () => {
    expect(getEnterAmountConstraint(acredLikeYield, false)).toMatchObject({
      minimum: new BigNumber("50000"),
      type: "range",
    });
    expect(getEnterAmountConstraint(acredLikeYield, true)).toMatchObject({
      minimum: new BigNumber("10000"),
      type: "range",
    });
  });
});
