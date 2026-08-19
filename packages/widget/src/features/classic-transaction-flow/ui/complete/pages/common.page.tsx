import { capitalize, toLowerCase } from "effect/String";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/action/pending-action";
import {
  type ExtendedYieldType,
  isEthenaUsdeStaking,
} from "../../../../../domain/earn/yield";
import type { Token } from "../../../../../domain/token/token";
import { TokenIcon } from "../../../../../shared/ui/components/token-icon";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CheckCircleIcon } from "../../../../../shared/ui/primitives/icons/check-circle";
import { Image } from "../../../../../shared/ui/primitives/image";
import { Heading } from "../../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { useComplete } from "../hooks/use-complete.hook.ts";

type CompletePageModel = ReturnType<typeof useComplete>;

type Props = {
  completion: CompletePageModel;
  token: Token | null;
  metadata: ComponentProps<typeof TokenIcon>["metadata"] | null;
  network: string;
  amount: string;
  pendingActionType?: YieldPendingActionType;
  providersDetails: ReadonlyArray<{
    logo?: string;
    name?: string;
  }> | null;
  yieldType: ExtendedYieldType | null;
  integrationId: string;
};

type CompletePageProps = Omit<Props, "completion">;

export const CompletePageComponent = ({
  amount,
  metadata,
  network,
  token,
  pendingActionType,
  yieldType,
  providersDetails,
  integrationId,
  completion,
}: Props) => {
  const { t } = useTranslation();

  const {
    cta,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    urls,
  } = completion;
  const translationContext = isEthenaUsdeStaking(integrationId)
    ? "ethena_usde"
    : undefined;
  const getSuccessKey = () => {
    if (unstakeMatch) return "complete.successfully_unstaked" as const;
    if (pendingActionMatch) {
      return "complete.successfully_pending_action" as const;
    }
    return "complete.successfully_staked" as const;
  };
  const successKey = getSuccessKey();

  const getAction = () => {
    if (!yieldType) return "";
    if (unstakeMatch) {
      return t(`complete.unstake.${yieldType}`, {
        context: translationContext,
      });
    }
    return t(`complete.stake.${yieldType}`, {
      context: translationContext,
    });
  };
  const action = getAction();

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
            {token && metadata ? (
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
                    tokenLogoHw="32"
                    tokenNetworkLogoHw="8"
                    token={token}
                    metadata={metadata}
                  />
                </Box>
              </motion.div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, translateX: "-40px" }}
              animate={{
                opacity: 1,
                translateX: 0,
                transition: { delay: 0.2, duration: 0.8 },
              }}
            >
              <Heading overflowWrap="anywhere" variant={{ level: "h3" }}>
                {t(successKey, {
                  action,
                  amount,
                  tokenNetwork: network,
                  pendingAction: t(
                    `complete.pending_action.${
                      pendingActionType?.toLowerCase() as Lowercase<YieldPendingActionType>
                    }` as const,
                    {
                      context: translationContext,
                    }
                  ),
                })}
              </Heading>
            </motion.div>

            {!unstakeMatch && !pendingActionMatch
              ? providersDetails?.map((v, i) => (
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
                        imgProps={{ borderRadius: "full" }}
                        wrapperProps={{ hw: "5" }}
                        src={v.logo}
                        fallbackName={v.name || v.logo}
                      />
                    )}
                    <Text variant={{ type: "muted" }}>
                      {t("complete.via", { providerName: v.name })}
                    </Text>
                  </Box>
                ))
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
                    type: capitalize(
                      toLowerCase(
                        t(
                          `steps.tx_type.${val.type}` as never,
                          {
                            context: isEthenaUsdeStaking(integrationId)
                              ? "ETHENA_USDE"
                              : undefined,
                          } as never
                        ) as unknown as string
                      )
                    ),
                  })}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
        <PageCtaButton cta={cta} />
      </PageContainer>
    </AnimationPage>
  );
};

export const CompletePage = (props: CompletePageProps) => {
  return <CompletePageComponent {...props} completion={useComplete()} />;
};
