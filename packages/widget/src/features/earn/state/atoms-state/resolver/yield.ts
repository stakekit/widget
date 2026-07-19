import BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import type { EarnYield } from "../../../../../domain/schema/earn-models";
import { YieldId } from "../../../../../domain/schema/identifiers";
import {
  isSupportedChain,
  type SupportedSKChains,
} from "../../../../../domain/types/chains";
import type { PositionsData } from "../../../../../domain/types/positions";
import { canBeInitialYield } from "../../../../../domain/types/stake";
import { tokenString } from "../../../../../domain/types/tokens";
import { isNonZeroRewardRateYield } from "../../../../../domain/types/yields";
import type { EarnEntry, EarnTokenOption } from "../types";

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
  yieldsById: ReadonlyArray<EarnYield>;
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
  entry: EarnEntry;
  positionsData: PositionsData;
  selectedYieldId: YieldId | null;
  selectedToken: EarnTokenOption;
  yieldOptions: ReadonlyArray<EarnYield>;
}) => {
  if (selectedYieldId) {
    const selected = findYieldById(yieldOptions, selectedYieldId);
    if (selected) {
      return selected;
    }
  }

  const initYieldId = entry.initParams?.yieldId;
  if (initYieldId) {
    const decodedInitYieldId = Schema.decodeOption(YieldId)(initYieldId).pipe(
      Option.getOrNull
    );
    const selected = decodedInitYieldId
      ? findYieldById(yieldOptions, decodedInitYieldId)
      : null;
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

    const decodedPreferredYieldId = Schema.decodeOption(YieldId)(
      preferredYieldId
    ).pipe(Option.getOrNull);
    const selected = decodedPreferredYieldId
      ? findYieldById(yieldOptions, decodedPreferredYieldId)
      : null;
    if (selected) {
      return selected;
    }
  }

  const tokenBalanceAmount = new BigNumber(selectedToken.amount);
  const eligibleYield =
    yieldOptions.find((yieldDto) =>
      canBeInitialYield({
        initQueryParams: entry.initParams ?? null,
        yieldDto,
        tokenBalanceAmount,
        positionsData,
      })
    ) ?? null;

  return eligibleYield ?? getDefaultYield(yieldOptions);
};

const canShowYieldOption = (yieldOption: EarnYield) =>
  yieldOption.status.enter &&
  isSupportedChain(yieldOption.token.network) &&
  !blockedInitialYieldIds.has(yieldOption.id);

const findYieldById = (
  yieldOptions: ReadonlyArray<EarnYield>,
  yieldId: YieldId
) =>
  yieldOptions.find(
    (yieldOption) => yieldOption.id.toLowerCase() === yieldId.toLowerCase()
  ) ?? null;

const getDefaultYield = (yieldOptions: ReadonlyArray<EarnYield>) =>
  yieldOptions.find(isNonZeroRewardRateYield) ?? yieldOptions[0] ?? null;

const getPreferredYieldId = ({
  preferredTokenYieldsPerNetwork,
  selectedToken,
}: {
  preferredTokenYieldsPerNetwork: EarnEntry["preferredTokenYieldsPerNetwork"];
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
