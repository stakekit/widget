import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { TokenAddress } from "../../../domain/schema/identifiers";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { ExitReceiveToken } from "../../../domain/types/action";
import { getYieldActionArg } from "../../../domain/types/yields";
import { formatAddress } from "../../../shared/lib/general";

export type PositionDetailsExitReceiveTokenSelection = Readonly<{
  options: ReadonlyArray<ExitReceiveToken>;
  selected: ExitReceiveToken;
}>;

type ExitReceiveTokenOptionView = Readonly<{
  address: TokenAddress;
  symbol: string;
  formattedAddress: string;
  token: AppToken;
}>;

type ExitReceiveTokenAccessoryView =
  | Readonly<{
      _tag: "Static";
      token: AppToken;
    }>
  | Readonly<{
      _tag: "Selectable";
      token: AppToken;
    }>;

type ExitReceiveTokenNoteView = Readonly<{
  symbol: string;
  formattedAddress: string | null;
}>;

export const equalExitReceiveTokenAddresses = (
  first: TokenAddress,
  second: TokenAddress
) => first.toLowerCase() === second.toLowerCase();

const formatReceiveTokenAddress = (address: TokenAddress) =>
  formatAddress(address, {
    leadingChars: 6,
    trailingChars: 4,
  });

const isSkySavingsRate = (integration: EarnYieldWithProvider) =>
  integration.providerId.toLowerCase() === "sky" &&
  integration.outputToken?.symbol.toLowerCase() === "susds";

export const resolvePositionDetailsExitReceiveTokenSelection = ({
  integration,
  selectedAddress,
}: {
  readonly integration: EarnYieldWithProvider;
  readonly selectedAddress: TokenAddress | null;
}): PositionDetailsExitReceiveTokenSelection | null => {
  if (!isSkySavingsRate(integration)) return null;

  const advertisedOptions = getYieldActionArg(
    integration,
    "exit",
    "outputToken"
  )?.options;
  if (!advertisedOptions) return null;

  const options = advertisedOptions.map((address) => {
    const token = integration.inputTokens.find(
      (candidate) =>
        candidate.address &&
        equalExitReceiveTokenAddresses(candidate.address, address)
    );

    return { address, symbol: token?.symbol ?? address };
  });

  const selected = selectedAddress
    ? options.find((option) =>
        equalExitReceiveTokenAddresses(option.address, selectedAddress)
      )
    : null;

  return {
    options,
    selected:
      selected ??
      options.find((option) => option.symbol.toLowerCase() === "usds") ??
      options[0]!,
  };
};

export const buildExitReceiveTokensByAddress = (
  integration: EarnYieldWithProvider
): ReadonlyMap<string, AppToken> => {
  const tokens = new Map<string, AppToken>();
  for (const token of integration.inputTokens) {
    if (token.address) {
      tokens.set(token.address.toLowerCase(), token);
    }
  }
  return tokens;
};

export const projectExitReceiveTokenOption = ({
  option,
  positionToken,
  tokensByAddress,
}: {
  readonly option: ExitReceiveToken;
  readonly positionToken: AppToken;
  readonly tokensByAddress: ReadonlyMap<string, AppToken>;
}): ExitReceiveTokenOptionView => {
  const known = tokensByAddress.get(option.address.toLowerCase());
  const token =
    known ??
    ({
      ...positionToken,
      address: option.address,
      name: option.symbol,
      symbol: option.symbol,
      logoURI: undefined,
      coinGeckoId: undefined,
    } satisfies AppToken);

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
  readonly positionToken: AppToken;
  readonly selection: PositionDetailsExitReceiveTokenSelection | null;
  readonly tokensByAddress?: ReadonlyMap<string, AppToken>;
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
  readonly positionToken: AppToken;
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
