import { DateTime, Struct } from "effect";
import type { ActionEvent, YieldAction } from "../action/models";
import type { ContractAddress, TokenAddress } from "../identity/identifiers";
import type { Network } from "../network/network";
import { sameTokenContract, type Token } from "../token/token";
import type { EvmChainIds } from "../wallet/chain-ids";
import { getWalletRoutingId } from "../wallet/network";
import type { ConfidentialHandle, EarnBalance } from "./balance";
import { getYieldActionArg } from "./yield";
import type { EarnYieldWithProvider } from "./yield-schema";

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

/**
 * What a confidential action did. A deposit or private exit only joins the
 * next batch; an instant exit unwraps now and its WITHDRAW pays it out.
 */
export type ConfidentialActionKind =
  | "deposit"
  | "instantExit"
  | "instantExitPayout"
  | "privateExit";

export const getConfidentialActionKind = (
  yieldDto: EarnYieldWithProvider,
  action: Pick<YieldAction, "intent" | "rawArguments" | "type">
): ConfidentialActionKind | null => {
  if (!isConfidentialYield(yieldDto)) return null;
  switch (action.intent) {
    case "enter":
      return "deposit";
    case "exit":
      return isConfidentialInstantExit(
        yieldDto,
        action.rawArguments?.outputToken
      )
        ? "instantExit"
        : "privateExit";
    case "manage":
      return action.type === "WITHDRAW" ? "instantExitPayout" : null;
  }
};

/** How the batch a confidential deposit or private exit joined resolved. */
export type ConfidentialSettlement =
  | Readonly<{ _tag: "Awaiting" }>
  | Readonly<{
      _tag: "Cancelled";
      at: DateTime.Utc;
      transactionHash: ActionEvent["transactionHash"];
    }>
  | Readonly<{
      _tag: "Settled";
      at: DateTime.Utc;
      transactionHash: ActionEvent["transactionHash"];
    }>;

const settlementEventTypes = {
  deposit: { cancelled: "DEPOSIT_CANCELLED", settled: "DEPOSIT_SETTLED" },
  privateExit: {
    cancelled: "REDEMPTION_CANCELLED",
    settled: "REDEMPTION_SETTLED",
  },
} as const satisfies Record<
  "deposit" | "privateExit",
  Readonly<{ cancelled: ActionEvent["type"]; settled: ActionEvent["type"] }>
>;

/**
 * The batch settlement of a confidential deposit or private exit: its latest
 * settled or cancelled event, else Awaiting once the API reports it done.
 * Null when it is not such an action, or it has not completed yet.
 */
export const getConfidentialSettlement = (
  yieldDto: EarnYieldWithProvider,
  action: Pick<
    YieldAction,
    "events" | "intent" | "rawArguments" | "status" | "type"
  >
): ConfidentialSettlement | null => {
  const kind = getConfidentialActionKind(yieldDto, action);
  if (kind !== "deposit" && kind !== "privateExit") return null;

  const types = settlementEventTypes[kind];
  const event = action.events
    .filter(({ type }) => type === types.settled || type === types.cancelled)
    .reduce<ActionEvent | null>(
      (latest, candidate) =>
        latest &&
        DateTime.isGreaterThan(latest.occurredAt, candidate.occurredAt)
          ? latest
          : candidate,
      null
    );
  if (event) {
    return {
      _tag: event.type === types.settled ? "Settled" : "Cancelled",
      at: event.occurredAt,
      transactionHash: event.transactionHash,
    };
  }

  return action.status === "SUCCESS" ? { _tag: "Awaiting" } : null;
};

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
