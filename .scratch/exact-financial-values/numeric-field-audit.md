# Remaining numeric field classification

Status: current as of the exact-financial-values contraction.

This audit classifies remaining JavaScript `number` uses after Exact Token Amount (`BigNumber`) and Base Unit Amount (`bigint`) migration. Fields listed as `number` are allowed to stay numbers. They must not become Entry Intent, eligibility, Action Command, persistence, or transaction inputs unless noted as public serialization of a display-only rate.

## Stay `number`

- Counts and indexes: pagination `limit`/`offset`/`total`, validator `nominatorCount`, Tron Ledger `voteCount`, transaction `nonce`/`type`, step indexes.
- Chain IDs: Borrow `Transaction.chainId`, EVM unsigned `chainId`.
- Non-financial enumerations and flags.
- Wire JSON numbers that cannot become transaction inputs: reward-rate DTO totals, legacy display prices, bps that the API already encodes as numbers.
- Public `ActionMeta.providersDetails.rewardRate`: locale-independent numeric serialization of a display-only rate, converted at workflow-to-public mapping.
- Chart points: `HistoryPoint.value` after `toChartNumber` in earn-details chart adapters.
- Display-only percentages used as CSS or animation inputs (`LtvGauge`, yield percent tween) via `toChartNumber`.

## Stay `BigNumber`

- Token amounts, balances, limits, fees, USD values, protocol ratios (LTV, health factor, price per share), Pending Action min/max, TVL and reward-rate history items before the chart adapter, Earn `rewardRate.total` in domain models.

## Stay `bigint`

- `amountRaw` and other Base Unit Amounts, EVM gas/value/fee quantities, Borrow wallet `gasLimit`/`value`.

## Confirmed not remaining as execution `number`

- Generated clients keep native JSON parsing; execution-relevant API amounts stay quoted strings.
- `.toNumber()` exists only in `shared/lib/formatters.ts` and `shared/lib/number-format.ts`.
