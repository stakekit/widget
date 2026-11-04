import { useAtomValue } from "@effect/atom-react";
import { capitalize, toLowerCase } from "effect/String";
import { useTranslation } from "react-i18next";
import type {
  PendingActionLabelContext,
  YieldPendingActionType,
} from "../../../../../domain/action/pending-action";
import type { ConfidentialBatchSide } from "../../../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  type ExtendedYieldType,
  isEthenaUsdeStaking,
  type YieldMetadata,
} from "../../../../../domain/earn/yield";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { Token } from "../../../../../domain/token/token";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import {
  Avatar,
  Box,
  ExternalLink,
  Stack,
  Text,
  TokenAvatar,
} from "../../../../../ui/index";
import {
  AnimationPage,
  PageContainer,
  PageCtaButton,
} from "../../../../widget-shell/views";
import { formatNextBatchTiming } from "../../../../yield-summary/index";
import { formatTransactionTypeLabel } from "../../../model/yield-transaction-workflow";
import { useComplete } from "../hooks/use-complete.hook";

type CompletePageModel = ReturnType<typeof useComplete>;

type Props = {
  completion: CompletePageModel;
  token: Token | null;
  metadata: Pick<YieldMetadata, "logoURI" | "name" | "provider"> | null;
  network: string;
  amount: string;
  pendingActionType?: YieldPendingActionType;
  pendingActionLabelContext?: PendingActionLabelContext | undefined;
  /** The request was queued into this vault's next batch, not settled. */
  batched?: BatchedRequest | null;
  /** The Exit Receive Token an exit pays out, as Review showed it. */
  receiveToken?: Readonly<{ readonly symbol: string }> | null;
  providersDetails: ReadonlyArray<{
    logo?: string | undefined;
    name?: string;
  }> | null;
  yieldType: ExtendedYieldType | null;
  integrationId: YieldId;
};

type BatchedRequest = Readonly<{
  readonly side: ConfidentialBatchSide;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type CompletePageProps = Omit<Props, "completion">;

export const CompletePageComponent = ({
  amount,
  metadata,
  network,
  token,
  pendingActionType,
  pendingActionLabelContext,
  batched = null,
  receiveToken = null,
  yieldType,
  providersDetails,
  integrationId,
  completion,
}: Props) => {
  const { t } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const resolveTokenLogo = useTokenLogoResolver();

  const {
    cta,
    onViewTransactionClick,
    unstakeMatch,
    pendingActionMatch,
    urls,
  } = completion;
  const translationOptions = isEthenaUsdeStaking(integrationId)
    ? { context: "ethena_usde" }
    : {};
  const typeContext = isEthenaUsdeStaking(integrationId)
    ? "ETHENA_USDE"
    : undefined;
  const getSuccessKey = () => {
    if (batched?.side === "redemption") {
      return "complete.withdrawal_submitted" as const;
    }
    if (unstakeMatch) return "complete.successfully_unstaked" as const;
    if (pendingActionMatch) {
      return "complete.successfully_pending_action" as const;
    }
    if (batched) return "complete.deposit_submitted" as const;
    return "complete.successfully_staked" as const;
  };
  const successKey = getSuccessKey();

  const getAction = () => {
    if (!yieldType) return "";
    if (unstakeMatch) {
      return t(`complete.unstake.${yieldType}`, translationOptions);
    }
    return t(`complete.stake.${yieldType}`, translationOptions);
  };
  const action = getAction();
  const pendingAction = pendingActionType
    ? {
        pendingAction: t(
          `complete.pending_action.${toLowerCase(pendingActionType)}`,
          pendingActionLabelContext === undefined
            ? translationOptions
            : { context: pendingActionLabelContext }
        ),
      }
    : {};
  const nextBatch = batched
    ? formatNextBatchTiming({
        now: presentationTime?.now ?? null,
        side: batched.side,
        t,
        yieldDto: batched.yieldDto,
      })
    : null;
  const getNextBatchNote = () => {
    if (!nextBatch) return null;
    return nextBatch._tag === "due"
      ? t("complete.next_batch_imminent")
      : t("complete.next_batch_in", { duration: nextBatch.duration });
  };
  const nextBatchNote = getNextBatchNote();

  return (
    <AnimationPage>
      <PageContainer>
        <Box paddingBlock={16} grow>
          <Stack align="center" justify="center" gap={8}>
            {token && metadata ? (
              <Box paddingBlock={16}>
                <TokenAvatar
                  {...resolveTokenLogo(token, { metadata })}
                  size="xl"
                />
              </Box>
            ) : null}

            <Text variant="title" as="h1" align="center" breakAnywhere>
              {t(successKey, {
                action,
                amount,
                tokenNetwork: network,
                ...pendingAction,
              })}
            </Text>

            {receiveToken ? (
              <Text as="p" tone="muted" align="center">
                {t("complete.receive_token", { symbol: receiveToken.symbol })}
              </Text>
            ) : null}

            {nextBatchNote ? (
              <Text as="p" tone="muted" align="center">
                {nextBatchNote}
              </Text>
            ) : null}

            {!unstakeMatch && !pendingActionMatch
              ? providersDetails?.map((provider, index) => (
                  <Stack
                    key={provider.name ?? provider.logo ?? index}
                    direction="row"
                    align="center"
                    justify="center"
                    gap={4}
                  >
                    {provider.logo && (
                      <Avatar
                        src={provider.logo}
                        fallback={provider.name || provider.logo}
                        size="xs"
                      />
                    )}
                    <Text tone="muted">
                      {t("complete.via", { providerName: provider.name })}
                    </Text>
                  </Stack>
                ))
              : null}

            {urls.length > 0 && (
              <Stack align="center" gap={8}>
                {urls.map((val) => (
                  <Text key={val.url} as="p">
                    <ExternalLink
                      href={val.url}
                      newTabLabel={t("shared.opens_in_new_tab")}
                      onClick={onViewTransactionClick}
                    >
                      {t("complete.view_transaction", {
                        type: capitalize(
                          toLowerCase(
                            formatTransactionTypeLabel(val.type, t, {
                              context: typeContext,
                            })
                          )
                        ),
                      })}
                    </ExternalLink>
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
        <PageCtaButton cta={cta} />
      </PageContainer>
    </AnimationPage>
  );
};

export const CompletePage = (props: CompletePageProps) => {
  return <CompletePageComponent {...props} completion={useComplete()} />;
};
