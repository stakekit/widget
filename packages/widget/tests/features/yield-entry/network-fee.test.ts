import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type {
  ActionCommand,
  ActionSimulation,
} from "../../../src/domain/action/models";
import { Prices } from "../../../src/domain/health/models";
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
    const base = yieldApiYieldDtoFixture();
    const limited = yieldApiYieldFixture({
      mechanics: {
        ...base.mechanics,
        arguments: {
          ...base.mechanics.arguments,
          enter: {
            fields: [
              {
                label: "Amount",
                maximum: "1.5",
                minimum: "1",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
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
