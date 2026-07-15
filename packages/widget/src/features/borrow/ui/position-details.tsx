import { useAtomSet } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import clsx from "clsx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import { useTrackPage } from "../../../features/tracking";
import { AnimationPage } from "../../../features/widget-shell";
import { formatNumber } from "../../../shared/lib";
import { formatCompactUsd } from "../../../shared/lib/formatters";
import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import {
  ContentLoaderCircle,
  ContentLoaderLine,
} from "../../../shared/ui/primitives/content-loader";
import { Image } from "../../../shared/ui/primitives/image";
import { ListItem } from "../../../shared/ui/primitives/list/list-item";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { AddressRow, DetailRow, DetailsSection } from "../../earn/support";
import { useTokenBalancesScan } from "../../portfolio";
import {
  breadcrumb,
  breadcrumbName,
  posistionDetailsInfoContainer,
  positionDetailsActionsContainer,
  positionDetailsDashboardStyles as positionDetailsStyles,
} from "../../position-details/support";
import {
  BackButton,
  BackButtonProvider,
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  Divider,
  MaxButton,
  NumberInput,
  PageCtaButton,
  TabPageContainer,
  TokenIcon,
  VerticalDivider,
} from "../../widget-shell";
import {
  type BorrowWithdrawTokenOption,
  borrowActionFormAtom,
  buildCollateralToggleActionRequest,
  buildRepayActionRequest,
  buildWithdrawActionRequest,
  deriveBorrowTokenWalletBalance,
  projectLtvRatio,
} from "../core";
import { getBorrowMarketPairLabel } from "./model";
import {
  type BorrowPositionAction,
  borrowTokenToTokenDto,
  getBorrowPositionActions,
  getBorrowPositionDetailsModel,
} from "./position-details-model";
import type { BorrowReviewState } from "./review-state";
import * as styles from "./styles.css";
import { useBorrowPosition } from "./use-borrow-positions";

type BorrowPositionContext = {
  readonly actions: BorrowPositionAction[];
  readonly borrowPosition: ReturnType<typeof useBorrowPosition>;
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly position: ReturnType<typeof getPositionFromResult>;
};

const getPositionFromResult = (
  borrowPosition: ReturnType<typeof useBorrowPosition>
) =>
  AsyncResult.isSuccess(borrowPosition.positionResult)
    ? borrowPosition.positionResult.value
    : null;

const formatPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${formatNumber(value * 100, 2)}%`;

const BorrowPositionBreadcrumb = ({
  backPath = "/manage",
  positionName,
}: {
  readonly backPath?: string;
  readonly positionName: string | null;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <BackButtonProvider>
      <Box className={breadcrumb}>
        <BackButton
          data-testid="borrow-position-details-back"
          onClick={() => navigate(backPath)}
        />

        <Text variant={{ weight: "bold" }}>
          {t("dashboard.position_details.breadcrumb_root")}
        </Text>

        {positionName ? (
          <Text
            className={breadcrumbName}
            variant={{ type: "muted", weight: "normal" }}
          >
            {`/ ${positionName}`}
          </Text>
        ) : null}
      </Box>
    </BackButtonProvider>
  );
};

const MetricCards = ({
  cards,
  healthFactor,
}: {
  cards: ReturnType<typeof getBorrowPositionDetailsModel>["metricCards"];
  readonly healthFactor: number | null | undefined;
}) => (
  <Box className={positionDetailsStyles.metricGrid}>
    {cards.map((card) => {
      const isHealthCard = card.id === "health-factor";
      const toneClass =
        !isHealthCard || healthFactor == null
          ? undefined
          : healthFactor < 1
            ? styles.healthValueDanger
            : healthFactor < 2
              ? styles.healthValueWarning
              : styles.healthValue;

      return (
        <Box
          className={positionDetailsStyles.metricCard({ tone: "default" })}
          display="flex"
          flexDirection="column"
          gap="1"
          key={card.id}
        >
          <Text
            className={positionDetailsStyles.metricLabelText}
            variant={{ type: "muted", weight: "normal" }}
          >
            {card.label}
          </Text>

          {typeof card.value === "string" ? (
            <Text
              className={clsx(
                positionDetailsStyles.metricValueText({
                  tone: "default",
                }),
                toneClass
              )}
              variant={{ weight: "bold" }}
            >
              {card.value}
            </Text>
          ) : (
            <Box>{card.value}</Box>
          )}

          {card.subValue && (
            <Text
              className={positionDetailsStyles.metricSubValueText}
              variant={{ type: "muted", weight: "normal" }}
            >
              {card.subValue}
            </Text>
          )}
        </Box>
      );
    })}
  </Box>
);

const LtvGauge = ({
  currentLtv,
  liquidationThreshold,
}: {
  readonly currentLtv: number | null;
  readonly liquidationThreshold: number | null;
}) => {
  const { t } = useTranslation();

  if (currentLtv == null) {
    return null;
  }

  const clampedLtv = Math.max(0, Math.min(100, currentLtv * 100));
  const clampedThreshold =
    liquidationThreshold == null
      ? null
      : Math.max(0, Math.min(100, liquidationThreshold * 100));

  return (
    <Box className={styles.ltvGauge}>
      <Box display="flex" justifyContent="space-between" gap="2">
        <Text variant={{ weight: "bold" }}>
          {t("dashboard.borrow.position_details.loan_to_value")}
        </Text>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {formatPercent(currentLtv)}
        </Text>
      </Box>

      <Box className={styles.ltvGaugeTrack}>
        {clampedThreshold == null ? null : (
          <Box
            className={styles.ltvGaugeThreshold}
            style={{ left: `${clampedThreshold}%` }}
          />
        )}
        <Box
          className={styles.ltvGaugeMarker}
          style={{ left: `${clampedLtv}%` }}
        />
      </Box>

      <Box className={styles.ltvGaugeLabels}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.borrow.position_details.low_risk")}
        </Text>
        {liquidationThreshold == null ? null : (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.position_details.liquidation_at", {
              value: formatPercent(liquidationThreshold),
            })}
          </Text>
        )}
      </Box>
    </Box>
  );
};

const CollateralList = ({
  actions,
  items,
  onActionSelect,
  totalCollateralUsd,
}: {
  readonly actions: BorrowPositionAction[];
  readonly items: ReturnType<
    typeof getBorrowPositionDetailsModel
  >["collateralItems"];
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly totalCollateralUsd: string;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(items.length <= 1);

  if (items.length === 0) {
    return null;
  }

  const getToggleAction = (
    item: (typeof items)[number]
  ): BorrowPositionAction | null => {
    const toggle = item.collateralToggleAction;

    if (!toggle) {
      return null;
    }

    return (
      actions.find(
        (action) =>
          action.type === toggle.action.type &&
          action.pendingContext.type === toggle.action.type &&
          action.pendingContext.supplyBalance.tokenAddress ===
            toggle.supplyBalance.tokenAddress
      ) ?? null
    );
  };

  return (
    <Box className={styles.collateralList}>
      <CollapsibleRoot
        collapsed={!expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <CollapsibleTrigger
          as="button"
          className={styles.collateralListButton}
          type="button"
        >
          <Text variant={{ weight: "bold" }}>
            {t("dashboard.borrow.position_details.collateral_list")}
          </Text>
          <CollapsibleArrow />
          <Box flex={1} textAlign="right">
            <Text variant={{ type: "muted", weight: "normal" }}>
              {totalCollateralUsd}
            </Text>
          </Box>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Box display="flex" flexDirection="column" gap="2">
            {items.map((item) => {
              const toggleAction = getToggleAction(item);

              return (
                <Box className={styles.collateralRow} key={item.id}>
                  <Box minWidth="0">
                    <Text variant={{ weight: "bold" }}>{item.label}</Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {item.supplyRate}
                    </Text>
                  </Box>

                  <Box minWidth="0" textAlign="right">
                    <Text>{item.balance}</Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {item.balanceUsd}
                    </Text>
                  </Box>

                  {toggleAction ? (
                    <Box
                      as="button"
                      aria-label={toggleAction.label}
                      className={clsx(
                        styles.switchButton,
                        item.isCollateral && styles.switchButtonChecked
                      )}
                      onClick={() => onActionSelect(toggleAction)}
                      type="button"
                    >
                      <Box
                        className={clsx(
                          styles.switchThumb,
                          item.isCollateral && styles.switchThumbChecked
                        )}
                      />
                    </Box>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </CollapsibleContent>
      </CollapsibleRoot>
    </Box>
  );
};

const BorrowPositionInfo = ({
  actions,
  content,
  model,
  onActionSelect,
  position,
}: {
  readonly actions: BorrowPositionAction[];
  readonly content: "details" | "fallback";
  readonly model: ReturnType<typeof getBorrowPositionDetailsModel> | null;
  readonly onActionSelect: (action: BorrowPositionAction) => void;
  readonly position: NonNullable<BorrowPositionContext["position"]> | null;
}) => {
  const { t } = useTranslation();

  if (content === "fallback" || !position || !model) {
    return (
      <Text variant={{ type: "muted", weight: "normal" }}>
        {t("dashboard.borrow.position_details.empty")}
      </Text>
    );
  }

  return (
    <Box
      className={positionDetailsStyles.infoContainer}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Box display="flex" alignItems="center" gap="2">
        <TokenIcon token={model.headerToken} tokenLogoHw="12" />
        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>{model.title}</Text>
          <Box display="flex" alignItems="center" gap="1">
            <Image
              wrapperProps={{ hw: "5" }}
              imgProps={{ borderRadius: "base" }}
              src={position.integration.metadata.logoURI}
              fallbackName={model.providerName}
            />
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("positions.via", {
                providerName: model.providerName,
                count: 1,
              })}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {" · "}
              {model.marketLabel}
            </Text>
          </Box>
        </Box>
      </Box>

      <MetricCards
        cards={model.metricCards}
        healthFactor={model.healthFactor}
      />

      <LtvGauge
        currentLtv={model.currentLtv}
        liquidationThreshold={model.liquidationThreshold}
      />

      <CollateralList
        actions={actions}
        items={model.collateralItems}
        onActionSelect={onActionSelect}
        totalCollateralUsd={model.totalCollateralUsd}
      />

      {model.breakdownRows.length > 0 && (
        <DetailsSection title={t("dashboard.position_details.breakdown")}>
          <Box display="flex" flexDirection="column">
            {model.breakdownRows.map((row) => (
              <Box className={positionDetailsStyles.breakdownRow} key={row.id}>
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {row.label}
                </Text>

                <Box className={positionDetailsStyles.breakdownAmounts}>
                  <Text className={positionDetailsStyles.breakdownValue}>
                    {row.value}
                  </Text>
                  {row.subValue && (
                    <Text
                      className={positionDetailsStyles.breakdownSubValue}
                      variant={{ type: "muted", weight: "normal" }}
                    >
                      {row.subValue}
                    </Text>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </DetailsSection>
      )}

      <DetailsSection title={t("dashboard.borrow.position_details.details")}>
        {model.detailRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}

        <Box display="flex" flexDirection="column" gap="2" marginTop="2">
          <AddressRow
            address={position.market.poolAddress}
            label={t("dashboard.borrow.details.pool_address")}
          />
        </Box>
      </DetailsSection>
    </Box>
  );
};

const useBorrowPositionContext = () =>
  useOutletContext<BorrowPositionContext>();

const getBorrowPositionBasePath = (marketId: string | undefined) =>
  marketId ? `/positions/borrow/${marketId}` : "/manage";

export const BorrowPositionActionsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stageBorrowActionForm = useAtomSet(borrowActionFormAtom);
  const { actions, model, position } = useBorrowPositionContext();

  const onActionSelect = (action: BorrowPositionAction) => {
    stageBorrowActionForm({
      context: action.pendingContext,
      type: "preparePositionAction",
    });
    navigate(`action/${action.id}`);
  };

  return (
    <>
      <BorrowPositionBreadcrumb positionName={model?.title ?? null} />

      <Box display="flex" flexDirection="column" gap="3" marginTop="3">
        <Text variant={{ weight: "bold" }}>
          {t("dashboard.borrow.position_details.actions_title")}
        </Text>

        {!position || actions.length === 0 ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.position_details.no_actions")}
          </Text>
        ) : (
          actions.map((action) => (
            <Box className={styles.actionCard} key={action.id}>
              <Box display="flex" flexDirection="column" gap="1">
                <Text>{action.label}</Text>
                <Text variant={{ type: "muted", weight: "normal" }}>
                  {t(
                    `dashboard.borrow.position_details.action_descriptions.${action.type}`
                  )}
                </Text>
              </Box>
              <Button
                data-rk={`borrow-position-action__${action.type}`}
                data-testid={`borrow-position-action__${action.type}`}
                onClick={() => onActionSelect(action)}
                variant={{ size: "small" }}
              >
                {t("dashboard.borrow.position_details.configure_action")}
              </Button>
            </Box>
          ))
        )}
      </Box>
    </>
  );
};

const AmountInputCard = ({
  amount,
  balanceLabel,
  disabled,
  error,
  label,
  onAmountChange,
  onMaxClick,
  tokenSymbol,
  usdValue,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: string;
  readonly disabled?: boolean;
  readonly error?: string | null;
  readonly label: string;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly onMaxClick?: (() => void) | null;
  readonly tokenSymbol: string;
  readonly usdValue?: BigNumber;
}) => (
  <Box display="flex" flexDirection="column" gap="2">
    <Text variant={{ weight: "bold" }}>{label}</Text>
    <Box className={clsx(styles.amountCard, error && styles.amountCardInvalid)}>
      <Box className={styles.amountCardHeader}>
        <NumberInput
          disabled={disabled}
          isInvalid={!!error}
          onChange={onAmountChange}
          shakeOnInvalid
          value={amount}
        />

        <Box className={styles.amountTokenButton}>
          <Text variant={{ weight: "bold" }}>{tokenSymbol}</Text>
        </Box>
      </Box>

      <Box className={styles.amountCardFooter}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {usdValue?.gt(0) ? `$${formatNumber(usdValue, 2)}` : "$0"}
        </Text>
        <Box className={styles.amountBalanceGroup}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {balanceLabel}
          </Text>
          {onMaxClick ? <MaxButton onMaxClick={onMaxClick} /> : null}
        </Box>
      </Box>

      {error ? (
        <Text variant={{ type: "danger", weight: "normal" }}>{error}</Text>
      ) : null}
    </Box>
  </Box>
);

const getCommonSummary = (
  position: NonNullable<BorrowPositionContext["position"]>
) => ({
  marketLabel: getBorrowMarketPairLabel(position.market),
  network: position.market.network,
  providerName: position.integration.name,
});

const usePrepareReview = () => {
  const navigate = useNavigate();
  const stageBorrowActionForm = useAtomSet(borrowActionFormAtom);

  return (reviewState: BorrowReviewState) => {
    stageBorrowActionForm({
      reviewState,
      type: "prepareReview",
    });
    navigate("../review", { state: reviewState });
  };
};

const RepayActionForm = ({
  action,
}: {
  readonly action: BorrowPositionAction;
}) => {
  const { t } = useTranslation();
  const tokenBalances = useTokenBalancesScan();
  const prepareReview = usePrepareReview();
  const [amount, setAmount] = useState(new BigNumber(0));
  const [repayAll, setRepayAll] = useState(false);

  const context = action.pendingContext;
  if (context.type !== "repay") {
    return null;
  }

  const position = context.position;
  const debtBalance = context.debtBalance;
  const repayAmount = repayAll ? new BigNumber(debtBalance.balance) : amount;
  const walletBalance = deriveBorrowTokenWalletBalance({
    balances: tokenBalances.data ?? [],
    network: position.market.network,
    token: position.market.loanToken,
  });
  const exceedsDebt = repayAmount.gt(debtBalance.balance);
  const insufficientWalletBalance =
    !!tokenBalances.data && repayAmount.gt(walletBalance.amountValue);
  const repayUsd = repayAmount.multipliedBy(position.market.loanTokenPriceUsd);
  const projectedDebtUsd = Math.max(
    debtBalance.balanceUsd - repayUsd.toNumber(),
    0
  );
  const projectedLtv = projectLtvRatio({
    collateralUsd: position.getTotalCollateralUsd(),
    debtUsd: projectedDebtUsd,
  });
  const collateralDetails = position.getCollateralTokenDetails();
  const projectedHealthFactor =
    projectedLtv > 0 && Number.isFinite(collateralDetails.liquidationThreshold)
      ? collateralDetails.liquidationThreshold / projectedLtv
      : null;
  const hasAmount = repayAll || repayAmount.gt(0);
  const canSubmit = hasAmount && !exceedsDebt && !insufficientWalletBalance;
  const error = exceedsDebt
    ? t("dashboard.borrow.position_details.validation.repay_debt")
    : insufficientWalletBalance
      ? t("dashboard.borrow.position_details.validation.wallet_balance")
      : null;

  const onContinue = () => {
    if (!canSubmit) {
      return;
    }

    const reviewState: BorrowReviewState = {
      request: buildRepayActionRequest({
        address: action.reviewState.request.address,
        integrationId: position.integration.id,
        marketId: context.action.args.marketId,
        ...(repayAll
          ? { repayAll: true }
          : {
              amount: repayAmount,
            }),
        tokenAddress: context.action.args.tokenAddress,
      }),
      summary: {
        ...getCommonSummary(position),
        action: "repay",
        borrowAmount: repayAmount.toString(10),
        existingDebtUsd: debtBalance.balanceUsd.toString(),
        loanTokenSymbol: debtBalance.tokenSymbol,
        projectedDebtUsd: projectedDebtUsd.toString(),
        projectedHealthFactor: projectedHealthFactor?.toString(),
        projectedLtv: projectedLtv.toString(),
      },
    };

    prepareReview(reviewState);
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <AmountInputCard
        amount={amount}
        balanceLabel={t("dashboard.borrow.position_details.outstanding_debt", {
          amount: formatNumber(debtBalance.balance, 6),
          symbol: debtBalance.tokenSymbol,
        })}
        disabled={repayAll}
        error={error}
        label={t("dashboard.borrow.position_details.actions.repay")}
        onAmountChange={setAmount}
        tokenSymbol={debtBalance.tokenSymbol}
        usdValue={repayUsd}
      />

      <Box className={styles.formCard}>
        <Box className={styles.checkboxRow}>
          <Box display="flex" flexDirection="column" gap="1">
            <Text variant={{ weight: "bold" }}>
              {t("dashboard.borrow.position_details.repay_full")}
            </Text>
            <Text variant={{ type: "muted", weight: "normal" }}>
              {t("dashboard.borrow.position_details.repay_full_description")}
            </Text>
          </Box>
          <input
            checked={repayAll}
            className={styles.checkbox}
            onChange={(event) => setRepayAll(event.target.checked)}
            type="checkbox"
          />
        </Box>

        <Divider />

        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={`${formatPercent(position.getCurrentLtv())} -> ${formatPercent(
            projectedLtv
          )}`}
        />
        <DetailRow
          id="loan"
          label={t("dashboard.borrow.form.loan")}
          value={`${formatNumber(debtBalance.balance, 6)} -> ${formatNumber(
            Math.max(debtBalance.balance - repayAmount.toNumber(), 0),
            6
          )} ${debtBalance.tokenSymbol}`}
        />
      </Box>

      <PageCtaButton
        cta={{
          disabled: !canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};

const WithdrawTokenPicker = ({
  onSelect,
  selectedToken,
  tokens,
  network,
}: {
  readonly network: NonNullable<
    BorrowPositionContext["position"]
  >["market"]["network"];
  readonly onSelect: (token: BorrowWithdrawTokenOption) => void;
  readonly selectedToken: BorrowWithdrawTokenOption;
  readonly tokens: ReadonlyArray<BorrowWithdrawTokenOption>;
}) => {
  const { t } = useTranslation();

  if (tokens.length <= 1) {
    return null;
  }

  return (
    <DetailsSection
      title={t("dashboard.borrow.position_details.select_withdraw_token")}
    >
      <Box display="flex" flexDirection="column" gap="2">
        {tokens.map((token) => {
          const selected =
            token.action.args.tokenAddress ===
            selectedToken.action.args.tokenAddress;
          const tokenDto = borrowTokenToTokenDto({
            network,
            token: token.collateralToken.token,
          });

          return (
            <ListItem key={token.action.args.tokenAddress}>
              <Box
                as="button"
                background="transparent"
                display="flex"
                gap="2"
                onClick={() => onSelect(token)}
                style={{ border: 0 }}
                type="button"
                width="full"
              >
                <TokenIcon token={tokenDto} />
                <Box flex={1} textAlign="left">
                  <Text variant={{ weight: "bold" }}>
                    {token.supplyBalance.tokenSymbol}
                  </Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {formatCompactUsd(
                      token.supplyBalance.balanceUsd.toString()
                    )}
                  </Text>
                </Box>
                {selected ? (
                  <Text>{t("dashboard.borrow.position_details.selected")}</Text>
                ) : null}
              </Box>
            </ListItem>
          );
        })}
      </Box>
    </DetailsSection>
  );
};

const WithdrawActionForm = ({
  action,
}: {
  readonly action: BorrowPositionAction;
}) => {
  const { t } = useTranslation();
  const prepareReview = usePrepareReview();
  const context = action.pendingContext;
  const withdrawContext = context.type === "withdraw" ? context : null;
  const [selectedToken, setSelectedToken] = useState<
    BorrowWithdrawTokenOption | undefined
  >(() => withdrawContext?.tokens[0]);
  const [amount, setAmount] = useState(new BigNumber(0));

  if (!withdrawContext || !selectedToken) {
    return null;
  }

  const position = withdrawContext.position;
  const withdrawUsd = amount.multipliedBy(
    selectedToken.collateralToken.priceUsd
  );
  const exceedsBalance = amount.gt(selectedToken.supplyBalance.balance);
  const projectedCollateralUsd = Math.max(
    position.getTotalCollateralUsd() - withdrawUsd.toNumber(),
    0
  );
  const projectedLtv = projectLtvRatio({
    collateralUsd: projectedCollateralUsd,
    debtUsd: position.getTotalBorrowedUsd(),
  });
  const maxLtv = selectedToken.collateralToken.maxLtv;
  const ltvTooHigh =
    position.getTotalBorrowedUsd() > 0 && amount.gt(0) && projectedLtv > maxLtv;
  const canSubmit = amount.gt(0) && !exceedsBalance && !ltvTooHigh;
  const error = exceedsBalance
    ? t("dashboard.borrow.position_details.validation.withdraw_balance")
    : ltvTooHigh
      ? t("dashboard.borrow.position_details.validation.withdraw_ltv")
      : null;

  const onContinue = () => {
    if (!canSubmit) {
      return;
    }

    const reviewState: BorrowReviewState = {
      request: buildWithdrawActionRequest({
        address: action.reviewState.request.address,
        amount,
        integrationId: position.integration.id,
        marketId: selectedToken.action.args.marketId,
        tokenAddress: selectedToken.action.args.tokenAddress,
      }),
      summary: {
        ...getCommonSummary(position),
        action: "withdraw",
        collateralAmount: amount.toString(10),
        collateralTokenSymbol: selectedToken.supplyBalance.tokenSymbol,
        existingCollateralUsd: position.getTotalCollateralUsd().toString(),
        projectedCollateralUsd: projectedCollateralUsd.toString(),
        projectedLtv: projectedLtv.toString(),
      },
    };

    prepareReview(reviewState);
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <WithdrawTokenPicker
        network={position.market.network}
        onSelect={(token) => {
          setSelectedToken(token);
          setAmount(new BigNumber(0));
        }}
        selectedToken={selectedToken}
        tokens={withdrawContext.tokens}
      />

      <AmountInputCard
        amount={amount}
        balanceLabel={t("dashboard.borrow.position_details.withdrawable", {
          amount: formatNumber(selectedToken.supplyBalance.balance, 6),
          symbol: selectedToken.supplyBalance.tokenSymbol,
        })}
        error={error}
        label={t("dashboard.borrow.position_details.actions.withdraw")}
        onAmountChange={setAmount}
        onMaxClick={() =>
          setAmount(new BigNumber(selectedToken.supplyBalance.balance))
        }
        tokenSymbol={selectedToken.supplyBalance.tokenSymbol}
        usdValue={withdrawUsd}
      />

      <Box className={styles.formCard}>
        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={`${formatPercent(position.getCurrentLtv())} -> ${formatPercent(
            projectedLtv
          )}`}
        />
        <DetailRow
          id="collateral"
          label={t("dashboard.borrow.form.collateral_value")}
          value={`${formatCompactUsd(
            position.getTotalCollateralUsd().toString()
          )} -> ${formatCompactUsd(projectedCollateralUsd.toString())}`}
        />
      </Box>

      <PageCtaButton
        cta={{
          disabled: !canSubmit,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};

const ToggleCollateralActionForm = ({
  action,
}: {
  readonly action: BorrowPositionAction;
}) => {
  const { t } = useTranslation();
  const prepareReview = usePrepareReview();
  const context = action.pendingContext;
  if (
    context.type !== "disableCollateral" &&
    context.type !== "enableCollateral"
  ) {
    return null;
  }

  const position = context.position;
  const isDisable = context.type === "disableCollateral";
  const tokenSymbol = context.supplyBalance.tokenSymbol;
  const healthFactor = position.getHealthFactor();

  const onContinue = () => {
    const reviewState: BorrowReviewState = {
      request: buildCollateralToggleActionRequest({
        action: context.type,
        address: action.reviewState.request.address,
        integrationId: position.integration.id,
        marketId: context.action.args.marketId,
        tokenAddress: context.action.args.tokenAddress,
      }),
      summary: {
        ...getCommonSummary(position),
        action: context.type,
        collateralTokenSymbol: tokenSymbol,
        existingCollateralUsd: position.getTotalCollateralUsd().toString(),
        projectedHealthFactor: position.getHealthFactor()?.toString(),
        projectedLtv: position.getCurrentLtv()?.toString(),
      },
    };

    prepareReview(reviewState);
  };

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <Box className={styles.formCard}>
        <Text variant={{ weight: "bold" }}>
          {isDisable
            ? t("dashboard.borrow.position_details.disable_collateral_title", {
                symbol: tokenSymbol,
              })
            : t("dashboard.borrow.position_details.enable_collateral_title", {
                symbol: tokenSymbol,
              })}
        </Text>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {isDisable
            ? t("dashboard.borrow.position_details.disable_collateral_warning")
            : t("dashboard.borrow.position_details.enable_collateral_warning")}
        </Text>

        <Divider />

        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.form.ltv_ratio")}
          value={formatPercent(position.getCurrentLtv())}
        />
        <DetailRow
          id="health"
          label={t("dashboard.borrow.position_details.health_factor")}
          value={healthFactor == null ? "-" : formatNumber(healthFactor, 2)}
        />
        <DetailRow
          id="collateral"
          label={t("dashboard.borrow.position_details.collateral")}
          value={`${formatNumber(context.supplyBalance.balance, 6)} ${tokenSymbol}`}
        />
      </Box>

      <PageCtaButton
        cta={{
          disabled: false,
          isLoading: false,
          label: t("dashboard.borrow.review"),
          onClick: onContinue,
        }}
      />
    </Box>
  );
};

export const BorrowPositionActionPage = () => {
  const { actionId, marketId } = useParams();
  const { t } = useTranslation();
  const { actions, model, position } = useBorrowPositionContext();
  const action = actions.find((candidate) => candidate.id === actionId);

  return (
    <>
      <BorrowPositionBreadcrumb
        backPath={getBorrowPositionBasePath(marketId)}
        positionName={model?.title ?? null}
      />

      <Box display="flex" flexDirection="column" gap="4" marginTop="3">
        <Box display="flex" flexDirection="column" gap="1">
          <Text variant={{ weight: "bold" }}>
            {action?.label ??
              t("dashboard.borrow.position_details.actions_title")}
          </Text>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {model?.marketLabel}
          </Text>
        </Box>

        {!position || !action ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {t("dashboard.borrow.position_details.empty")}
          </Text>
        ) : action.type === "repay" ? (
          <RepayActionForm action={action} />
        ) : action.type === "withdraw" ? (
          <WithdrawActionForm action={action} />
        ) : (
          <ToggleCollateralActionForm action={action} />
        )}
      </Box>
    </>
  );
};

const BorrowPositionActionsSkeleton = () => (
  <Box display="flex" flexDirection="column" gap="3" marginTop="3">
    <Box style={{ width: 120 }}>
      <ContentLoaderLine heightPx={16} />
    </Box>

    {[0, 1].map((index) => (
      <Box className={styles.actionCard} key={index}>
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          gap="2"
          minWidth="0"
        >
          <Box style={{ width: "55%" }}>
            <ContentLoaderLine heightPx={14} />
          </Box>
          <Box style={{ width: "85%" }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
        </Box>
        <Box style={{ width: 88 }}>
          <ContentLoaderLine heightPx={32} />
        </Box>
      </Box>
    ))}
  </Box>
);

const BorrowPositionInfoSkeleton = () => (
  <Box display="flex" flexDirection="column" gap="4">
    <Box alignItems="center" display="flex" gap="3">
      <ContentLoaderCircle sizePx={48} />
      <Box display="flex" flex={1} flexDirection="column" gap="2" minWidth="0">
        <Box style={{ width: "45%" }}>
          <ContentLoaderLine heightPx={16} />
        </Box>
        <Box style={{ width: "70%" }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
      </Box>
    </Box>

    <Box className={positionDetailsStyles.metricGrid}>
      {[0, 1, 2, 3].map((index) => (
        <Box
          className={positionDetailsStyles.metricCard({ tone: "default" })}
          display="flex"
          flexDirection="column"
          gap="2"
          key={index}
        >
          <Box style={{ width: "70%" }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
          <Box style={{ width: "50%" }}>
            <ContentLoaderLine heightPx={18} />
          </Box>
        </Box>
      ))}
    </Box>

    <Box className={styles.ltvGauge}>
      <Box display="flex" gap="2" justifyContent="space-between">
        <Box style={{ width: 120 }}>
          <ContentLoaderLine heightPx={14} />
        </Box>
        <Box style={{ width: 48 }}>
          <ContentLoaderLine heightPx={14} />
        </Box>
      </Box>

      <ContentLoaderLine heightPx={10} />

      <Box display="flex" justifyContent="space-between">
        <Box style={{ width: 64 }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
        <Box style={{ width: 96 }}>
          <ContentLoaderLine heightPx={12} />
        </Box>
      </Box>
    </Box>

    <Box display="flex" flexDirection="column" gap="3">
      {[0, 1, 2, 3].map((index) => (
        <Box display="flex" gap="4" justifyContent="space-between" key={index}>
          <Box style={{ width: 120 }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
          <Box style={{ width: 72 }}>
            <ContentLoaderLine heightPx={12} />
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);

export const BorrowPositionDetailsPage = () => {
  useTrackPage("positionDetails");

  const { marketId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stageBorrowActionForm = useAtomSet(borrowActionFormAtom);
  const borrowPosition = useBorrowPosition(marketId);
  const position = getPositionFromResult(borrowPosition);
  const model = position
    ? getBorrowPositionDetailsModel({ position, t })
    : null;
  const actions = position
    ? getBorrowPositionActions({
        address: borrowPosition.walletBridge.wallet.currentAccount.address,
        position,
        t,
      })
    : [];
  const isPositionLoading =
    AsyncResult.isInitial(borrowPosition.positionResult) ||
    AsyncResult.isWaiting(borrowPosition.positionResult);
  const shouldShowLeftPane = actions.length > 0 || !!position;
  const context: BorrowPositionContext = {
    actions,
    borrowPosition,
    model,
    position,
  };

  const openAction = (action: BorrowPositionAction) => {
    stageBorrowActionForm({
      context: action.pendingContext,
      type: "preparePositionAction",
    });
    navigate(`${getBorrowPositionBasePath(marketId)}/action/${action.id}`);
  };

  if (isPositionLoading) {
    return (
      <AnimationPage>
        <TabPageContainer>
          <Box
            className={positionDetailsActionsContainer}
            display="flex"
            flex={1}
            flexDirection="column"
            gap="4"
            width="0"
          >
            <BorrowPositionBreadcrumb positionName={null} />
            <BorrowPositionActionsSkeleton />
          </Box>

          <VerticalDivider />

          <Box
            className={posistionDetailsInfoContainer}
            display="flex"
            flexDirection="column"
            gap="4"
          >
            <BorrowPositionInfoSkeleton />
          </Box>
        </TabPageContainer>
      </AnimationPage>
    );
  }

  const rightContent = (() => {
    if (AsyncResult.isFailure(borrowPosition.positionResult)) {
      return (
        <Text variant={{ type: "danger", weight: "normal" }}>
          {t("shared.something_went_wrong")}
        </Text>
      );
    }

    return (
      <BorrowPositionInfo
        actions={actions}
        content={position && model ? "details" : "fallback"}
        model={model}
        onActionSelect={openAction}
        position={position}
      />
    );
  })();

  return (
    <AnimationPage>
      <TabPageContainer>
        {shouldShowLeftPane ? (
          <Box
            className={positionDetailsActionsContainer}
            display="flex"
            flex={1}
            flexDirection="column"
            gap="4"
            width="0"
          >
            <Outlet context={context} />
          </Box>
        ) : null}

        {shouldShowLeftPane ? <VerticalDivider /> : null}

        <Box
          className={posistionDetailsInfoContainer}
          display="flex"
          flexDirection="column"
          gap="4"
        >
          {shouldShowLeftPane ? null : (
            <BorrowPositionBreadcrumb positionName={model?.title ?? null} />
          )}

          {rightContent}
        </Box>
      </TabPageContainer>
    </AnimationPage>
  );
};
