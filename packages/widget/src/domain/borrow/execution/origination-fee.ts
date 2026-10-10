import type BigNumber from "bignumber.js";
import { exactDecimal } from "../../finance/exact";
import type { Market } from "../catalog/market";

const BPS = 10_000n;
const WAD = 10n ** 18n;

/**
 * How a borrow opens debt. BlueBundle wins whenever the market advertises it,
 * even for a plain borrow, and supplies the full collateral. The allocator
 * wrapper applies only without BlueBundle and may skim a collateral supply fee.
 */
type BorrowOriginationRoute = "Allocator" | "BlueBundle" | "None";

export type BorrowOrigination = {
  readonly feeAmount: BigNumber;
  readonly feeBps: number;
  /** Debt principal opened on-chain; the requested amount is what the user receives. */
  readonly grossAmount: BigNumber;
  readonly route: BorrowOriginationRoute;
};

type OriginationMarket = Pick<
  Market,
  | "blueBundleOriginationFeeBps"
  | "loanToken"
  | "originationFeeBps"
  | "originationFeeWrapperAddress"
>;

type RawOrigination = {
  readonly feeRaw: bigint;
  readonly grossRaw: bigint;
};

// T = floor(N*f/BPS); G = N + T; R = floor(T*WAD/G); F = floor(G*R/WAD)
const blueBundleOrigination = (
  netRaw: bigint,
  feeBps: bigint
): RawOrigination => {
  const targetFeeRaw = (netRaw * feeBps) / BPS;
  const grossRaw = netRaw + targetFeeRaw;
  const rateWad = targetFeeRaw === 0n ? 0n : (targetFeeRaw * WAD) / grossRaw;

  return { feeRaw: (grossRaw * rateWad) / WAD, grossRaw };
};

// G = ceil(N*BPS/(BPS-f)); F = floor(G*f/BPS)
const allocatorOrigination = (
  netRaw: bigint,
  feeBps: bigint
): RawOrigination => {
  const netOfFee = BPS - feeBps;
  const grossRaw = (netRaw * BPS + netOfFee - 1n) / netOfFee;

  return { feeRaw: (grossRaw * feeBps) / BPS, grossRaw };
};

const resolveRoute = (
  market: OriginationMarket
): { readonly feeBps: number; readonly route: BorrowOriginationRoute } => {
  if (market.blueBundleOriginationFeeBps !== null) {
    return {
      feeBps: Math.max(market.blueBundleOriginationFeeBps, 0),
      route: "BlueBundle",
    };
  }
  if (
    market.originationFeeWrapperAddress !== null &&
    market.originationFeeBps > 0
  ) {
    return { feeBps: market.originationFeeBps, route: "Allocator" };
  }
  return { feeBps: 0, route: "None" };
};

/**
 * Estimates the origination fee the API charges on a requested net borrow,
 * mirroring its integer base-unit arithmetic. Per-market allocator overrides
 * are not published, so the allocator value is an estimate.
 */
export const resolveBorrowOrigination = ({
  market,
  netAmount,
}: {
  readonly market: OriginationMarket;
  readonly netAmount: BigNumber;
}): BorrowOrigination => {
  const { decimals } = market.loanToken;
  const { feeBps, route } = resolveRoute(market);
  const netRaw = BigInt(netAmount.shiftedBy(decimals).toFixed(0));
  const feeBpsRaw = BigInt(feeBps);
  const raw = (() => {
    if (feeBpsRaw === 0n) return { feeRaw: 0n, grossRaw: netRaw };
    return route === "BlueBundle"
      ? blueBundleOrigination(netRaw, feeBpsRaw)
      : allocatorOrigination(netRaw, feeBpsRaw);
  })();

  return {
    feeAmount: exactDecimal(raw.feeRaw.toString()).shiftedBy(-decimals),
    feeBps,
    grossAmount: exactDecimal(raw.grossRaw.toString()).shiftedBy(-decimals),
    route,
  };
};
