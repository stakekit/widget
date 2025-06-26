import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { ArrowsLeftRightIcon } from "@sk-widget/components/atoms/icons/arrows-left-right";
import { ClockClockWiseIcon } from "@sk-widget/components/atoms/icons/clock-clock-wise";
import { GifIcon } from "@sk-widget/components/atoms/icons/gift";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { useYieldMetaInfo } from "@sk-widget/hooks/use-yield-meta-info";
import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { type JSX, type ReactNode, useMemo } from "react";
import { dotContainer, dotText } from "./styles.css";

type Props = {
  isLoading?: boolean;
  selectedStake: Maybe<YieldDto>;
  selectedValidators: Map<string, ValidatorDto>;
  selectedToken: Maybe<TokenDto>;
};

export const MetaInfo = ({
  isLoading,
  selectedStake,
  selectedToken,
  selectedValidators,
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
            <Text variant={{ weight: "normal", type: "muted" }}>
              {item.text}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
