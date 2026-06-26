import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { tokenString } from "../../../../../../domain";
import {
  isSupportedChain,
  type SupportedSKChains,
} from "../../../../../../domain/types/chains";
import type { PositionsData } from "../../../../../../domain/types/positions";
import { canBeInitialYield } from "../../../../../../domain/types/stake";
import { isNonZeroRewardRateYield } from "../../../../../../domain/types/yields";
import type {
  EarnEntryKey,
  EarnTokenOption,
  EarnYieldId,
  EarnYieldOption,
} from "../types";

const blockedInitialYieldIds = new Set([
  "binance-bnb-native-staking",
  "binance-testnet-bnb-native-staking",
  "avax-native-staking",
]);

export const resolveYieldOptions = ({
  selectedToken,
  yieldsById,
}: {
  selectedToken: EarnTokenOption | null;
  yieldsById: ReadonlyArray<EarnYieldOption>;
}) => {
  if (!selectedToken) {
    return [];
  }

  const availableYields = new Set(selectedToken.availableYields);

  return yieldsById.filter(
    (yieldOption) =>
      availableYields.has(yieldOption.id) && canShowYieldOption(yieldOption)
  );
};

export const resolveYield = ({
  entry,
  positionsData,
  selectedYieldId,
  selectedToken,
  yieldOptions,
}: {
  entry: EarnEntryKey;
  positionsData: PositionsData;
  selectedYieldId: EarnYieldId | null;
  selectedToken: EarnTokenOption;
  yieldOptions: ReadonlyArray<EarnYieldOption>;
}) => {
  if (selectedYieldId) {
    const selected = findYieldById(yieldOptions, selectedYieldId);
    if (selected) {
      return selected;
    }
  }

  const initYieldId = entry.initParams?.yieldId;
  if (initYieldId) {
    const selected = findYieldById(yieldOptions, initYieldId);
    if (selected) {
      return selected;
    }
  }

  const preferredYieldId = getPreferredYieldId({
    preferredTokenYieldsPerNetwork:
      entry.preferredTokenYieldsPerNetwork ?? null,
    selectedToken,
  });
  if (preferredYieldId) {
    if (preferredYieldId === "*") {
      return getDefaultYield(yieldOptions);
    }

    const selected = findYieldById(yieldOptions, preferredYieldId);
    if (selected) {
      return selected;
    }
  }

  const tokenBalanceAmount = new BigNumber(selectedToken.amount);
  const eligibleYield =
    yieldOptions.find((yieldDto) =>
      canBeInitialYield({
        initQueryParams: Maybe.fromNullable(entry.initParams),
        yieldDto,
        tokenBalanceAmount,
        positionsData,
      })
    ) ?? null;

  return eligibleYield ?? getDefaultYield(yieldOptions);
};

const canShowYieldOption = (yieldOption: EarnYieldOption) =>
  yieldOption.status.enter &&
  isSupportedChain(yieldOption.token.network) &&
  !blockedInitialYieldIds.has(yieldOption.id);

const findYieldById = (
  yieldOptions: ReadonlyArray<EarnYieldOption>,
  yieldId: EarnYieldId
) =>
  yieldOptions.find(
    (yieldOption) => yieldOption.id.toLowerCase() === yieldId.toLowerCase()
  ) ?? null;

const getDefaultYield = (yieldOptions: ReadonlyArray<EarnYieldOption>) =>
  yieldOptions.find(isNonZeroRewardRateYield) ?? yieldOptions[0] ?? null;

const getPreferredYieldId = ({
  preferredTokenYieldsPerNetwork,
  selectedToken,
}: {
  preferredTokenYieldsPerNetwork: EarnEntryKey["preferredTokenYieldsPerNetwork"];
  selectedToken: EarnTokenOption;
}) => {
  const tokenKey = tokenString(selectedToken.token);
  const networkPreferred =
    preferredTokenYieldsPerNetwork?.[
      selectedToken.token.network as SupportedSKChains
    ];
  const fallbackPreferred = preferredTokenYieldsPerNetwork
    ? Object.values(preferredTokenYieldsPerNetwork)[0]
    : undefined;

  return networkPreferred?.[tokenKey] ?? fallbackPreferred?.[tokenKey] ?? null;
};
