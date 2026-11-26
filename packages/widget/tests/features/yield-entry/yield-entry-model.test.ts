import BigNumber from "bignumber.js";
import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";

import type {
  ActionCommand,
  ActionSimulation,
} from "../../../src/domain/earn/action-models";
import { YieldCampaign } from "../../../src/domain/earn/campaign";
import type { WalletCampaignStanding } from "../../../src/domain/earn/campaign-rewards";
import { Prices } from "../../../src/domain/finance/prices";
import {
  TokenAddress,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import type { Token } from "../../../src/domain/token/token";
import {
  getMaxGasReserve,
  getMaxGasReserveNote,
  getNetworkFeeEstimate,
} from "../../../src/features/yield-entry/model/network-fee";
import {
  getYieldEntrySimulations,
  projectYieldEntry,
} from "../../../src/features/yield-entry/model/yield-entry";
import {
  confidentialYieldFixture,
  yieldApiCampaignDtoFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
// The fixture yield stakes its own gas token, ETH.
const nativeYield = yieldApiYieldFixture();
const eth = nativeYield.token;
const usdc: Token = {
  ...eth,
  address: Schema.decodeSync(TokenAddress)(
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  ),
  decimals: 6,
  name: "USD Coin",
  symbol: "USDC",
};

const simulation = (
  gas: string | null,
  entryReserveEstimate?: string
): ActionSimulation => ({
  gas: { amount: gas === null ? null : new BigNumber(gas), token: eth },
  ...(entryReserveEstimate === undefined
    ? {}
    : { entryReserveEstimate: new BigNumber(entryReserveEstimate) }),
});

const ethPrices = new Prices(
  new Map([
    [
      `${eth.network}-`,
      { price: new BigNumber(2000), price24H: new BigNumber(2000) },
    ],
  ])
);

const entryInput = ({
  amount = "0",
  availableAmount = new BigNumber(2),
  connected = true,
  token = eth,
  useMaxAmount = false,
  yieldDto = nativeYield,
}: {
  readonly amount?: string;
  readonly availableAmount?: BigNumber | null;
  readonly connected?: boolean;
  readonly token?: Token;
  readonly useMaxAmount?: boolean;
  readonly yieldDto?: typeof nativeYield;
} = {}) =>
  ({
    amountInitialization: "PreserveIntent",
    availableAmount,
    campaign: null,
    campaignStanding: { _tag: "Unknown" },
    connected,
    entry: {
      amount: new BigNumber(amount),
      selectedProviderOption: null,
      token,
      tronResource: null,
      useMaxAmount,
      validators: new Map(),
      yield: yieldDto,
    },
    externalProviders: false,
    hasNoYields: false,
    isKycBlocking: false,
    isKycLoading: false,
    isLedgerAccountPlaceholder: false,
    readiness: { _tag: "Ready" },
    selectedYieldHasActivePosition: false,
    providers: null,
    validateAmount: connected && amount !== "0",
    wallet: {
      additionalAddresses: null,
      address: connected ? address : null,
      isLedgerLive: false,
    },
  }) as const;

/** A yield whose enter amount takes these limits; `-1` both forces Max. */
const yieldWithEnterLimits = ({
  maximum,
  minimum,
}: {
  readonly maximum?: string;
  readonly minimum: string;
}) => {
  const base = yieldApiYieldDtoFixture();
  return yieldApiYieldFixture({
    mechanics: {
      ...base.mechanics,
      arguments: {
        ...base.mechanics.arguments,
        enter: {
          fields: [
            {
              label: "Amount",
              ...(maximum === undefined ? {} : { maximum }),
              minimum,
              name: "amount",
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  });
};

describe("network fee estimate", () => {
  const settled = {
    connected: true,
    hidden: false,
    pending: false,
    prices: ethPrices,
  } as const;

  it("states the fee in the gas token with its fiat value", () => {
    const note = getNetworkFeeEstimate({
      ...settled,
      simulation: simulation("0.0003"),
    });

    expect(note?._tag).toBe("Estimate");
    const fee = note?._tag === "Estimate" ? note.fee : null;
    expect(fee?.amount.toFixed()).toBe("0.0003");
    expect(fee?.token.symbol).toBe("ETH");
    expect(fee?.usd?.toFixed()).toBe("0.6");
  });

  it("states the fee alone without a price", () => {
    const note = getNetworkFeeEstimate({
      ...settled,
      prices: null,
      simulation: simulation("0.0003"),
    });

    const fee = note?._tag === "Estimate" ? note.fee : null;
    expect(fee?.amount.toFixed()).toBe("0.0003");
    expect(fee?.usd).toBeNull();
  });

  it("holds no line when the host hides gas fees or no wallet is connected", () => {
    expect(
      getNetworkFeeEstimate({
        ...settled,
        hidden: true,
        simulation: simulation("0.0003"),
      })
    ).toBeNull();
    expect(
      getNetworkFeeEstimate({
        ...settled,
        connected: false,
        pending: true,
        simulation: null,
      })
    ).toBeNull();
  });

  it("holds the line pending while a new estimate loads", () => {
    expect(
      getNetworkFeeEstimate({ ...settled, pending: true, simulation: null })
    ).toEqual({ _tag: "Pending" });
  });

  it("holds the line unknown without an amount, or for an unpriced estimate", () => {
    expect(getNetworkFeeEstimate({ ...settled, simulation: null })).toEqual({
      _tag: "Unknown",
    });
    expect(
      getNetworkFeeEstimate({ ...settled, simulation: simulation(null) })
    ).toEqual({ _tag: "Unknown" });
    expect(
      getNetworkFeeEstimate({ ...settled, simulation: simulation("0") })
    ).toEqual({ _tag: "Unknown" });
  });
});

describe("Max gas reserve", () => {
  it("keeps nothing aside of a token that does not pay the gas", () => {
    expect(
      getMaxGasReserve({
        simulation: null,
        stakeToken: usdc,
        yieldDto: nativeYield,
      })?.toFixed()
    ).toBe("0");
  });

  it("keeps the estimated gas aside of the gas token", () => {
    expect(
      getMaxGasReserve({
        simulation: simulation("0.0003"),
        stakeToken: eth,
        yieldDto: nativeYield,
      })?.toFixed()
    ).toBe("0.0003");
  });

  it("keeps the entry reserve in place of the gas where the API gives one", () => {
    expect(
      getMaxGasReserve({
        simulation: simulation("0.000005", "0.007"),
        stakeToken: eth,
        yieldDto: nativeYield,
      })?.toFixed()
    ).toBe("0.007");
  });

  it("is unknown for the gas token until its estimate settles", () => {
    expect(
      getMaxGasReserve({
        simulation: null,
        stakeToken: eth,
        yieldDto: nativeYield,
      })
    ).toBeNull();
    expect(
      getMaxGasReserve({
        simulation: simulation(null),
        stakeToken: eth,
        yieldDto: nativeYield,
      })
    ).toBeNull();
  });

  it("fills the balance less the reserve, and nothing while it is unknown", () => {
    const withReserve = projectYieldEntry({
      gasReserve: new BigNumber("0.0003"),
      input: entryInput(),
      submitted: false,
    });
    const unknown = projectYieldEntry({
      gasReserve: null,
      input: entryInput(),
      submitted: false,
    });

    expect(withReserve.maxAmount?.toFixed()).toBe("1.9997");
    expect(unknown.maxAmount).toBeNull();
  });

  it("validates a typed amount against the balance alone", () => {
    const view = projectYieldEntry({
      gasReserve: new BigNumber("0.0003"),
      input: entryInput({ amount: "2" }),
      submitted: false,
    });

    expect(view.validation.hasErrors).toBe(false);
  });

  const reserveBase = {
    availableAmount: new BigNumber(2),
    hidden: false,
    maximum: null,
    reserve: new BigNumber("0.0003"),
    reservePending: false,
    stakeToken: eth,
    yieldDto: nativeYield,
  } as const;

  it("says what Max leaves aside of the gas token, whether or not Max is in use", () => {
    expect(getMaxGasReserveNote(reserveBase)).toEqual({
      _tag: "Reserve",
      amount: new BigNumber("0.0003"),
      token: eth,
    });
  });

  it("holds the line pending while the reserve loads", () => {
    expect(
      getMaxGasReserveNote({
        ...reserveBase,
        reserve: null,
        reservePending: true,
      })
    ).toEqual({ _tag: "Pending", token: eth });
  });

  it("leaves the reserve's amount unsaid when the host hides gas fees", () => {
    expect(
      getMaxGasReserveNote({ ...reserveBase, hidden: true, reserve: null })
    ).toEqual({ _tag: "Unstated", token: eth });
  });

  it("keeps the line, its amount unsaid, once the reserve settles unknown or at nothing, or the yield's maximum held Max", () => {
    const unstated = { _tag: "Unstated", token: eth };
    expect(getMaxGasReserveNote({ ...reserveBase, reserve: null })).toEqual(
      unstated
    );
    expect(
      getMaxGasReserveNote({ ...reserveBase, reserve: new BigNumber(0) })
    ).toEqual(unstated);
    expect(
      getMaxGasReserveNote({ ...reserveBase, maximum: new BigNumber(1) })
    ).toEqual(unstated);
  });

  it("says nothing for a token that does not pay the gas, or without a balance", () => {
    expect(
      getMaxGasReserveNote({ ...reserveBase, stakeToken: usdc })
    ).toBeNull();
    expect(
      getMaxGasReserveNote({ ...reserveBase, availableAmount: null })
    ).toBeNull();
  });
});

describe("Yield Entry simulations", () => {
  const amountOf = (command: ActionCommand | null) =>
    command?.arguments?.amount;

  it("simulates the typed amount, and the whole gas token balance for Max", () => {
    const simulations = getYieldEntrySimulations(entryInput({ amount: "1.5" }));

    expect(amountOf(simulations.fee)).toBe("1.5");
    expect(amountOf(simulations.reserve)).toBe("2");
    expect(simulations.reserve?.arguments?.useMaxAmount).toBeUndefined();
  });

  it("simulates only the reserve before an amount is typed or past the balance", () => {
    expect(getYieldEntrySimulations(entryInput()).fee).toBeNull();
    expect(
      getYieldEntrySimulations(entryInput({ amount: "3" })).fee
    ).toBeNull();
    expect(
      amountOf(getYieldEntrySimulations(entryInput({ amount: "3" })).reserve)
    ).toBe("2");
  });

  it("has no reserve to simulate for a token that does not pay the gas", () => {
    const simulations = getYieldEntrySimulations(
      entryInput({
        amount: "10",
        availableAmount: new BigNumber(50),
        token: usdc,
      })
    );

    expect(amountOf(simulations.fee)).toBe("10");
    expect(simulations.reserve).toBeNull();
  });

  it("simulates nothing without a connected wallet", () => {
    expect(
      getYieldEntrySimulations(entryInput({ amount: "1", connected: false }))
    ).toEqual({ fee: null, reserve: null });
  });

  it("simulates nothing for a confidential vault, which takes the amount encrypted", () => {
    const vault = confidentialYieldFixture();
    expect(
      getYieldEntrySimulations(
        entryInput({
          amount: "1",
          availableAmount: null,
          token: vault.inputTokens[0]!,
          yieldDto: vault,
        })
      )
    ).toEqual({ fee: null, reserve: null });
  });

  it("simulates nothing the yield's limits refuse, and Max's reserve within them", () => {
    const limited = yieldWithEnterLimits({ maximum: "1.5", minimum: "1" });
    const simulate = (amount: string, availableAmount = new BigNumber(2)) =>
      getYieldEntrySimulations(
        entryInput({ amount, availableAmount, yieldDto: limited })
      );

    expect(simulate("0.5").fee).toBeNull();
    expect(simulate("1.6").fee).toBeNull();
    expect(amountOf(simulate("1.2").fee)).toBe("1.2");
    // Max draws on the yield's maximum, not the whole balance.
    expect(amountOf(simulate("1.2").reserve)).toBe("1.5");
    // A balance under the minimum leaves Max nothing to draw on.
    expect(simulate("0", new BigNumber("0.5")).reserve).toBeNull();
  });
});

describe("Enter input token", () => {
  const native: Token = {
    decimals: 18,
    name: "Ethereum",
    network: "ethereum",
    symbol: "ETH",
  };

  it("sends the native token placeholder when the selected token has no address", () => {
    expect(
      projectYieldEntry({
        input: entryInput({ amount: "1", token: native }),
        submitted: false,
      }).preparation?.command.arguments?.inputToken
    ).toBe("0x");
  });

  it("sends the token address when the selected token has one", () => {
    const eEth: Token = {
      address: Schema.decodeSync(TokenAddress)(
        "0x35fA164735182de50811E8e2E824cFb9B6118ac2"
      ),
      decimals: 18,
      name: "ether.fi ETH",
      network: "ethereum",
      symbol: "eETH",
    };

    expect(
      projectYieldEntry({
        input: entryInput({ amount: "1", token: eEth }),
        submitted: false,
      }).preparation?.command.arguments?.inputToken
    ).toBe("0x35fA164735182de50811E8e2E824cFb9B6118ac2");
  });

  it("flags a positive amount when the scanned balance is zero", () => {
    expect(
      projectYieldEntry({
        input: entryInput({
          amount: "1",
          availableAmount: new BigNumber(0),
          token: native,
        }),
        submitted: false,
      }).validation.errors.stakeAmountGreaterThanAvailableAmount
    ).toBe(true);
  });
});

describe("Yield entry balance warning", () => {
  /** The Earn form before the user typed anything: no amount, not validated. */
  const projectUntyped = ({
    availableAmount,
    minimum = "1",
  }: {
    readonly availableAmount: BigNumber;
    readonly minimum?: string;
  }) => {
    const yieldDto = yieldWithEnterLimits({ minimum });
    return projectYieldEntry({
      input: entryInput({ availableAmount, token: yieldDto.token, yieldDto }),
      submitted: false,
    });
  };

  it("flags a balance below the minimum before any amount is typed", () => {
    expect(
      projectUntyped({ availableAmount: new BigNumber("0.7689") })
        .balanceWarning
    ).toEqual({ _tag: "BelowMinimum", minimum: new BigNumber("1") });
  });

  it("flags an empty balance before any amount is typed", () => {
    expect(
      projectUntyped({ availableAmount: new BigNumber(0), minimum: "0" })
        .balanceWarning
    ).toEqual({ _tag: "NoBalance" });
  });

  it("disables the call to action as short of the token while the balance cannot fund an entry", () => {
    expect(
      projectUntyped({ availableAmount: new BigNumber("0.7689") }).cta
    ).toMatchObject({
      _tag: "Submit",
      blocker: "InsufficientBalance",
      disabled: true,
    });
  });
});

describe("Min", () => {
  const project = ({
    amount = "0",
    availableAmount = new BigNumber(100),
    maximum,
    minimum,
  }: {
    readonly amount?: string;
    readonly availableAmount?: BigNumber | null;
    readonly maximum?: string;
    readonly minimum: string;
  }) =>
    projectYieldEntry({
      input: entryInput({
        amount,
        availableAmount,
        token: usdc,
        yieldDto: yieldWithEnterLimits({
          ...(maximum === undefined ? {} : { maximum }),
          minimum,
        }),
      }),
      submitted: false,
    });

  it("fills the yield's minimum, rounded up to what the token can hold", () => {
    expect(project({ minimum: "0.0000002" }).minAmount?.toFixed()).toBe(
      "0.000001"
    );
    expect(project({ minimum: "1.5" }).minAmount?.toFixed()).toBe("1.5");
  });

  it("fills an amount the minimum accepts, where one below it is refused", () => {
    const minAmount = project({ minimum: "0.0000002" }).minAmount;
    const filled = project({
      amount: minAmount?.toFixed() ?? "",
      minimum: "0.0000002",
    });
    const below = project({ amount: "0.0000001", minimum: "0.0000002" });

    expect(filled.validation.errors.stakeAmountLessThanMin).toBe(false);
    expect(below.validation.errors.stakeAmountLessThanMin).toBe(true);
  });

  it("has nothing to fill without a minimum, or when the yield takes the whole balance", () => {
    expect(project({ minimum: "0" }).minAmount).toBeNull();
    expect(project({ maximum: "-1", minimum: "-1" }).minAmount).toBeNull();
    expect(project({ minimum: "0" }).canFillMin).toBe(false);
  });

  it("fills only a minimum the balance can fund, or one it cannot know", () => {
    expect(project({ minimum: "100000" }).canFillMin).toBe(false);
    expect(
      project({ availableAmount: new BigNumber(0), minimum: "1" }).canFillMin
    ).toBe(false);
    expect(project({ minimum: "1" }).canFillMin).toBe(true);
    // A hidden confidential balance may fund it.
    expect(
      project({ availableAmount: null, minimum: "100000" }).canFillMin
    ).toBe(true);
  });

  it("warns of the minimum it fills, not one finer than the token holds", () => {
    expect(
      project({
        availableAmount: new BigNumber("0.0000001"),
        minimum: "0.0000002",
      }).balanceWarning
    ).toEqual({ _tag: "BelowMinimum", minimum: new BigNumber("0.000001") });
  });

  it("stands for the minimum Min fills before an amount is typed, where the entry defaults to it", () => {
    const projected = projectYieldEntry({
      input: {
        ...entryInput({
          availableAmount: new BigNumber(100),
          token: usdc,
          yieldDto: yieldWithEnterLimits({ minimum: "0.0000002" }),
        }),
        amountInitialization: "DefaultToMinimum",
        validateAmount: true,
      },
      submitted: false,
    });

    expect(projected.amount.toFixed()).toBe("0.000001");
    expect(projected.validation.errors.stakeAmountLessThanMin).toBe(false);
  });
});

describe("Campaign Minimum notice", () => {
  // The fixture campaign runs on ETH staking, with a Campaign Minimum of 10.
  const runningCampaign = {
    campaign: Schema.decodeUnknownSync(YieldCampaign)(
      yieldApiCampaignDtoFixture()
    ),
    now: DateTime.makeUnsafe("2026-12-14T00:00:00.000Z"),
  };
  const counted = (held: number) =>
    ({
      _tag: "Counted",
      held: new BigNumber(held),
    }) as const;
  const notice = ({
    amount,
    campaign = runningCampaign,
    standing = counted(0),
    token = eth,
  }: {
    readonly amount: string;
    readonly campaign?: typeof runningCampaign;
    readonly standing?: WalletCampaignStanding;
    readonly token?: Token;
  }) =>
    projectYieldEntry({
      input: {
        ...entryInput({ amount, availableAmount: new BigNumber(100), token }),
        campaign,
        campaignStanding: standing,
      },
      submitted: false,
    }).campaignNotice;

  it("says how much more an amount short of the Campaign Minimum needs", () => {
    expect(notice({ amount: "4" })).toEqual({
      _tag: "BelowCampaignMinimum",
      minimum: new BigNumber(10),
      shortfall: new BigNumber(6),
      token: eth,
    });
  });

  it("counts what the wallet already holds toward the Campaign Minimum", () => {
    expect(notice({ amount: "4", standing: counted(3.5) })).toMatchObject({
      shortfall: new BigNumber(2.5),
    });
    expect(notice({ amount: "4", standing: counted(6) })).toBeNull();
  });

  it("says nothing before an amount is typed, or once it is enough", () => {
    expect(notice({ amount: "0" })).toBeNull();
    expect(notice({ amount: "10" })).toBeNull();
  });

  it("says nothing while what the wallet counts is unknown", () => {
    expect(notice({ amount: "4", standing: { _tag: "Unknown" } })).toBeNull();
  });

  it("says a wallet the campaign excludes can't earn it, whatever the amount", () => {
    const excluded = { _tag: "NotEligible" } as const;
    expect(notice({ amount: "4", standing: excluded })).toEqual({
      _tag: "NotEligible",
    });
    expect(notice({ amount: "0", standing: excluded })).toEqual({
      _tag: "NotEligible",
    });
  });

  it("says nothing while the campaign isn't earning", () => {
    const upcoming = {
      ...runningCampaign,
      now: DateTime.makeUnsafe("2026-11-01T00:00:00.000Z"),
    };
    const paused = {
      ...runningCampaign,
      campaign: { ...runningCampaign.campaign, status: "paused" as const },
    };
    expect(notice({ amount: "4", campaign: upcoming })).toBeNull();
    expect(notice({ amount: "4", campaign: paused })).toBeNull();
  });

  it("says nothing for a token other than the one the Campaign Minimum counts", () => {
    expect(notice({ amount: "4", token: usdc })).toBeNull();
  });
});
