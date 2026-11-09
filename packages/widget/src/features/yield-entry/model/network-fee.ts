import type BigNumber from "bignumber.js";
import type { ActionSimulation } from "../../../domain/action/models";
import { stakeTokenSameAsGasToken } from "../../../domain/earn/stake";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactZero } from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import type { Prices } from "../../../domain/health/models";
import type { Token } from "../../../domain/token/token";

/** What an amount's action is estimated to cost the network, in its gas token. */
type NetworkFeeEstimate = Readonly<{
  readonly amount: BigNumber;
  readonly token: Token;
  /** Null without a price for the gas token. */
  readonly usd: BigNumber | null;
}>;

/**
 * The network fee line under an amount, held in place whenever a fee can
 * apply so the layout below never moves as the amount changes: the
 * estimate once it settles, `Pending` while one loads, and `Unknown` (said
 * as "—") without an amount to estimate or when the network did not price
 * it.
 */
export type NetworkFeeNote =
  | Readonly<{ readonly _tag: "Estimate"; readonly fee: NetworkFeeEstimate }>
  | Readonly<{ readonly _tag: "Pending" }>
  | Readonly<{ readonly _tag: "Unknown" }>;

/**
 * The fee line to hold under an amount; null, with no line at all, when no
 * fee can apply: the host hides gas fees, or no wallet is connected. An
 * action the network did not price, or prices at nothing, has none to state.
 */
export const getNetworkFeeEstimate = ({
  connected,
  hidden,
  pending,
  prices,
  simulation,
}: {
  readonly connected: boolean;
  readonly hidden: boolean;
  /** The amount's estimate is loading, with none settled yet. */
  readonly pending: boolean;
  readonly prices: Prices | null;
  readonly simulation: ActionSimulation | null;
}): NetworkFeeNote | null => {
  if (hidden || !connected) return null;
  if (!simulation) return pending ? { _tag: "Pending" } : { _tag: "Unknown" };
  const { amount, token } = simulation.gas;
  if (!amount?.isGreaterThan(0)) return { _tag: "Unknown" };

  const usd = prices
    ? getTokenPriceInUSD({
        amount,
        baseToken: null,
        pricePerShare: null,
        prices,
        token,
      })
    : null;
  return {
    _tag: "Estimate",
    fee: { amount, token, usd: usd?.isGreaterThan(0) ? usd : null },
  };
};

/**
 * What Max keeps aside of the balance: nothing unless the stake token pays
 * the gas; then the API's entry reserve where it gives one, which already
 * covers the gas, else the estimated gas. Null while that is unknown, when
 * Max cannot know how much to leave.
 */
export const getMaxGasReserve = ({
  simulation,
  stakeToken,
  yieldDto,
}: {
  readonly simulation: ActionSimulation | null;
  readonly stakeToken: Token | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): BigNumber | null => {
  if (
    !stakeToken ||
    !yieldDto ||
    !stakeTokenSameAsGasToken({ stakeToken, yieldDto })
  ) {
    return exactZero();
  }
  return simulation?.entryReserveEstimate ?? simulation?.gas.amount ?? null;
};

/**
 * Said under the amount while the stake token pays the gas: what Max leaves
 * aside for it, `Pending` until that reserve is known, or `Unstated`, its
 * amount unsaid ("Max leaves some ETH for network fees"), when there is no
 * amount to state.
 */
export type MaxGasReserveNote =
  | Readonly<{
      readonly _tag: "Reserve";
      readonly amount: BigNumber;
      readonly token: Token;
    }>
  | Readonly<{ readonly _tag: "Pending"; readonly token: Token }>
  | Readonly<{ readonly _tag: "Unstated"; readonly token: Token }>;

/**
 * The Max reserve line, held whether or not Max filled the amount so typing
 * never moves the layout: only for a balance in the gas token Max must
 * leave some of. Once held, it stays through every settled state, so the
 * layout never moves as the reserve settles: its amount is unsaid when the
 * host hides gas fees, when the reserve settled unknown or at nothing, and
 * when a yield's own maximum, not the reserve, holds Max under the balance.
 * The reserve is keyed by the balance, so the line only comes or goes as
 * the balance or the yield changes.
 */
export const getMaxGasReserveNote = ({
  availableAmount,
  hidden,
  maximum,
  reserve,
  reservePending,
  stakeToken,
  yieldDto,
}: {
  readonly availableAmount: BigNumber | null;
  readonly hidden: boolean;
  /** The yield's own maximum, if it has one. */
  readonly maximum: BigNumber | null;
  /** See `getMaxGasReserve`; null while unknown. */
  readonly reserve: BigNumber | null;
  /** The reserve's estimate is loading, with none settled yet. */
  readonly reservePending: boolean;
  readonly stakeToken: Token | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}): MaxGasReserveNote | null => {
  if (!stakeToken || !yieldDto || !availableAmount) return null;
  if (!stakeTokenSameAsGasToken({ stakeToken, yieldDto })) return null;
  const unstated = { _tag: "Unstated", token: stakeToken } as const;
  if (hidden) return unstated;
  if (reserve === null) {
    return reservePending ? { _tag: "Pending", token: stakeToken } : unstated;
  }
  if (!reserve.isGreaterThan(0)) return unstated;
  if (maximum?.isLessThan(availableAmount.minus(reserve))) return unstated;
  return { _tag: "Reserve", amount: reserve, token: stakeToken };
};
