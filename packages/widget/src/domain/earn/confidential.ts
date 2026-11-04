import type BigNumber from "bignumber.js";
import { Data, type HashMap, Option, Schema, Struct } from "effect";
import type { YieldAction } from "../action/models";
import type { YieldPendingActionType } from "../action/pending-action";
import {
  exactDecimal,
  exactZero,
  truncateToTokenDecimals,
} from "../finance/exact";
import {
  type ContractAddress,
  TokenAddress,
  WalletAddress,
} from "../identity/identifiers";
import type { Network } from "../network/network";
import type { Token } from "../token/token";
import type { EvmChainIds } from "../wallet/chain-ids";
import { getWalletRoutingId } from "../wallet/network";
import type { WalletScopeOwner } from "../wallet/wallet-scope";
import {
  type BalanceShares,
  ConfidentialHandle,
  type EarnBalance,
  type EarnBalanceShares,
  type EarnYieldWithProvider,
  getEncryptedHandle,
  getVisibleShares,
} from "./models";
import { getYieldActionArg } from "./yield";

type ConfidentialIntent = "enter" | "exit";

type BalanceType = EarnBalance["type"];

/** The batch side a confidential request waits on. */
export type ConfidentialBatchSide = "redemption" | "subscription";

const confidentialNetworks = ["ethereum", "ethereum-sepolia"] as const;

/** The chain ids of the networks confidential vaults run on. */
export type ConfidentialChainId =
  | typeof EvmChainIds.Ethereum
  | typeof EvmChainIds.EthereumSepolia;

const getChainId = (network: Network): ConfidentialChainId | undefined => {
  const allowed = confidentialNetworks.find((item) => item === network);
  return allowed === undefined ? undefined : getWalletRoutingId(allowed);
};

export const getConfidentialNetwork = (chainId: number) =>
  confidentialNetworks.find(
    (network) => getWalletRoutingId(network) === chainId
  ) ?? null;

const sameAddress = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

// Symbols differ across lists (WBTC vs wBTC); compare contracts.
export const sameTokenContract = (
  a: Pick<Token, "address" | "network">,
  b: Pick<Token, "address" | "network">
) =>
  a.network === b.network &&
  !!a.address &&
  !!b.address &&
  sameAddress(a.address, b.address);

const isExecutionContract = (
  yieldDto: EarnYieldWithProvider,
  intent: ConfidentialIntent,
  address: ContractAddress | TokenAddress
) =>
  (yieldDto.executionContracts?.[intent] ?? []).some((contract) =>
    sameAddress(contract, address)
  );

const getConfidentialLegs = (
  yieldDto: EarnYieldWithProvider,
  intent: ConfidentialIntent
) => {
  const legs = getYieldActionArg(
    yieldDto,
    intent,
    "encryptedLegAmounts"
  )?.options;
  const chainId = getChainId(yieldDto.network);
  if (!legs || chainId === undefined) return null;

  const ownIndex = legs.findIndex((leg) =>
    isExecutionContract(yieldDto, intent, leg)
  );
  const tokens = [...yieldDto.inputTokens, ...yieldDto.tokens];
  const router = (yieldDto.executionContracts?.enter ?? []).find(
    (contract) =>
      !legs.some((leg) => sameAddress(leg, contract)) &&
      !tokens.some(
        (token) => token.address && sameAddress(token.address, contract)
      )
  );
  return ownIndex === -1 || !router
    ? null
    : { chainId, legs, ownIndex, router };
};

export const isConfidentialYield = (yieldDto: EarnYieldWithProvider) =>
  getConfidentialLegs(yieldDto, "enter") !== null;

/**
 * A private exit redeems through the router, which must be an operator on
 * every redeem leg's share token: the exit contracts beside it and the legs.
 */
export const getConfidentialRedeemOperators = (
  yieldDto: EarnYieldWithProvider
) => {
  const legs = getConfidentialLegs(yieldDto, "exit");
  if (!legs) return null;
  const tokens = (yieldDto.executionContracts?.exit ?? []).filter(
    (contract) =>
      !sameAddress(contract, legs.router) &&
      !legs.legs.some((leg) => sameAddress(leg, contract))
  );
  return { chainId: legs.chainId, operator: legs.router, tokens } as const;
};

const zamaCampaignUrl = (vault: string, slug: string) =>
  `https://app.zama.org/earn/ethereum/${vault}/${slug}`;

// Zama's campaign pages, where holders enable delegation for extra incentives.
const confidentialCampaignUrls: Record<string, string> = {
  "ethereum-usdc-zama-steakhouse-usdc-confidential-vault": zamaCampaignUrl(
    "0xbEEF00A59B577423653A1526c7009bdE103F542B",
    "steakhouse-confidential-prime-usdc"
  ),
  "ethereum-usdt-zama-flowdesk-usdt-high-yield-confidential-vault":
    zamaCampaignUrl(
      "0xb48C056C5608bA2Ee4cD94AF2bF4b1F25295Bd7e",
      "flowdesk-usdt-high-yield"
    ),
  "ethereum-usdc-zama-rockawayx-usdc-rwa-confidential-vault": zamaCampaignUrl(
    "0xc207d3f66537D7F66456808379A0E560cF20Da36",
    "rockawayx-usdc-rwa"
  ),
  "ethereum-usdt-zama-steakhouse-usdt-prime-confidential-vault":
    zamaCampaignUrl(
      "0xbeef003C68896c7D2c3c60d363e8d71a49Ab2bf9",
      "steakhouse-usdt-prime"
    ),
  "ethereum-wbtc-zama-wintermute-wbtc-confidential-vault": zamaCampaignUrl(
    "0x3d5EcCb62974178236A768A7ef14D3ce468Fbe91",
    "confidential-wintermute-wbtc"
  ),
  "ethereum-ausd-zama-bitwise-ausd-rwa-confidential-vault": zamaCampaignUrl(
    "0xB344e331A3cDa61D329fb3Cca2Be5942da87c418",
    "bitwise-ausd-premium-rwa"
  ),
};

export const getConfidentialCampaignUrl = (yieldDto: EarnYieldWithProvider) =>
  confidentialCampaignUrls[yieldDto.id] ?? null;

export const getConfidentialChainId = (yieldDto: EarnYieldWithProvider) =>
  isConfidentialYield(yieldDto) ? (getChainId(yieldDto.network) ?? null) : null;

export const getConfidentialAssetToken = (
  yieldDto: EarnYieldWithProvider
): Token | null =>
  isConfidentialYield(yieldDto)
    ? ([...yieldDto.inputTokens, ...yieldDto.tokens].find(
        (token) =>
          token.address !== undefined &&
          isExecutionContract(yieldDto, "enter", token.address)
      ) ?? null)
    : null;

export type ConfidentialConversion = Readonly<{
  readonly chainId: ConfidentialChainId;
  readonly underlying: string;
  readonly wrapper: string;
}>;

export const getConfidentialConversion = (
  yieldDto: EarnYieldWithProvider,
  token: Token
): ConfidentialConversion | null => {
  const asset = getConfidentialAssetToken(yieldDto);
  const chainId = getChainId(yieldDto.network);
  if (!asset?.address || !token.address || chainId === undefined) return null;
  return sameTokenContract(token, yieldDto.token)
    ? {
        chainId,
        underlying: token.address,
        wrapper: asset.address,
      }
    : null;
};

export type ConfidentialEncryptionPlan = Readonly<{
  readonly amount: Readonly<{
    readonly contract: string;
    readonly value: bigint;
  }> | null;
  readonly chainId: ConfidentialChainId;
  readonly legs: Readonly<{
    readonly contract: string;
    readonly values: ReadonlyArray<bigint>;
  }> | null;
}>;

export const isConfidentialInstantExit = (
  yieldDto: EarnYieldWithProvider,
  outputToken: string | undefined
) =>
  isConfidentialYield(yieldDto) &&
  outputToken !== undefined &&
  yieldDto.token.address !== undefined &&
  sameAddress(outputToken, yieldDto.token.address);

export const planConfidentialEncryption = ({
  instant = false,
  intent,
  value,
  yieldDto,
}: {
  readonly instant?: boolean;
  readonly intent: ConfidentialIntent;
  readonly value: bigint;
  readonly yieldDto: EarnYieldWithProvider;
}): ConfidentialEncryptionPlan | null => {
  if (instant) {
    const contract = getYieldActionArg(yieldDto, "exit", "encryptedAmount")
      ?.options[0];
    const chainId = getConfidentialChainId(yieldDto);
    return contract && chainId !== null
      ? { amount: { contract, value }, chainId, legs: null }
      : null;
  }
  const legs = getConfidentialLegs(yieldDto, intent);
  if (!legs) return null;
  const asset = getConfidentialAssetToken(yieldDto);
  if (intent === "enter" && !asset?.address) return null;

  return {
    amount:
      intent === "enter" && asset?.address
        ? { contract: asset.address, value }
        : null,
    chainId: legs.chainId,
    // Zero legs hide which vault was chosen.
    legs: {
      contract: legs.router,
      values: legs.legs.map((_, index) =>
        index === legs.ownIndex ? value : 0n
      ),
    },
  };
};

export type ConfidentialEncryption = Readonly<{
  readonly amount: Readonly<{
    readonly handle: ConfidentialHandle;
    readonly proof: string;
  }> | null;
  readonly legs: Readonly<{
    readonly handles: ReadonlyArray<ConfidentialHandle>;
    readonly proof: string;
  }> | null;
}>;

type PlainAmountArguments = {
  readonly amount?: string;
  readonly amountRaw?: string;
  readonly inputToken?: string;
  readonly shareAmount?: string;
  readonly shareAmountRaw?: string;
  readonly useMaxAmount?: boolean;
};

export const toConfidentialArguments = <Arguments extends PlainAmountArguments>(
  args: Arguments,
  encryption: ConfidentialEncryption,
  inputToken: string | null
) => ({
  ...Struct.omit(args, [
    "amount",
    "amountRaw",
    "inputToken",
    "shareAmount",
    "shareAmountRaw",
    "useMaxAmount",
  ]),
  ...(inputToken ? { inputToken } : {}),
  ...(encryption.amount
    ? {
        encryptedAmount: encryption.amount.handle,
        encryptedAmountProof: encryption.amount.proof,
      }
    : {}),
  ...(encryption.legs
    ? {
        encryptedLegAmounts: [...encryption.legs.handles],
        encryptedLegProof: encryption.legs.proof,
      }
    : {}),
});

export const toBaseUnits = (amount: BigNumber, decimals: number): bigint =>
  BigInt(
    truncateToTokenDecimals(amount, decimals).shiftedBy(decimals).toFixed(0)
  );

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
    sameAddress(state.shareToken.address, shareToken.address)
    ? state.price
    : exactDecimal(1);
};

/** What `shares` of a confidential vault are worth in its underlying token. */
export const toConfidentialUnderlyingAmount = (
  yieldDto: EarnYieldWithProvider,
  shareToken: Pick<Token, "address">,
  shares: BigNumber
): BigNumber =>
  truncateToTokenDecimals(
    shares.times(getConfidentialPricePerShare(yieldDto, shareToken)),
    yieldDto.token.decimals
  );

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

/**
 * The batch a confidential action only joins: a deposit joins the next
 * subscription batch, a private exit's REDEEM the next redemption batch.
 */
export const getConfidentialActionBatchSide = (
  yieldDto: EarnYieldWithProvider,
  action: Pick<YieldAction, "intent" | "transactions">
): ConfidentialBatchSide | null => {
  if (!isConfidentialYield(yieldDto)) return null;
  if (action.intent === "enter") return "subscription";
  return action.intent === "exit" &&
    action.transactions.some(({ type }) => type === "REDEEM")
    ? "redemption"
    : null;
};

// A cancelled deposit refunds the wrapper, not the underlying the API
// denominates the entering balance in; a cancelled withdrawal refunds the
// vault shares it would have redeemed.
export const getCancelReturnToken = (
  yieldDto: EarnYieldWithProvider,
  pendingActionType: YieldPendingActionType,
  balance: Readonly<{
    readonly shareToken?: Token;
    readonly type: BalanceType;
  }>
): Token | null => {
  if (pendingActionType !== "CANCEL_PENDING") return null;
  if (balance.type === "entering") return getConfidentialAssetToken(yieldDto);
  if (balance.type === "exiting" && isConfidentialYield(yieldDto)) {
    return balance.shareToken ?? null;
  }
  return null;
};

export type CancelReturn = Readonly<{
  readonly amount: BigNumber;
  readonly token: Token;
}>;

/** What cancelling a pending confidential request refunds, in that token. */
export const getCancelReturn = (
  yieldDto: EarnYieldWithProvider,
  pendingActionType: YieldPendingActionType,
  balance: Readonly<{
    readonly amount: BigNumber;
    readonly shares?: EarnBalanceShares;
    readonly shareToken?: Token;
    readonly type: BalanceType;
  }>
): CancelReturn | null => {
  const token = getCancelReturnToken(yieldDto, pendingActionType, balance);
  if (!token) return null;
  // A withdrawal is valued in the underlying but holds vault shares.
  const amount =
    balance.type === "exiting"
      ? (getVisibleShares(balance)?.amount ?? exactZero())
      : balance.amount;
  return { amount, token };
};

/**
 * The amount a balance row shows: a confidential vault's pending withdrawal
 * in the vault shares it redeems, everything else in its token.
 */
export const getBalanceRowDisplayAmount = (
  yieldDto: EarnYieldWithProvider,
  row: Readonly<{
    readonly amount: BigNumber;
    readonly shareAmount?: BigNumber;
    readonly shareToken?: Token;
    readonly token: Token;
    readonly type: BalanceType;
  }>
): Readonly<{ readonly amount: BigNumber; readonly token: Token }> =>
  row.type === "exiting" &&
  row.shareToken &&
  row.shareAmount &&
  isConfidentialYield(yieldDto)
    ? { amount: row.shareAmount, token: row.shareToken }
    : { amount: row.amount, token: row.token };

type ConfidentialExitSource = Readonly<{
  readonly amount: BigNumber;
  readonly amountUsd?: BigNumber | null;
  readonly shares?: EarnBalanceShares;
  readonly shareToken?: Token;
  readonly token: Token;
}>;

export type ConfidentialExitBalance = Readonly<{
  readonly amount: BigNumber;
  readonly amountUsd: BigNumber;
  readonly token: Token;
  /** The same balance valued in the underlying the vault quotes. */
  readonly underlying: Readonly<{
    readonly amount: BigNumber;
    readonly token: Token;
  }>;
}>;

/**
 * A confidential vault redeems shares, so its exit balance is the share
 * count: zero while hidden, which the API sends empty. Null when the active
 * balances hold different shares or underlyings.
 */
export const getConfidentialExitBalance = (
  activeBalances: ReadonlyArray<ConfidentialExitSource>
): ConfidentialExitBalance | null => {
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
  return activeBalances.reduce<ConfidentialExitBalance>(
    (sum, balance) => ({
      amount: sum.amount.plus(getVisibleShares(balance)?.amount ?? exactZero()),
      amountUsd: sum.amountUsd.plus(balance.amountUsd ?? 0),
      token: shareToken,
      underlying: {
        amount: sum.underlying.amount.plus(balance.amount),
        token: first.token,
      },
    }),
    {
      amount: exactDecimal(0),
      amountUsd: exactDecimal(0),
      token: shareToken,
      underlying: { amount: exactDecimal(0), token: first.token },
    }
  );
};

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
  const shareAmount = exactDecimal(revealed.toString()).shiftedBy(
    -shareDecimals
  );
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
    amountRaw: toBaseUnits(amount, balance.token.decimals),
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

export const getConfidentialHandleContract = (
  yieldDto: EarnYieldWithProvider,
  balance: Readonly<{
    readonly shareToken?: Pick<Token, "address">;
    readonly type: BalanceType;
  }>
): string | null => {
  switch (balance.type) {
    case "entering":
      return getOwnBatcher(yieldDto, "enter");
    case "exiting":
      return getOwnBatcher(yieldDto, "exit");
    default:
      return balance.shareToken?.address ?? null;
  }
};

const getOwnBatcher = (
  yieldDto: EarnYieldWithProvider,
  intent: ConfidentialIntent
) => {
  const legs = getConfidentialLegs(yieldDto, intent);
  return legs ? (legs.legs[legs.ownIndex] ?? null) : null;
};
