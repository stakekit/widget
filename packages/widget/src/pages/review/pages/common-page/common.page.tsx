import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Divider } from "../../../../components/atoms/divider";
import { InfoIcon } from "../../../../components/atoms/icons/info";
import { ToolTip } from "../../../../components/atoms/tooltip";
import { Text } from "../../../../components/atoms/typography/text";
import { WarningBox } from "../../../../components/atoms/warning-box";
import type { RewardTokenDetails } from "../../../../components/molecules/reward-token-details";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { AnimationPage } from "../../../../navigation/containers/animation-page";
import { MetaInfo } from "../../../components/meta-info";
import { PageContainer } from "../../../components/page-container";
import type { FeesBps } from "../../types";
import { feeStyles, pointerStyles } from "../style.css";
import ReviewTopSection from "./components/review-top-section";

export type MetaInfoProps =
  | { showMetaInfo: true; metaInfoProps: ComponentProps<typeof MetaInfo> }
  | { showMetaInfo: false; metaInfoProps?: never };

type ReviewPageProps = {
  fee: string;
  title: string;
  token: Maybe<TokenDto>;
  metadata: Maybe<YieldMetadataDto>;
  info: ReactNode;
  rewardTokenDetailsProps: Maybe<ComponentProps<typeof RewardTokenDetails>>;
  isGasCheckError: boolean;
  loading?: boolean;
  depositFee: Maybe<FeesBps>;
  managementFee: Maybe<FeesBps>;
  performanceFee: Maybe<FeesBps>;
  feeConfigLoading?: boolean;
} & MetaInfoProps;

export const ReviewPage = ({
  fee,
  title,
  token,
  metadata,
  info,
  rewardTokenDetailsProps,
  isGasCheckError,
  loading = false,
  depositFee,
  managementFee,
  performanceFee,
  feeConfigLoading = false,
  ...rest
}: ReviewPageProps) => {
  const trackEvent = useTrackEvent();
  const { t } = useTranslation();

  const isLoading = loading || feeConfigLoading;

  return (
    <AnimationPage>
      <PageContainer>
        <ReviewTopSection
          info={info}
          metadata={metadata}
          rewardTokenDetailsProps={rewardTokenDetailsProps}
          title={title}
          token={token}
        />

        <Divider />

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="4"
        >
          <Text variant={{ weight: "semibold" }}>{t("shared.fees")}</Text>
        </Box>

        <GasFee
          label={t("review.estimated_gas_fee")}
          price={fee}
          loading={isLoading}
        />

        {!isLoading && (
          <>
            {depositFee
              .map((val) => <ConfigFee feesBps={val} />)
              .extractNullable()}
            {managementFee
              .map((val) => <ConfigFee feesBps={val} />)
              .extractNullable()}
            {performanceFee
              .map((val) => <ConfigFee feesBps={val} />)
              .extractNullable()}
          </>
        )}

        {isGasCheckError && (
          <Box marginBottom="2">
            <WarningBox text="This action is unlikely to succeed due to insufficient funds to cover gas fees" />
          </Box>
        )}

        <Divider />

        {rest.showMetaInfo && (
          <>
            <Box marginBottom="4">
              <Box my="4">
                <Text variant={{ weight: "semibold" }}>
                  {t("review.additional_info")}
                </Text>
              </Box>

              <MetaInfo {...rest.metaInfoProps} />
            </Box>

            <Divider />
          </>
        )}

        <Box marginTop="4" marginBottom={rest.showMetaInfo ? "4" : "16"}>
          <Text variant={{ weight: "normal", type: "muted" }}>
            <Trans
              i18nKey="review.terms_of_use"
              components={{
                underline0: (
                  // biome-ignore lint: false
                  <a
                    target="_blank"
                    onClick={() => trackEvent("termsClicked")}
                    href="https://docs.yield.xyz/docs/terms-of-use"
                    className={pointerStyles}
                    rel="noreferrer"
                  />
                ),
              }}
            />
          </Text>
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};

const GasFee = ({
  label,
  price,
  loading,
}: {
  label: string;
  price: string;
  loading: boolean;
}) => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      marginTop="2"
      marginBottom="2"
      data-testid="estimated_gas_fee"
      height="4"
    >
      <Text variant={{ weight: "normal", type: "muted" }}>{label}</Text>
      {loading ? (
        <Box width="40">
          <ContentLoaderSquare heightPx={16} variant={{ size: "medium" }} />
        </Box>
      ) : (
        <Text
          className={feeStyles}
          variant={{ type: "muted", weight: "normal" }}
        >
          {price}
        </Text>
      )}
    </Box>
  );
};

const ConfigFee = ({ feesBps }: { feesBps: FeesBps }) => {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      data-testid="estimated_gas_fee"
      marginBottom="2"
    >
      <Box display="flex" alignItems="center" justifyContent="center" gap="1">
        <Text variant={{ weight: "normal", type: "muted" }}>
          {feesBps.label}
        </Text>

        <ToolTip label={feesBps.explanation}>
          <Box display="flex">
            <InfoIcon />
          </Box>
        </ToolTip>
      </Box>

      <ToolTip label={feesBps.inUSD}>
        <Text
          className={feeStyles}
          variant={{ weight: "normal", type: "muted" }}
        >
          {feesBps.inPercentage}
        </Text>
      </ToolTip>
    </Box>
  );
};
