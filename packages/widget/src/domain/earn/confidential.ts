import type BigNumber from "bignumber.js";
import { Option, Schema, SchemaTransformation, Struct } from "effect";
import { exactDecimal, truncateToTokenDecimals } from "../finance/exact";
import type { Network } from "../network/network";
import type { Token } from "../token/token";
import { getWalletRoutingId } from "../wallet/network";
import type { EarnYieldWithProvider } from "./models";
import { getYieldActionArg } from "./yield";

type ConfidentialIntent = "enter" | "exit";

const confidentialNetworks = ["ethereum", "ethereum-sepolia"] as const;

const getChainId = (network: Network) => {
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
  a: Readonly<{ readonly network: string; readonly address?: string }>,
  b: Readonly<{ readonly network: string; readonly address?: string }>
) =>
  a.network === b.network &&
  !!a.address &&
  !!b.address &&
  sameAddress(a.address, b.address);

const isExecutionContract = (
  yieldDto: EarnYieldWithProvider,
  intent: ConfidentialIntent,
  address: string
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
  readonly chainId: number;
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
  readonly chainId: number;
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
    readonly handle: string;
    readonly proof: string;
  }> | null;
  readonly legs: Readonly<{
    readonly handles: ReadonlyArray<string>;
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

export const ConfidentialHandle = Schema.String.pipe(
  Schema.decode(SchemaTransformation.toLowerCase()),
  Schema.decodeTo(
    Schema.String.check(Schema.isPattern(/^0x[0-9a-f]{64}$/)).pipe(
      Schema.brand("ConfidentialHandle")
    )
  )
);
export type ConfidentialHandle = typeof ConfidentialHandle.Type;

const ConfidentialTokenBalanceKey = Schema.String.pipe(
  Schema.brand("ConfidentialTokenBalanceKey")
);
type ConfidentialTokenBalanceKey = typeof ConfidentialTokenBalanceKey.Type;

export type ConfidentialValues = ReadonlyMap<
  ConfidentialHandle | ConfidentialTokenBalanceKey,
  bigint
>;

export const isConfidentialHandle = Schema.is(ConfidentialHandle);

// The API puts an encrypted balance's handle in `shareAmountRaw`.
export const getEncryptedHandle = (
  balance: Readonly<{
    readonly isEncrypted?: boolean;
    readonly shareAmountRaw?: string;
  }>
): ConfidentialHandle | null =>
  balance.isEncrypted && balance.shareAmountRaw
    ? Option.getOrNull(
        Schema.decodeOption(ConfidentialHandle)(balance.shareAmountRaw)
      )
    : null;

export const confidentialTokenBalanceKey = ({
  owner,
  token,
}: {
  readonly owner: string;
  readonly token: Token;
}) =>
  ConfidentialTokenBalanceKey.make(
    `${token.network}:${token.address ?? ""}:${owner}`.toLowerCase()
  );

type ConfidentialBalance = Readonly<{
  readonly amount: BigNumber;
  readonly amountRaw: bigint;
  readonly amountUsd?: BigNumber | null;
  readonly isEncrypted?: boolean;
  readonly shareAmount?: string;
  readonly shareAmountRaw?: string;
  readonly shareToken?: Readonly<{
    readonly address?: string;
    readonly decimals: number;
  }>;
  readonly token: Readonly<{ readonly decimals: number }>;
}>;

export const getConfidentialPricePerShare = (
  yieldDto: EarnYieldWithProvider,
  shareToken: Readonly<{ readonly address?: string }>
): BigNumber => {
  const state = yieldDto.state?.pricePerShareState;
  const price = state ? exactDecimal(state.price) : null;
  return price?.isFinite() &&
    price.isGreaterThan(0) &&
    state?.shareToken.address &&
    shareToken.address &&
    sameAddress(state.shareToken.address, shareToken.address)
    ? price
    : exactDecimal(1);
};

export type ConfidentialValuation = Readonly<{
  readonly yieldDto: EarnYieldWithProvider;
  readonly usdPrice: BigNumber | null;
}>;

const isRevealedBalance = (
  balance: ConfidentialBalance,
  values: ConfidentialValues
) => {
  const handle = getEncryptedHandle(balance);
  return handle !== null && values.has(handle);
};

export const hasRevealedBalance = (
  position: Readonly<{ readonly balances: ReadonlyArray<ConfidentialBalance> }>,
  values: ConfidentialValues
) => position.balances.some((balance) => isRevealedBalance(balance, values));

// Withdrawable unwraps are publicly decrypted by WITHDRAW, not revealed.
export const isUserRevealableBalance = (
  balance: Readonly<{ readonly isEncrypted?: boolean; readonly type: string }>
) => !!balance.isEncrypted && balance.type !== "withdrawable";

export const getPendingActionDecryptHandle = (
  balance: Readonly<{
    readonly isEncrypted?: boolean;
    readonly shareAmountRaw?: string;
    readonly type: string;
  }>,
  pendingActionType: string
): string | null =>
  balance.isEncrypted &&
  balance.type === "withdrawable" &&
  pendingActionType === "WITHDRAW"
    ? (balance.shareAmountRaw ?? null)
    : null;

// The API sends empty amounts for encrypted balances.
export const zeroEncryptedBalance = <
  Balance extends Readonly<{ readonly isEncrypted?: boolean }>,
>(
  balance: Balance
): Balance =>
  balance.isEncrypted
    ? { ...balance, amount: "0", amountRaw: "0", shareAmount: "0" }
    : balance;

export const fillConfidentialBalance = <Balance extends ConfidentialBalance>(
  balance: Balance,
  values: ConfidentialValues,
  valuation: ConfidentialValuation | null = null
): Balance => {
  const handle = getEncryptedHandle(balance);
  const revealed = handle === null ? undefined : values.get(handle);
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
  return {
    ...Struct.omit(balance, ["isEncrypted"]),
    amount,
    amountRaw: BigInt(amount.shiftedBy(balance.token.decimals).toFixed(0)),
    ...(valuation?.usdPrice
      ? { amountUsd: amount.times(valuation.usdPrice) }
      : {}),
    shareAmount: shareAmount.toFixed(),
    shareAmountRaw: revealed.toString(),
  } as Balance;
};

export const fillConfidentialPosition = <
  Balance extends ConfidentialBalance,
  Position extends Readonly<{ readonly balances: ReadonlyArray<Balance> }>,
>(
  position: Position,
  values: ConfidentialValues,
  valuation: ConfidentialValuation | null = null
): Position => ({
  ...position,
  balances: position.balances.map((balance) =>
    fillConfidentialBalance(balance, values, valuation)
  ),
});

export const getConfidentialHandleContract = (
  yieldDto: EarnYieldWithProvider,
  balance: Readonly<{
    readonly shareToken?: Readonly<{ readonly address?: string }>;
    readonly type: string;
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
