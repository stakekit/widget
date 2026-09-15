import { type JSX, type ReactNode, useMemo } from "react";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import type { ValidatorKey } from "../../../../../domain/earn/validator";
import type { Token } from "../../../../../domain/token/token";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  ContentLoaderLine,
  ContentLoaderSquare,
} from "../../../../../shared/ui/primitives/content-loader";
import { ArrowsLeftRightIcon } from "../../../../../shared/ui/primitives/icons/arrows-left-right";
import { ClockClockWiseIcon } from "../../../../../shared/ui/primitives/icons/clock-clock-wise";
import { GifIcon } from "../../../../../shared/ui/primitives/icons/gift";
import { InfoIcon } from "../../../../../shared/ui/primitives/icons/info";
import type { TextVariants } from "../../../../../shared/ui/primitives/typography/styles.css";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useYieldMetaInfo } from "../../../react/use-yield-meta-info";

type MetaInfoTextSize = NonNullable<NonNullable<TextVariants>["size"]>;

type Props = {
  isLoading?: boolean;
  selectedStake: EarnYieldWithProvider | null;
  selectedValidators: Map<ValidatorKey, EarnValidator>;
  selectedToken: Token | null;
  textSize?: MetaInfoTextSize;
};

export const MetaInfo = ({
  isLoading,
  selectedStake,
  selectedToken,
  selectedValidators,
  textSize,
}: Props) => {
  const {
    description,
    earnPeriod,
    earnRewards,
    withdrawnNotAvailable,
    withdrawnTime,
    extra,
    campaign,
    lockupPeriod,
  } = useYieldMetaInfo({
    selectedStake,
    validators: [...selectedValidators.values()],
    tokenDto: selectedToken,
  });

  const items = useMemo(
    () =>
      [
        { text: description, icon: <ArrowsLeftRightIcon /> },
        { text: earnPeriod, icon: <ClockClockWiseIcon /> },
        { text: earnRewards, icon: <GifIcon /> },
        { text: withdrawnNotAvailable, icon: <InfoIcon /> },
        { text: withdrawnTime, icon: <InfoIcon /> },
        { text: extra, icon: <InfoIcon /> },
        { text: campaign, icon: <InfoIcon /> },
        { text: lockupPeriod, icon: <InfoIcon /> },
      ].filter(
        (val): val is { text: string | ReactNode; icon: JSX.Element } =>
          !!val.text
      ),
    [
      campaign,
      description,
      earnPeriod,
      earnRewards,
      withdrawnNotAvailable,
      withdrawnTime,
      extra,
      lockupPeriod,
    ]
  );

  return isLoading ? (
    <MetaInfoSkeleton textSize={textSize} />
  ) : (
    <MetaInfoRows items={items} textSize={textSize} />
  );
};

const loadingRows = ["90%", "75%", "60%"].map((width) => ({
  icon: <ContentLoaderSquare />,
  text: <ContentLoaderLine widthPx={width} />,
}));

export const MetaInfoSkeleton = ({
  textSize,
}: {
  textSize?: MetaInfoTextSize;
}) => <MetaInfoRows items={loadingRows} textSize={textSize} />;

const MetaInfoRows = ({
  items,
  textSize,
}: {
  items: ReadonlyArray<{ icon: ReactNode; text: ReactNode }>;
  textSize?: MetaInfoTextSize;
}) => (
  <Box as="footer" gap="3" display="flex" flexDirection="column">
    {items.map((item, i) => (
      <Box key={i} display="flex" alignItems="center" gap="4">
        <Box
          hw="4"
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
          display="flex"
        >
          {item.icon}
        </Box>

        <Box flex={1} minWidth="0">
          <Text variant={{ weight: "normal", type: "muted", size: textSize }}>
            {item.text}
          </Text>
        </Box>
      </Box>
    ))}
  </Box>
);
