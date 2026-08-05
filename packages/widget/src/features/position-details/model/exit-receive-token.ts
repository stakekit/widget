import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { TokenAddress } from "../../../domain/schema/identifiers";
import type { ExitReceiveToken } from "../../../domain/types/action";
import { getYieldActionArg } from "../../../domain/types/yields";

export type PositionDetailsExitReceiveTokenSelection = Readonly<{
  options: ReadonlyArray<ExitReceiveToken>;
  selected: ExitReceiveToken;
}>;

const equalTokenAddresses = (first: TokenAddress, second: TokenAddress) =>
  first.toLowerCase() === second.toLowerCase();

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
        candidate.address && equalTokenAddresses(candidate.address, address)
    );

    return { address, symbol: token?.symbol ?? address };
  });

  const selected = selectedAddress
    ? options.find((option) =>
        equalTokenAddresses(option.address, selectedAddress)
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
