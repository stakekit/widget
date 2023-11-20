import { useTranslation } from "react-i18next";
import { Box, Button, Heading, Text } from "../../../components";
import { PageContainer } from "../../components";
import { CheckCircleIcon } from "../../../components/atoms/icons/check-circle";
import { useComplete } from "../hooks/use-complete.hook";
import { TokenIcon } from "../../../components/atoms/token-icon";
import {
  ActionTypes,
  TokenDto,
  YieldMetadataDto,
  YieldType,
} from "@stakekit/api-hooks";
import { Just, Maybe } from "purify-ts";
import { ImageFallback } from "../../../components/atoms/image-fallback";
import { Image } from "../../../components/atoms/image";
import {
  capitalizeFirstLowerRest,
  removeUnderscores,
} from "../../../utils/text";

type Props = {
  token: Maybe<TokenDto>;
  metadata: Maybe<YieldMetadataDto>;
  network: string;
  amount: string;
  pendingActionType?: ActionTypes;
  providerDetails: Maybe<{
    logo: string;
    name: string;
  }>;
  yieldType: Maybe<YieldType>;
};

export const CompletePage = ({
  amount,
  metadata,
  network,
  token,
  pendingActionType,
  yieldType,
  providerDetails,
}: Props) => {
  const { t } = useTranslation();

  const {
    onClick,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    urls,
  } = useComplete();

  return (
    <PageContainer>
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
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
              <Box marginBottom="4">
                <TokenIcon
                  metadata={v.metadata}
                  tokenLogoHw="32"
                  tokenNetworkLogoHw="8"
                  token={v.token}
                />
              </Box>
            ))
            .extractNullable()}

          <Heading variant={{ level: "h3" }}>
            {t(
              unstakeMatch
                ? "complete.successfully_unstaked"
                : pendingActionMatch
                  ? `complete.successfully_pending_action`
                  : "complete.successfully_staked",
              {
                action: yieldType.mapOrDefault(
                  (yt) =>
                    unstakeMatch
                      ? t(`complete.unstake.${yt}`)
                      : t(`complete.stake.${yt}`),
                  ""
                ),
                amount,
                tokenNetwork: network,
                pendingAction: t(
                  `complete.pending_action.${
                    pendingActionType?.toLowerCase() as Lowercase<ActionTypes>
                  }`
                ),
              }
            )}
          </Heading>

          {!unstakeMatch && !pendingActionMatch
            ? providerDetails
                .map((v) => (
                  <Box
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
                          <ImageFallback name={v.name} tokenLogoHw="5" />
                        }
                      />
                    )}
                    <Text variant={{ type: "muted" }}>
                      {t("complete.via", { providerName: v.name })}
                    </Text>
                  </Box>
                ))
                .extractNullable()
            : null}

          {urls.map((val) => (
            <Box
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
                    .map(removeUnderscores)
                    .map(capitalizeFirstLowerRest)
                    .extract(),
                })}
              </Text>
            </Box>
          ))}
        </Box>

        <Box display="flex" alignItems="flex-end" marginTop="8">
          <Button onClick={onClick}>{t("shared.ok")}</Button>
        </Box>
      </Box>
    </PageContainer>
  );
};
