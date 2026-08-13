import BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { canBeInitialYield } from "../../../../../domain/earn/stake";
import { isNonZeroRewardRateYield } from "../../../../../domain/earn/yield";
import { YieldId } from "../../../../../domain/identity/identifiers";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import { tokenString } from "../../../../../domain/token/token";
import {
  isSupportedChain,
  type SupportedSKChains,
} from "../../../../../services/wallet/supported-chains";
import type { EarnEntry, EarnTokenOption } from "../types";

export const resolveYieldOptions = ({
  selectedToken,
  yieldsById,
}: {
  selectedToken: EarnTokenOption | null;
  yieldsById: ReadonlyArray<EarnYieldWithProvider>;
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
  yieldOptions: ReadonlyArray<EarnYieldWithProvider>;
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

const canShowYieldOption = (yieldOption: EarnYieldWithProvider) =>
  yieldOption.status.enter && isSupportedChain(yieldOption.token.network);

const findYieldById = (
  yieldOptions: ReadonlyArray<EarnYieldWithProvider>,
  yieldId: YieldId
) =>
  yieldOptions.find(
    (yieldOption) => yieldOption.id.toLowerCase() === yieldId.toLowerCase()
  ) ?? null;

const getDefaultYield = (yieldOptions: ReadonlyArray<EarnYieldWithProvider>) =>
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

  return networkPreferred?.[tokenKey] ?? null;
};
