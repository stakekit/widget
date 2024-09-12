import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { ToolTip } from "@sk-widget/components/atoms/tooltip";
import ReviewTopSection from "@sk-widget/pages/review/pages/common-page/components/review-top-section";
import TermsOfUse from "@sk-widget/pages/review/pages/common-page/components/terms-of-use";
import type { FeesBps } from "@sk-widget/pages/review/types";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Divider } from "../../../../components";
import { Box } from "../../../../components/atoms/box";
import { Text } from "../../../../components/atoms/typography";
import { WarningBox } from "../../../../components/atoms/warning-box";
import type { RewardTokenDetails } from "../../../../components/molecules/reward-token-details";
import { useTrackPage } from "../../../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../../../navigation/containers/animation-page";
import { PageContainer } from "../../../components";
import { MetaInfo } from "../../../components/meta-info";
import { feeStyles } from "../style.css";

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
  useTrackPage("stakeReview");

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

        <TermsOfUse {...rest} />
      </PageContainer>
    </AnimationPage>
  );
};

const GasFee = ({
  label,
  price,
  loading,
}: { label: string; price: string; loading: boolean }) => {
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
