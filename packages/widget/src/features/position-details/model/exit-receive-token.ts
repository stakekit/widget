import { Struct } from "effect";
import type { ExitReceiveToken } from "../../../domain/action/rules";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { getYieldActionArg } from "../../../domain/earn/yield";
import {
  addressIdentity,
  type TokenAddress,
} from "../../../domain/identity/identifiers";
import {
  getTokenArgumentAddress,
  NATIVE_TOKEN_ADDRESS,
  type Token,
} from "../../../domain/token/token";
import { formatAddress } from "../../../shared/lib/general";

export type PositionDetailsExitReceiveTokenSelection = Readonly<{
  options: ReadonlyArray<ExitReceiveToken>;
  selected: ExitReceiveToken;
}>;

type ExitReceiveTokenOptionView = Readonly<{
  address: TokenAddress;
  symbol: string;
  formattedAddress: string;
  token: Token;
}>;

type ExitReceiveTokenAccessoryView =
  | Readonly<{
      _tag: "Static";
      token: Token;
    }>
  | Readonly<{
      _tag: "Selectable";
      token: Token;
    }>;

type ExitReceiveTokenNoteView = Readonly<{
  symbol: string;
  formattedAddress: string | null;
}>;

export const equalExitReceiveTokenAddresses = (
  first: TokenAddress,
  second: TokenAddress
) => addressIdentity(first) === addressIdentity(second);

const formatReceiveTokenAddress = (address: TokenAddress) =>
  formatAddress(address, {
    leadingChars: 6,
    trailingChars: 4,
  });

const isSkySavingsRate = (integration: EarnYieldWithProvider) =>
  integration.providerId.toLowerCase() === "sky" &&
  integration.outputToken?.symbol.toLowerCase() === "susds";

/**
 * Indexes every token the yield describes by the identity of its argument
 * address, so the native `"0x"` option resolves to the native token (often
 * only the gas fee token). Look up with `addressIdentity`.
 */
export const buildExitReceiveTokensByAddress = (
  integration: EarnYieldWithProvider
): ReadonlyMap<string, Token> => {
  const tokens = new Map<string, Token>();
  for (const token of [
    ...integration.inputTokens,
    integration.token,
    ...integration.tokens,
    ...(integration.outputToken ? [integration.outputToken] : []),
    integration.mechanics.gasFeeToken,
  ]) {
    const key = addressIdentity(getTokenArgumentAddress(token));
    if (!tokens.has(key)) tokens.set(key, token);
  }
  return tokens;
};

/**
 * Resolves the Exit Receive Token for any yield advertising exit `outputToken`
 * options. Sky sUSDS keeps its USDS preference; others default to the first
 * advertised option.
 */
export const resolvePositionDetailsExitReceiveTokenSelection = ({
  integration,
  selectedAddress,
}: {
  readonly integration: EarnYieldWithProvider;
  readonly selectedAddress: TokenAddress | null;
}): PositionDetailsExitReceiveTokenSelection | null => {
  const advertisedOptions = getYieldActionArg(
    integration,
    "exit",
    "outputToken"
  )?.options;
  if (!advertisedOptions?.length) return null;

  const tokensByAddress = buildExitReceiveTokensByAddress(integration);
  const options = advertisedOptions.map((address) => ({
    address,
    symbol: tokensByAddress.get(addressIdentity(address))?.symbol ?? address,
  }));

  const selected = selectedAddress
    ? options.find((option) =>
        equalExitReceiveTokenAddresses(option.address, selectedAddress)
      )
    : undefined;
  const preferred = isSkySavingsRate(integration)
    ? options.find((option) => option.symbol.toLowerCase() === "usds")
    : undefined;

  return {
    options,
    selected: selected ?? preferred ?? options[0]!,
  };
};

export const projectExitReceiveTokenOption = ({
  option,
  positionToken,
  tokensByAddress,
}: {
  readonly option: ExitReceiveToken;
  readonly positionToken: Token;
  readonly tokensByAddress: ReadonlyMap<string, Token>;
}): ExitReceiveTokenOptionView => {
  const known = tokensByAddress.get(addressIdentity(option.address));
  const token =
    known ??
    ({
      ...Struct.omit(positionToken, ["address"]),
      ...(option.address === NATIVE_TOKEN_ADDRESS
        ? {}
        : { address: option.address }),
      name: option.symbol,
      symbol: option.symbol,
      logoURI: undefined,
      coinGeckoId: undefined,
    } satisfies Token);

  return {
    address: option.address,
    symbol: option.symbol,
    formattedAddress: formatReceiveTokenAddress(option.address),
    token,
  };
};

export const resolveExitReceiveTokenAccessory = ({
  positionToken,
  selection,
  tokensByAddress = new Map(),
}: {
  readonly positionToken: Token;
  readonly selection: PositionDetailsExitReceiveTokenSelection | null;
  readonly tokensByAddress?: ReadonlyMap<string, Token>;
}): ExitReceiveTokenAccessoryView => {
  if (!selection) {
    return { _tag: "Static", token: positionToken };
  }

  const selectedToken = projectExitReceiveTokenOption({
    option: selection.selected,
    positionToken,
    tokensByAddress,
  }).token;

  return {
    _tag: selection.options.length > 1 ? "Selectable" : "Static",
    token: selectedToken,
  };
};

export const resolveExitReceiveTokenNote = ({
  positionToken,
  selected,
}: {
  readonly positionToken: Token;
  readonly selected: ExitReceiveToken;
}): ExitReceiveTokenNoteView | null => {
  const positionAddress = positionToken.address;
  if (
    positionAddress &&
    equalExitReceiveTokenAddresses(positionAddress, selected.address)
  ) {
    return null;
  }

  const sameSymbol =
    selected.symbol.toLowerCase() === positionToken.symbol.toLowerCase();

  return {
    symbol: selected.symbol,
    formattedAddress: sameSymbol
      ? formatReceiveTokenAddress(selected.address)
      : null,
  };
};
