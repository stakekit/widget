import type BigNumber from "bignumber.js";
import type { ManageActionCommand, PendingAction } from "../action/models";
import { exactDecimal, exactZero } from "../finance/exact";
import {
  equalTokens,
  sameTokenContract,
  type Token,
  type TokenString,
  tokenString,
} from "../token/token";
import {
  type BalanceShares,
  type EarnBalance,
  type EarnBalanceShares,
  type EarnYieldWithProvider,
  getEncryptedHandle,
  getVisibleShares,
} from "./models";
import { getYieldActionArg } from "./yield";

/**
 * Every number is labelled with the token of the field it came from: a
 * balance's `amount` with its Value Token, its Shares with its share token.
 */
export type TokenAmount = Readonly<{
  readonly amount: BigNumber;
  readonly token: Token;
}>;

type SharesSource = BalanceShares &
  Readonly<{
    readonly shareToken?: Token;
    readonly token: Token;
  }>;

/** A balance's share token, when it is not the Value Token itself. */
const getShareToken = (balance: SharesSource) =>
  balance.shareToken && !equalTokens(balance.shareToken, balance.token)
    ? balance.shareToken
    : null;

/** The visible share count, from its decimal amount or its base units. */
const getVisibleShareAmount = (
  balance: BalanceShares,
  shareToken: Token
): BigNumber | null => {
  const shares = getVisibleShares(balance);
  if (shares?.amount) return shares.amount;
  return shares?.amountRaw === undefined
    ? null
    : exactDecimal(shares.amountRaw.toString()).shiftedBy(-shareToken.decimals);
};

/**
 * A balance's Shares, shown beside its Value: its visible share count. Null
 * when its share token is the Value Token itself or the count is hidden.
 */
export const getBalanceShares = (balance: SharesSource): TokenAmount | null => {
  const token = getShareToken(balance);
  const amount = token ? getVisibleShareAmount(balance, token) : null;
  return token && amount ? { amount, token } : null;
};

/** The unit an exit amount is typed and submitted in. */
export type ExitUnit = "shares" | "value";

/**
 * An exit the widget submits in Shares: no plain amount, only encrypted share
 * legs. A plain `shareAmount`-only contract stays in the Value, since the
 * widget does not build that request; ERC-4626 vaults take `amount` beside an
 * optional `shareAmount` and stay in the Value too.
 */
const takesOnlyShares = (yieldDto: EarnYieldWithProvider) =>
  getYieldActionArg(yieldDto, "exit", "amount") === null &&
  getYieldActionArg(yieldDto, "exit", "amountRaw") === null &&
  getYieldActionArg(yieldDto, "exit", "encryptedLegAmounts") !== null;

/**
 * The Exit Unit: Shares when the exit takes only Shares and every active
 * balance holds a share token, otherwise the Value.
 */
export const getExitUnit = (
  yieldDto: EarnYieldWithProvider,
  activeBalances: ReadonlyArray<Readonly<{ readonly shareToken?: Token }>>
): ExitUnit =>
  takesOnlyShares(yieldDto) &&
  activeBalances.length > 0 &&
  activeBalances.every((balance) => balance.shareToken !== undefined)
    ? "shares"
    : "value";

/**
 * The token an exit action's amount is in when no balances are at hand: the
 * yield's output token when the exit takes only Shares, else its Value Token.
 */
export const getExitAmountToken = (yieldDto: EarnYieldWithProvider): Token =>
  takesOnlyShares(yieldDto)
    ? (yieldDto.outputToken ?? yieldDto.token)
    : yieldDto.token;

type SharesExitSource = Readonly<{
  readonly amount: BigNumber;
  readonly amountUsd?: BigNumber | null;
  readonly shares?: EarnBalanceShares;
  readonly shareToken?: Token;
  readonly token: Token;
}>;

export type SharesExitBalance = TokenAmount &
  Readonly<{
    readonly amountUsd: BigNumber;
    /** The same balance in the Value Token. */
    readonly value: TokenAmount;
  }>;

/**
 * An exit in Shares: the visible share count, zero while hidden, which
 * the API sends empty. Null when the active balances hold different share
 * tokens or Value Tokens.
 */
export const getSharesExitBalance = (
  activeBalances: ReadonlyArray<SharesExitSource>
): SharesExitBalance | null => {
  const [first] = activeBalances;
  const shareToken = first?.shareToken;
  if (
    !first ||
    !shareToken ||
    activeBalances.some(
      (balance) =>
        !balance.shareToken ||
        !sameTokenContract(balance.shareToken, shareToken) ||
        !sameTokenContract(balance.token, first.token)
    )
  ) {
    return null;
  }
  return activeBalances.reduce<SharesExitBalance>(
    (sum, balance) => ({
      amount: sum.amount.plus(getVisibleShares(balance)?.amount ?? exactZero()),
      amountUsd: sum.amountUsd.plus(balance.amountUsd ?? 0),
      token: shareToken,
      value: {
        amount: sum.value.amount.plus(balance.amount),
        token: first.token,
      },
    }),
    {
      amount: exactDecimal(0),
      amountUsd: exactDecimal(0),
      token: shareToken,
      value: { amount: exactDecimal(0), token: first.token },
    }
  );
};

/**
 * What a pending action returns when it differs from the balance's Value: a
 * cancel returns what was committed, its Shares, which count zero while
 * encrypted. Every other pending action pays the Value Token, so it is null.
 */
export const getPendingActionReturn = (
  pendingActionType: PendingAction["type"] | ManageActionCommand["action"],
  balance: SharesSource
): TokenAmount | null => {
  const token = getShareToken(balance);
  if (pendingActionType !== "CANCEL_PENDING" || !token) return null;
  const amount =
    getVisibleShareAmount(balance, token) ??
    (balance.shares?._tag === "Encrypted" ? exactZero() : null);
  return amount ? { amount, token } : null;
};

export type PositionShares =
  | Readonly<{ readonly _tag: "Hidden" }>
  | Readonly<{
      readonly _tag: "Visible";
      /** One sum per share token. */
      readonly groups: ReadonlyArray<TokenAmount>;
      /** What the balances carrying Shares are worth, when all are priced. */
      readonly amountUsd: BigNumber | null;
    }>;

type PositionSharesSource = SharesSource &
  Readonly<{
    readonly amount: BigNumber;
    readonly amountUsd?: BigNumber | null;
    readonly type: EarnBalance["type"];
  }>;

/**
 * A position's Shares, one sum per share token. Null when no balance has
 * Shares; hidden while Shares are still encrypted. Points and unclaimed
 * rewards are left out.
 */
export const getPositionShares = (
  balances: ReadonlyArray<PositionSharesSource>
): PositionShares | null => {
  const held = balances.filter(
    (balance) => !balance.token.isPoints && balance.type !== "claimable"
  );
  if (
    held.some(
      (balance) =>
        getEncryptedHandle(balance) !== null && getShareToken(balance)
    )
  ) {
    return { _tag: "Hidden" };
  }
  const carriers = held.flatMap((balance) => {
    const shares = getBalanceShares(balance);
    return shares ? [{ amountUsd: balance.amountUsd, shares }] : [];
  });
  if (carriers.length === 0) return null;

  const groups = carriers.reduce((sums, { shares }) => {
    const key = tokenString(shares.token);
    const previous = sums.get(key);
    sums.set(key, {
      amount: (previous?.amount ?? exactZero()).plus(shares.amount),
      token: previous?.token ?? shares.token,
    });
    return sums;
  }, new Map<TokenString, TokenAmount>());
  const priced = carriers.every(({ amountUsd }) => amountUsd?.isGreaterThan(0));

  return {
    _tag: "Visible",
    groups: [...groups.values()],
    amountUsd: priced
      ? carriers.reduce(
          (total, { amountUsd }) => total.plus(amountUsd ?? 0),
          exactZero()
        )
      : null,
  };
};
