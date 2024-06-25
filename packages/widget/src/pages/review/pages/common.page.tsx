import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import type { TokenDto, YieldMetadataDto } from "@stakekit/api-hooks";
import { motion } from "framer-motion";
import { Maybe } from "purify-ts";
import type { ComponentProps, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Divider } from "../../../components";
import { Box } from "../../../components/atoms/box";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Heading, Text } from "../../../components/atoms/typography";
import { WarningBox } from "../../../components/atoms/warning-box";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { PageContainer } from "../../components";
import { MetaInfo } from "../../components/meta-info";
import { feeStyles, headingStyles, pointerStyles } from "./style.css";

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
  ...rest
}: ReviewPageProps) => {
  useTrackPage("stakeReview");

  const trackEvent = useTrackEvent();

  const { t } = useTranslation();

  return (
    <AnimationPage>
      <PageContainer>
        <Box marginBottom="4">
          <motion.div
            initial={{ opacity: 0, translateY: "-20px" }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 1 }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginBottom="1"
            >
              <Heading variant={{ level: "h1" }}>{title}</Heading>
              {Maybe.fromRecord({ token, metadata })
                .map((val) => (
                  <TokenIcon token={val.token} metadata={val.metadata} />
                ))
                .extractNullable()}
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, translateY: "-20px" }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <Heading
              variant={{ level: "h2" }}
              overflowWrap="anywhere"
              className={headingStyles}
            >
              {info}
            </Heading>
          </motion.div>

          {rewardTokenDetailsProps
            .filter((v) => v.type === "stake")
            .map(() => (
              <Box marginTop="2">
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {t("review.estimated_reward")}
                </Text>
              </Box>
            ))
            .extractNullable()}
        </Box>

        <Divider />

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="4"
        >
          <Text variant={{ weight: "semibold" }}>{t("shared.fees")}</Text>
        </Box>

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="2"
          marginBottom="4"
          data-testid="estimated_gas_fee"
        >
          <Text variant={{ weight: "normal", type: "muted" }}>
            {t("review.estimated_gas_fee")}
          </Text>
          {loading ? (
            <Box width="40">
              <ContentLoaderSquare heightPx={16} variant={{ size: "medium" }} />
            </Box>
          ) : (
            <Text
              className={feeStyles}
              variant={{ type: "muted", weight: "normal" }}
            >
              {fee}
            </Text>
          )}
        </Box>

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
                  // biome-ignore lint/a11y/useAnchorContent: <explanation>
                  <a
                    target="_blank"
                    onClick={() => trackEvent("termsClicked")}
                    href="https://docs.stakek.it/docs/terms-of-use"
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
