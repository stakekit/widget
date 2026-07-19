import { Option, Schema } from "effect";
import { YieldId } from "../../../../../domain/schema/identifiers";
import { tokenString } from "../../../../../domain/types/tokens";
import type { EarnEntry, EarnTokenKey, EarnTokenOption } from "../types";

export const resolveToken = ({
  entry,
  selectedTokenKey,
  tokenOptions,
}: {
  entry: EarnEntry;
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
    const initYieldId = Schema.decodeOption(YieldId)(
      entry.initParams.yieldId
    ).pipe(Option.getOrNull);
    const selected = tokenOptions.find((option) =>
      initYieldId ? option.availableYields.includes(initYieldId) : false
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

  const network = entry.walletScope?.network ?? null;
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
