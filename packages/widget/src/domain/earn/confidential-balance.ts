import type BigNumber from "bignumber.js";
import { Data, type HashMap, Option, Schema, Struct } from "effect";
import type { YieldAction } from "../action/models";
import type { YieldPendingActionType } from "../action/pending-action";
import { fromBaseUnits, toBaseUnits } from "../finance/base-units";
import { exactDecimal, truncateToTokenDecimals } from "../finance/exact";
import { TokenAddress, WalletAddress } from "../identity/identifiers";
import type { Network } from "../network/network";
import type { Token } from "../token/token";
import type { WalletScopeOwner } from "../wallet/wallet-scope";
import {
  type BalanceShares,
  ConfidentialHandle,
  type EarnBalance,
  type EarnBalanceShares,
  getEncryptedHandle,
} from "./balance";
import {
  type ConfidentialChainId,
  getConfidentialChainId,
  getConfidentialHandleContract,
} from "./confidential";
import type { EarnYieldWithProvider } from "./yield-schema";

/** A token balance its owner revealed; EVM addresses compare lowercased. */
export class ConfidentialTokenBalanceKey extends Data.Class<{
  readonly network: Network;
  readonly owner: WalletAddress;
  readonly token: TokenAddress | null;
}> {
  constructor({
    owner,
    token,
  }: {
    readonly owner: WalletAddress;
    readonly token: Token;
  }) {
    // Lowercasing a non-empty address keeps it non-empty, so `make` cannot throw.
    super({
      network: token.network,
      owner: WalletAddress.make(owner.toLowerCase()),
      token: token.address
        ? TokenAddress.make(token.address.toLowerCase())
        : null,
    });
  }

  isOwnedBy(owner: WalletScopeOwner) {
    return (
      this.network === owner.network &&
      this.owner === owner.address.toLowerCase()
    );
  }
}

/**
 * Revealed balances, held in memory only: position balances by the handle the
 * API returned, wallet token balances by owner and token.
 */
export type RevealedBalances = Readonly<{
  readonly handles: ReadonlyMap<ConfidentialHandle, bigint>;
  readonly tokenBalances: HashMap.HashMap<ConfidentialTokenBalanceKey, bigint>;
}>;

const decodeHandle = (value: string | null | undefined) =>
  value
    ? Option.getOrNull(Schema.decodeOption(ConfidentialHandle)(value))
    : null;

/**
 * Whether a balance's pending position, hidden or revealed, has a cancel in
 * flight.
 */
export const isCancellingBalance = (
  balance: BalanceShares,
  cancellingHandles: ReadonlySet<ConfidentialHandle>
): boolean =>
  (balance.shares?._tag === "Encrypted" ||
    balance.shares?._tag === "Revealed") &&
  cancellingHandles.has(balance.shares.handle);

/**
 * Pending positions with a cancel broadcast but not yet confirmed; the cancel
 * carries the position's handle as its encrypted amount.
 */
export const getCancellingHandles = (
  actions: ReadonlyArray<
    Pick<YieldAction, "encryptedAmount" | "status" | "type">
  >
): ReadonlySet<ConfidentialHandle> =>
  new Set(
    actions.flatMap((action) => {
      const handle =
        action.type === "CANCEL_PENDING" && action.status === "PROCESSING"
          ? decodeHandle(action.encryptedAmount)
          : null;
      return handle ? [handle] : [];
    })
  );

type ConfidentialBalance = Readonly<{
  readonly amount: BigNumber;
  readonly amountRaw: bigint;
  readonly amountUsd?: BigNumber | null;
  readonly isEncrypted?: boolean;
  readonly shares?: EarnBalanceShares;
  readonly shareToken?: Pick<Token, "address" | "decimals">;
  readonly token: Pick<Token, "decimals">;
}>;

const getConfidentialPricePerShare = (
  yieldDto: EarnYieldWithProvider,
  shareToken: Pick<Token, "address">
): BigNumber => {
  const state = yieldDto.state?.pricePerShareState;
  return state?.price.isGreaterThan(0) &&
    state.shareToken.address &&
    shareToken.address &&
    state.shareToken.address.toLowerCase() === shareToken.address.toLowerCase()
    ? state.price
    : exactDecimal(1);
};

export type ConfidentialValuation = Readonly<{
  readonly yieldDto: EarnYieldWithProvider;
  readonly usdPrice: BigNumber | null;
}>;

type RevealedHandles = RevealedBalances["handles"];

const isRevealedBalance = (
  balance: ConfidentialBalance,
  handles: RevealedHandles
) => {
  const handle = getEncryptedHandle(balance);
  return handle !== null && handles.has(handle);
};

export const hasRevealedBalance = (
  position: Readonly<{ readonly balances: ReadonlyArray<ConfidentialBalance> }>,
  handles: RevealedHandles
) => position.balances.some((balance) => isRevealedBalance(balance, handles));

// Withdrawable unwraps are publicly decrypted by WITHDRAW, not revealed.
export const isUserRevealableBalance = (
  balance: Pick<EarnBalance, "isEncrypted" | "type">
) => !!balance.isEncrypted && balance.type !== "withdrawable";

/**
 * An Instant Exit its unwrap began, still to finalize: an encrypted
 * withdrawable balance's WITHDRAW, which decrypts the unwrapped amount.
 */
export const isUnfinishedInstantExit = (
  balance: Pick<EarnBalance, "isEncrypted" | "type">,
  pendingActionType: YieldPendingActionType
) =>
  !!balance.isEncrypted &&
  balance.type === "withdrawable" &&
  pendingActionType === "WITHDRAW";

export const getPendingActionDecryptHandle = (
  balance: Pick<EarnBalance, "isEncrypted" | "shares" | "type">,
  pendingActionType: YieldPendingActionType
): ConfidentialHandle | null =>
  isUnfinishedInstantExit(balance, pendingActionType)
    ? getEncryptedHandle(balance)
    : null;

// The API sends empty amounts for encrypted balances; their shares are a handle.
export const zeroEncryptedBalance = <
  Balance extends Readonly<{ readonly isEncrypted?: boolean }>,
>(
  balance: Balance
): Balance =>
  balance.isEncrypted ? { ...balance, amount: "0", amountRaw: "0" } : balance;

/**
 * An encrypted balance after its handle is revealed: no longer encrypted,
 * valued from the decrypted share count, and still carrying the handle so a
 * cancel of its pending position stays recognisable.
 */
export type RevealedBalance<Balance extends ConfidentialBalance> = Omit<
  Balance,
  "amount" | "amountRaw" | "amountUsd" | "isEncrypted" | "shares"
> &
  Readonly<{
    readonly amount: BigNumber;
    readonly amountRaw: bigint;
    readonly amountUsd?: BigNumber | null;
    readonly shares: typeof EarnBalanceShares.cases.Revealed.Type;
  }>;

export const fillConfidentialBalance = <Balance extends ConfidentialBalance>(
  balance: Balance,
  handles: RevealedHandles,
  valuation: ConfidentialValuation | null = null
): Balance | RevealedBalance<Balance> => {
  const handle = getEncryptedHandle(balance);
  if (handle === null) return balance;
  const revealed = handles.get(handle);
  if (revealed === undefined) return balance;

  const shareDecimals = balance.shareToken?.decimals ?? balance.token.decimals;
  const shareAmount = fromBaseUnits(revealed, shareDecimals);
  const pricePerShare =
    valuation && balance.shareToken
      ? getConfidentialPricePerShare(valuation.yieldDto, balance.shareToken)
      : exactDecimal(1);
  const amount = truncateToTokenDecimals(
    shareAmount.times(pricePerShare),
    balance.token.decimals
  );
  const amountUsd = valuation?.usdPrice
    ? amount.times(valuation.usdPrice)
    : balance.amountUsd;
  return {
    ...Struct.omit(balance, [
      "amount",
      "amountRaw",
      "amountUsd",
      "isEncrypted",
      "shares",
    ]),
    amount,
    amountRaw: toBaseUnits(amount, balance.token.decimals, "truncate"),
    ...(amountUsd === undefined ? {} : { amountUsd }),
    shares: {
      _tag: "Revealed",
      amount: shareAmount,
      amountRaw: revealed,
      handle,
    },
  };
};

export const fillConfidentialPosition = <
  Balance extends ConfidentialBalance,
  Position extends Readonly<{ readonly balances: ReadonlyArray<Balance> }>,
>(
  position: Position,
  handles: RevealedHandles,
  valuation: ConfidentialValuation | null = null
) => ({
  ...position,
  balances: position.balances.map((balance) =>
    fillConfidentialBalance(balance, handles, valuation)
  ),
});

/** A balance whose shares the user revealed this session. */
export const isRevealedConfidentialBalance = (balance: BalanceShares) =>
  balance.shares?._tag === "Revealed";

export type ConfidentialRevealPosition = Readonly<{
  readonly balances: ReadonlyArray<
    Pick<EarnBalance, "isEncrypted" | "shares" | "shareToken" | "type">
  >;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type ConfidentialRevealRequest = Readonly<{
  readonly chainId: ConfidentialChainId;
  readonly handles: ReadonlyArray<
    Readonly<{ readonly contract: string; readonly handle: ConfidentialHandle }>
  >;
}>;

/**
 * The user-revealable handles of positions: one request per chain, each
 * handle once.
 */
export const getConfidentialRevealRequests = (
  positions: ReadonlyArray<ConfidentialRevealPosition>
): ReadonlyArray<ConfidentialRevealRequest> => {
  const byChain = new Map<
    ConfidentialChainId,
    Map<ConfidentialHandle, string>
  >();
  for (const { balances, yieldDto } of positions) {
    const chainId = getConfidentialChainId(yieldDto);
    if (chainId === null) continue;
    const handles = byChain.get(chainId) ?? new Map();
    for (const balance of balances) {
      if (!isUserRevealableBalance(balance)) continue;
      const contract = getConfidentialHandleContract(yieldDto, balance);
      const handle = getEncryptedHandle(balance);
      if (handle && contract) handles.set(handle, contract);
    }
    if (handles.size > 0) byChain.set(chainId, handles);
  }
  return [...byChain].map(([chainId, handles]) => ({
    chainId,
    handles: [...handles].map(([handle, contract]) => ({ contract, handle })),
  }));
};
