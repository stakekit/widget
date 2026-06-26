import { Maybe } from "purify-ts";
import { tokenString } from "../../../../../../domain";
import type { SupportedSKChains } from "../../../../../../domain/types/chains";
import { getInitialToken } from "../../../../../../domain/types/stake";
import type {
  EarnEntryKey,
  EarnTokenKey,
  EarnTokenOption,
  EarnTokenOptionsState,
} from "../types";

export const resolveToken = ({
  entry,
  selectedTokenKey,
  tokenOptions,
}: {
  entry: EarnEntryKey;
  selectedTokenKey: EarnTokenKey | null;
  tokenOptions: EarnTokenOptionsState;
}) => {
  if (selectedTokenKey) {
    const selected = findTokenByKey(tokenOptions.items, selectedTokenKey);
    if (selected) {
      return selected;
    }
  }

  if (entry.initParams?.yieldId) {
    const selected = tokenOptions.initItems.find((option) =>
      option.availableYields.includes(entry.initParams?.yieldId ?? "")
    );
    if (selected) {
      return selected;
    }
  }

  const initialToken = getInitialToken({
    initQueryParams: Maybe.fromNullable(entry.initParams),
    tokenBalances: tokenOptions.balanceItems,
    defaultTokens: [...tokenOptions.initItems, ...tokenOptions.defaultItems],
    network: entry.network as SupportedSKChains | null,
    preferredTokenYieldsPerNetwork:
      entry.preferredTokenYieldsPerNetwork ?? null,
  }).extractNullable();

  if (initialToken) {
    const selected = findTokenByKey(
      tokenOptions.items,
      tokenString(initialToken)
    );
    if (selected) {
      return selected;
    }
  }

  return tokenOptions.items[0] ?? null;
};

const findTokenByKey = (
  tokens: ReadonlyArray<EarnTokenOption>,
  tokenKey: EarnTokenKey
) => tokens.find((token) => tokenString(token.token) === tokenKey) ?? null;
