import type BigNumber from "bignumber.js";
import { Option, Schema } from "effect";
import { getMinStakeAmount } from "../../../../../domain/earn/stake";
import {
  isNonZeroRewardRateYield,
  isYieldVisible,
} from "../../../../../domain/earn/yield";
import {
  getRankedDefaultYield,
  type YieldProviderOrder,
} from "../../../../../domain/earn/yield-provider-order";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { YieldId } from "../../../../../domain/identity/identifiers";
import {
  hasActivePositionForYield,
  type PositionsData,
} from "../../../../../domain/portfolio/positions";
import { hostTokenKey } from "../../../../../domain/token/token";
import { isWalletNetwork } from "../../../../../domain/wallet/network";
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

const canShowYieldOption = (yieldOption: EarnYieldWithProvider) =>
  isYieldVisible(yieldOption) && isWalletNetwork(yieldOption.token.network);

/**
 * Whether the user could deposit into a yield picked for them: it is open to
 * deposits, needs no identity verification, and its minimum (the subsequent
 * one for a holder) fits the balance. An unknown balance (no wallet) does not
 * rule a minimum out.
 */
export const isReachableDefaultYield = ({
  availableAmount,
  positions,
  yieldOption,
}: {
  readonly availableAmount: BigNumber | null;
  readonly positions: PositionsData;
  readonly yieldOption: EarnYieldWithProvider;
}) =>
  yieldOption.status.enter &&
  yieldOption.mechanics.requirements?.kycRequired !== true &&
  (availableAmount === null ||
    !getMinStakeAmount(
      yieldOption,
      hasActivePositionForYield(positions, yieldOption.id)
    ).isGreaterThan(availableAmount));

export const resolveYield = ({
  entry,
  positions,
  previousYield,
  selectedYieldId,
  selectedToken,
  yieldOptions,
}: {
  entry: EarnEntry;
  positions: PositionsData;
  previousYield: EarnYieldWithProvider | null;
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

  if (previousYield) {
    const selected = findYieldById(yieldOptions, previousYield.id);
    if (selected) {
      return selected;
    }
  }

  const defaultYield = () =>
    getDefaultYield({
      availableAmount: selectedToken.amount,
      positions,
      providerOrder: entry.yieldProviderOrder ?? {},
      yieldOptions,
    });
  const preferredYieldId = getPreferredYieldId({
    preferredTokenYieldsPerNetwork:
      entry.preferredTokenYieldsPerNetwork ?? null,
    selectedToken,
  });
  if (preferredYieldId) {
    if (preferredYieldId === "*") {
      return defaultYield();
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

  return defaultYield();
};

const findYieldById = (
  yieldOptions: ReadonlyArray<EarnYieldWithProvider>,
  yieldId: YieldId
) =>
  yieldOptions.find(
    (yieldOption) => yieldOption.id.toLowerCase() === yieldId.toLowerCase()
  ) ?? null;

const pickDefaultYield = (
  yieldOptions: ReadonlyArray<EarnYieldWithProvider>,
  providerOrder: YieldProviderOrder
) =>
  getRankedDefaultYield(yieldOptions, providerOrder) ??
  yieldOptions.find(
    (yieldOption) =>
      yieldOption.status.enter && isNonZeroRewardRateYield(yieldOption)
  ) ??
  yieldOptions.find((yieldOption) => yieldOption.status.enter) ??
  yieldOptions[0] ??
  null;

/**
 * The yield a user lands on: one they can reach first, then the usual order
 * (ranked provider, a reward rate, open to deposits).
 */
const getDefaultYield = ({
  availableAmount,
  positions,
  providerOrder,
  yieldOptions,
}: {
  readonly availableAmount: BigNumber | null;
  readonly positions: PositionsData;
  readonly providerOrder: YieldProviderOrder;
  readonly yieldOptions: ReadonlyArray<EarnYieldWithProvider>;
}) =>
  pickDefaultYield(
    yieldOptions.filter((yieldOption) =>
      isReachableDefaultYield({ availableAmount, positions, yieldOption })
    ),
    providerOrder
  ) ?? pickDefaultYield(yieldOptions, providerOrder);

const getPreferredYieldId = ({
  preferredTokenYieldsPerNetwork,
  selectedToken,
}: {
  preferredTokenYieldsPerNetwork: EarnEntry["preferredTokenYieldsPerNetwork"];
  selectedToken: EarnTokenOption;
}) => {
  const tokenKey = hostTokenKey(selectedToken.token);
  const network = selectedToken.token.network;

  if (!isWalletNetwork(network)) return null;

  const networkPreferred = preferredTokenYieldsPerNetwork?.[network];

  return networkPreferred?.[tokenKey] ?? null;
};
