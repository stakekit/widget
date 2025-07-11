import type {
  ActionTypes,
  TokenDto,
  YieldDto,
  YieldMetadataDto,
} from "@stakekit/api-hooks";
import { motion } from "motion/react";
import { Just, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { CheckCircleIcon } from "../../../components/atoms/icons/check-circle";
import { Image } from "../../../components/atoms/image";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { TokenIcon } from "../../../components/atoms/token-icon";
import { Heading } from "../../../components/atoms/typography/heading";
import { Text } from "../../../components/atoms/typography/text";
import {
  type ExtendedYieldType,
  isEthenaUsdeStaking,
} from "../../../domain/types/yields";
import { AnimationPage } from "../../../navigation/containers/animation-page";
import { capitalizeFirstLowerRest } from "../../../utils/text";
import { PageContainer } from "../../components/page-container";
import { useComplete } from "../hooks/use-complete.hook";
import {
  CompleteCommonContextProvider,
  useCompleteCommonContext,
} from "../state";

type Props = {
  token: Maybe<TokenDto>;
  metadata: Maybe<YieldMetadataDto>;
  network: string;
  amount: string;
  pendingActionType?: ActionTypes;
  providersDetails: Maybe<
    {
      logo: string | undefined;
      name: string | undefined;
    }[]
  >;
  yieldType: Maybe<ExtendedYieldType>;
  integrationId: YieldDto["id"];
};

export const CompletePageComponent = ({
  amount,
  metadata,
  network,
  token,
  pendingActionType,
  yieldType,
  providersDetails,
  integrationId,
}: Props) => {
  const { t } = useTranslation();

  const { onViewTransactionClick, unstakeMatch, pendingActionMatch, urls } =
    useCompleteCommonContext();

  return (
    <AnimationPage>
      <PageContainer>
        <Box
          flex={1}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          my="4"
        >
          <Box
            flex={1}
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            textAlign="center"
          >
            {Maybe.fromRecord({ token, metadata })
              .map((v) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.1 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    transition: { delay: 0.2, duration: 0.3 },
                  }}
                >
                  <Box my="4">
                    <TokenIcon
                      metadata={v.metadata}
                      tokenLogoHw="32"
                      tokenNetworkLogoHw="8"
                      token={v.token}
                    />
                  </Box>
                </motion.div>
              ))
              .extractNullable()}

            <motion.div
              initial={{ opacity: 0, translateX: "-40px" }}
              animate={{
                opacity: 1,
                translateX: 0,
                transition: { delay: 0.2, duration: 0.8 },
              }}
            >
              <Heading overflowWrap="anywhere" variant={{ level: "h3" }}>
                {t(
                  unstakeMatch
                    ? "complete.successfully_unstaked"
                    : pendingActionMatch
                      ? "complete.successfully_pending_action"
                      : "complete.successfully_staked",
                  {
                    action: yieldType.mapOrDefault(
                      (yt) =>
                        unstakeMatch
                          ? t(`complete.unstake.${yt}`, {
                              context: isEthenaUsdeStaking(integrationId)
                                ? "ethena_usde"
                                : undefined,
                            })
                          : t(`complete.stake.${yt}`, {
                              context: isEthenaUsdeStaking(integrationId)
                                ? "ethena_usde"
                                : undefined,
                            }),
                      ""
                    ),
                    amount,
                    tokenNetwork: network,
                    pendingAction: t(
                      `complete.pending_action.${
                        pendingActionType?.toLowerCase() as Lowercase<ActionTypes>
                      }` as const,
                      {
                        context: isEthenaUsdeStaking(integrationId)
                          ? "ethena_usde"
                          : undefined,
                      }
                    ),
                  }
                )}
              </Heading>
            </motion.div>

            {!unstakeMatch && !pendingActionMatch
              ? providersDetails
                  .map((val) =>
                    val.map((v, i) => (
                      <Box
                        key={i}
                        display="flex"
                        marginTop="2"
                        justifyContent="center"
                        alignItems="center"
                        gap="1"
                      >
                        {v.logo && (
                          <Image
                            imageProps={{ borderRadius: "full" }}
                            containerProps={{ hw: "5" }}
                            src={v.logo}
                            fallback={
                              <ImageFallback
                                name={v.name || v.logo}
                                tokenLogoHw="5"
                              />
                            }
                          />
                        )}
                        <Text variant={{ type: "muted" }}>
                          {t("complete.via", { providerName: v.name })}
                        </Text>
                      </Box>
                    ))
                  )
                  .extractNullable()
              : null}

            {urls.map((val) => (
              <Box
                key={val.url}
                marginTop="4"
                display="flex"
                justifyContent="center"
                alignItems="center"
                as="button"
                onClick={() => onViewTransactionClick(val.url)}
              >
                <Box
                  marginRight="1"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                >
                  <CheckCircleIcon width={22} height={22} />
                </Box>
                <Text variant={{ type: "muted" }}>
                  {t("complete.view_transaction", {
                    type: Just(val.type)
                      .map((v) =>
                        t(`steps.tx_type.${v}`, {
                          context: isEthenaUsdeStaking(integrationId)
                            ? "ETHENA_USDE"
                            : undefined,
                        })
                      )
                      .map(capitalizeFirstLowerRest)
                      .extract(),
                  })}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </PageContainer>
    </AnimationPage>
  );
};

export const CompletePage = (props: Props) => {
  return (
    <CompleteCommonContextProvider value={useComplete()}>
      <CompletePageComponent {...props} />
    </CompleteCommonContextProvider>
  );
};
