import type { ReactNode } from "react";

import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../../../domain/earn/validator";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import type { Token } from "../../../../../domain/token/token";
import {
  type FixedIconName,
  Icon,
  Skeleton,
  Stack,
  Text,
} from "../../../../../ui/index";
import { useYieldMetaInfo } from "../../use-yield-meta-info";

type MetaInfoItem = {
  readonly text: ReactNode;
  readonly icon: FixedIconName;
};

type Props = {
  isLoading?: boolean;
  selectedStake: EarnYieldWithProvider | null;
  selectedValidators: Map<EarnValidatorKey, EarnValidator>;
  selectedToken: Token | null;
  /** `small` sets the notes in the caption role. */
  textSize?: "small" | "medium" | undefined;
  /** Notes from beyond the yield, such as its campaign's, after its rewards. */
  notes?: ReadonlyArray<MetaInfoItem> | undefined;
};

export const MetaInfo = ({
  isLoading,
  selectedStake,
  selectedToken,
  selectedValidators,
  textSize,
  notes = [],
}: Props) => {
  const {
    description,
    earnPeriod,
    earnRewards,
    withdrawnNotAvailable,
    withdrawnTime,
    extra,
    confidentialIncentives,
    lockupPeriod,
  } = useYieldMetaInfo({
    selectedStake,
    validators: [...selectedValidators.values()],
    tokenDto: selectedToken,
  });

  if (isLoading) {
    return (
      <Stack gap={12} aria-busy>
        <Skeleton shape="line" />
        <Skeleton shape="line" width="threeQuarters" />
        <Skeleton shape="line" width="half" />
      </Stack>
    );
  }

  const items: ReadonlyArray<MetaInfoItem> = [
    { text: description, icon: "ArrowsLeftRightIcon" as const },
    { text: earnPeriod, icon: "HistoryIcon" as const },
    { text: earnRewards, icon: "GiftIcon" as const },
    ...notes,
    { text: withdrawnNotAvailable, icon: "InfoIcon" as const },
    { text: withdrawnTime, icon: "InfoIcon" as const },
    { text: extra, icon: "InfoIcon" as const },
    { text: confidentialIncentives, icon: "InfoIcon" as const },
    { text: lockupPeriod, icon: "InfoIcon" as const },
  ].filter((item) => !!item.text);

  return (
    <Stack as="footer" gap={12}>
      {items.map((item, i) => (
        <Stack key={i} direction="row" align="center" gap={16}>
          <Icon name={item.icon} size="sm" tone="muted" />
          <Text
            variant={textSize === "small" ? "caption" : "body"}
            tone="muted"
          >
            {item.text}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
};
