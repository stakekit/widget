import { type JSX, type ReactNode, useMemo } from "react";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { ArrowsLeftRightIcon } from "../../../components/atoms/icons/arrows-left-right";
import { ClockClockWiseIcon } from "../../../components/atoms/icons/clock-clock-wise";
import { GifIcon } from "../../../components/atoms/icons/gift";
import { InfoIcon } from "../../../components/atoms/icons/info";
import type { TextVariants } from "../../../components/atoms/typography/styles.css";
import { Text } from "../../../components/atoms/typography/text";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";

import type { ValidatorKey } from "../../../domain/types/validators";

import { useYieldMetaInfo } from "../../../hooks/use-yield-meta-info";
import { dotContainer, dotText } from "./styles.css";

type MetaInfoTextSize = NonNullable<NonNullable<TextVariants>["size"]>;

type Props = {
  isLoading?: boolean;
  selectedStake: EarnYieldWithProvider | null;
  selectedValidators: Map<ValidatorKey, EarnValidator>;
  selectedToken: AppToken | null;
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
    <ContentLoaderSquare heightPx={150} />
  ) : (
    <Box as="footer" gap="3" display="flex" flexDirection="column">
      {items.map((item, i) => (
        <Box key={i} display="flex" alignItems="center" gap="4">
          <Box alignItems="center" justifyContent="center" display="flex">
            {item.icon ? (
              item.icon
            ) : (
              <Box className={dotContainer}>
                <Text
                  className={dotText}
                  variant={{ weight: "normal", type: "muted" }}
                >
                  {"\u2B24"}
                </Text>
              </Box>
            )}
          </Box>

          <Box>
            <Text variant={{ weight: "normal", type: "muted", size: textSize }}>
              {item.text}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
