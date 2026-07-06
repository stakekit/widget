import { tokenString } from "../../../../../../domain";
import type { SupportedSKChains } from "../../../../../../domain/types/chains";
import type { EarnEntryKey, EarnTokenKey, EarnTokenOption } from "../types";

export const resolveToken = ({
  entry,
  selectedTokenKey,
  tokenOptions,
}: {
  entry: EarnEntryKey;
  selectedTokenKey: EarnTokenKey | null;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) => {
  if (selectedTokenKey) {
    const selected = findTokenByKey(tokenOptions, selectedTokenKey);
    if (selected) {
      return selected;
    }
  }

  if (entry.initParams?.yieldId) {
    const selected = tokenOptions.find((option) =>
      option.availableYields.includes(entry.initParams?.yieldId ?? "")
    );
    if (selected) {
      return selected;
    }
  }

  if (entry.initParams?.token) {
    const selected = findTokenByInitToken({
      network: entry.initParams.network ?? null,
      token: entry.initParams.token,
      tokenOptions,
    });
    if (selected) {
      return selected;
    }
  }

  const network = entry.network as SupportedSKChains | null;
  const preferredTokens = network
    ? (entry.preferredTokenYieldsPerNetwork?.[network] ??
      Object.values(entry.preferredTokenYieldsPerNetwork ?? {})[0])
    : Object.values(entry.preferredTokenYieldsPerNetwork ?? {})[0];
  if (preferredTokens) {
    const selected = tokenOptions.find(
      (option) => !!preferredTokens[tokenString(option.token)]
    );
    if (selected) {
      return selected;
    }
  }

  return tokenOptions[0] ?? null;
};

const findTokenByKey = (
  tokens: ReadonlyArray<EarnTokenOption>,
  tokenKey: EarnTokenKey
) => tokens.find((token) => tokenString(token.token) === tokenKey) ?? null;

const findTokenByInitToken = ({
  network,
  token,
  tokenOptions,
}: {
  network: string | null;
  token: string;
  tokenOptions: ReadonlyArray<EarnTokenOption>;
}) =>
  tokenOptions.find((option) => {
    const tokenSymbolCompare =
      token.toLowerCase() === option.token.symbol.toLowerCase();
    const tokenNetworkCompare =
      !!network && network.toLowerCase() === option.token.network.toLowerCase();
    const tokenStringCompare = tokenString(option.token) === token;

    return (tokenSymbolCompare && tokenNetworkCompare) || tokenStringCompare;
  }) ?? null;
