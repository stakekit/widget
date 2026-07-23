import { useAtomSet } from "@effect/atom-react";
import { Trigger } from "@radix-ui/react-dialog";
import type BigNumber from "bignumber.js";
import clsx from "clsx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import type { CollateralToken } from "../../../domain/borrow/collateral-token";
import type { Market } from "../../../domain/borrow/market";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { BorrowToken } from "../../../domain/borrow/token";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type {
  BorrowWalletBridgeState,
  BorrowWalletConnectedBridgeState,
} from "../../../services/borrow/wallet-state-projection";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../shared/lib/number-format";
import { combineRecipeWithVariant } from "../../../shared/styles/recipe-variant";
import { Box } from "../../../shared/ui/primitives/box";
import {
  pressAnimation,
  selectTokenButton,
} from "../../../shared/ui/primitives/button/styles.css";
import { ContentLoaderSquare } from "../../../shared/ui/primitives/content-loader";
import { HeaderBadge } from "../../../shared/ui/primitives/header-badge";
import { CaretDownIcon } from "../../../shared/ui/primitives/icons/caret-down";
import { Image } from "../../../shared/ui/primitives/image";
import { Text } from "../../../shared/ui/primitives/typography/text";
import { startBorrowTransactionFlowAtom } from "../../borrow-transaction-flow/state";
import * as AmountToggle from "../../earn/ui/components/amount-toggle";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../earn/ui/dashboard/earn-details/components/details-section";
import { useTrackEvent } from "../../tracking/react/use-track-event";
import { useTrackPage } from "../../tracking/react/use-track-page";
import { ConnectButton } from "../../wallet/ui/connect-button";
import { AnimationPage } from "../../widget-shell/animation-page";
import { VerticalDivider } from "../../widget-shell/dashboard/components/divider";
import { TabPageContainer } from "../../widget-shell/dashboard/components/tab-page-container";
import { PageCtaButton } from "../../widget-shell/page-cta";
import { MaxButton } from "../../widget-shell/ui/max-button";
import { NumberInput } from "../../widget-shell/ui/number-input";
import { SelectModal } from "../../widget-shell/ui/select-modal";
import { TokenIcon } from "../../widget-shell/ui/token-icon";
import type { BorrowMarketWalletBalances } from "../balances";
import { getBorrowDetailsModel, getBorrowMarketPairLabel } from "./model";
import * as styles from "./styles.css";
import { useBorrowDashboard } from "./use-borrow-dashboard";
import { useBorrowWalletBridge } from "./wallet-bridge";

type DashboardBorrowToken = AppToken & { network: BorrowNetwork };

type BorrowMarketGroup = {
  readonly bestRate: number;
  readonly key: string;
  readonly loanToken: BorrowToken;
  readonly marketItems: readonly Market[];
  readonly network: BorrowNetwork;
};

const toDashboardToken = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): DashboardBorrowToken => ({
  decimals: token.decimals,
  name: token.name,
  network,
  symbol: token.symbol,
  ...(token.address ? { address: token.address } : {}),
  ...(token.logoURI ? { logoURI: token.logoURI } : {}),
});

const getBorrowMarketGroupKey = (market: Market) =>
  `${market.network}:${market.loanToken.address ?? market.loanToken.symbol}`;

const getBorrowMarketGroups = (
  markets: readonly Market[]
): readonly BorrowMarketGroup[] => {
  const groups = new Map<string, BorrowMarketGroup>();

  for (const market of markets) {
    const key = getBorrowMarketGroupKey(market);
    const existing = groups.get(key);

    groups.set(key, {
      bestRate: Math.min(
        existing?.bestRate ?? market.borrowRate,
        market.borrowRate
      ),
      key,
      loanToken: market.loanToken,
      marketItems: [...(existing?.marketItems ?? []), market],
      network: market.network,
    });
  }

  return [...groups.values()];
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const searchableText = (values: readonly (string | null | undefined)[]) =>
  values.filter(Boolean).join(" ").toLowerCase();

const marketMatchesSearch = ({
  integrationName,
  market,
  search,
}: {
  readonly integrationName: string | null;
  readonly market: Market;
  readonly search: string;
}) => {
  if (!search) {
    return true;
  }

  return searchableText([
    getBorrowMarketPairLabel(market),
    integrationName,
    market.integrationId,
    market.loanToken.address,
    market.loanToken.name,
    market.loanToken.symbol,
    ...market.collateralTokens.flatMap((collateralToken) => [
      collateralToken.token.address,
      collateralToken.token.name,
      collateralToken.token.symbol,
    ]),
  ]).includes(search);
};

const borrowGroupMatchesSearch = ({
  group,
  search,
}: {
  readonly group: BorrowMarketGroup;
  readonly search: string;
}) =>
  !search ||
  searchableText([
    group.loanToken.address,
    group.loanToken.name,
    group.loanToken.symbol,
  ]).includes(search);

type BorrowEntryWalletBridge = Exclude<
  BorrowWalletBridgeState,
  BorrowWalletConnectedBridgeState
>;

/**
 * Persistent split layout for the borrow flow. The left pane swaps between the
 * form, review, steps and complete pages via the router outlet while the right
 * details pane stays mounted, mirroring the earn flow's `OverviewPage`.
 */
export const BorrowLayout = () => {
  const { t } = useTranslation();
  const walletBridge = useBorrowWalletBridge();

  return (
    <AnimationPage>
      <TabPageContainer>
        <Box className={styles.formPane} width="0">
          <Outlet />
        </Box>

        <VerticalDivider />

        <Box className={styles.detailsPaneWrapper} flex={1} width="0">
          {walletBridge.status === "connected" ? (
            <BorrowConnectedDetailsPane />
          ) : (
            <BorrowDetailsEmpty
              title={t("dashboard.borrow.details.empty_title")}
            >
              {t("dashboard.borrow.details.empty_description")}
            </BorrowDetailsEmpty>
          )}
        </Box>
      </TabPageContainer>
    </AnimationPage>
  );
};

const BorrowConnectedDetailsPane = () => {
  const borrowDashboard = useBorrowDashboard();

  return <BorrowDetailsPanel {...borrowDashboard} />;
};

export const BorrowFormPage = () => {
  useTrackPage("borrow");

  const walletBridge = useBorrowWalletBridge();

  return walletBridge.status === "connected" ? (
    <BorrowConnectedFormPage />
  ) : (
    <BorrowEntryFormPage walletBridge={walletBridge} />
  );
};

const BorrowConnectedFormPage = () => {
  const borrowDashboard = useBorrowDashboard();

  return <BorrowFormPanel {...borrowDashboard} />;
};

const BorrowEntryFormPage = ({
  walletBridge,
}: {
  readonly walletBridge: BorrowEntryWalletBridge;
}) => {
  const { t } = useTranslation();

  return walletBridge.status === "disconnected" ? (
    <>
      <BorrowNotice title={t("dashboard.borrow.connect_title")}>
        {t("dashboard.borrow.connect_description")}
      </BorrowNotice>

      <ConnectButton
        variant={{
          animation: "press",
          color: "primary",
          size: "compact",
        }}
      />
    </>
  ) : (
    <>
      <BorrowNotice title={t("dashboard.borrow.unsupported_network")}>
        {t("dashboard.borrow.unsupported_network_description")}
      </BorrowNotice>

      <PageCtaButton
        cta={{
          disabled: true,
          isLoading: false,
          label: t("dashboard.borrow.unsupported_network"),
          onClick: () => undefined,
        }}
      />
    </>
  );
};

const BorrowFormPanel = ({
  borrowAmount,
  collateralAmount,
  integrationsResult,
  isActionReady,
  markets,
  marketsResult,
  preparedReviewState,
  projection,
  selectedCollateralBalance,
  selectedCollateralTokenAddress,
  selectedCollateralToken,
  selectedMarket,
  selectedMarketId,
  setBorrowAmount,
  setCollateralAmount,
  setSelectedCollateralTokenAddress,
  setSelectedMarketId,
  stageReviewState,
  validation,
  walletBalances,
}: ReturnType<typeof useBorrowDashboard>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const trackEvent = useTrackEvent();
  const startBorrowTransactionFlow = useAtomSet(startBorrowTransactionFlowAtom);
  const {
    borrowAmountGreaterThanAvailable,
    collateralAmountGreaterThanBalance,
    hasValidationError,
    ltvGreaterThanMax,
  } = validation;
  const onSelectMarket = (marketId: string) => {
    setSelectedMarketId(marketId);
    trackEvent("borrowMarketSelected", { marketId });
  };
  const onSelectCollateral = (collateralToken: CollateralToken) => {
    setSelectedCollateralTokenAddress(collateralToken.token.address ?? null);
    trackEvent("borrowCollateralSelected", {
      collateralTokenAddress: collateralToken.token.address,
      collateralTokenSymbol: collateralToken.token.symbol,
      marketId: selectedMarket?.id,
    });
  };
  const onBorrowMaxClick =
    selectedMarket && projection.borrowMaxAmount.gt(0)
      ? () => {
          setBorrowAmount(projection.borrowMaxAmount);
          trackEvent("borrowPageMaxClicked", {
            field: "borrow",
            marketId: selectedMarket.id,
          });
        }
      : null;
  const onCollateralMaxClick =
    selectedMarket && projection.collateralMaxAmount.gt(0)
      ? () => {
          setCollateralAmount(projection.collateralMaxAmount);
          trackEvent("borrowPageMaxClicked", {
            collateralTokenAddress: selectedCollateralToken?.token.address,
            collateralTokenSymbol: selectedCollateralToken?.token.symbol,
            field: "collateral",
            marketId: selectedMarket.id,
          });
        }
      : null;
  const onReviewClick = () => {
    if (!isActionReady || !preparedReviewState || !selectedMarket) {
      return;
    }

    stageReviewState();
    startBorrowTransactionFlow({
      ...preparedReviewState,
      entry: { _tag: "BorrowDashboard" },
    });
    trackEvent("borrowReviewClicked", {
      borrowAmount: borrowAmount.toString(10),
      collateralAmount: collateralAmount.toString(10),
      collateralTokenAddress: selectedCollateralToken?.token.address,
      collateralTokenSymbol: selectedCollateralToken?.token.symbol,
      marketId: selectedMarket.id,
    });
    navigate("/borrow/review");
  };
  const integrations = AsyncResult.getOrElse(integrationsResult, () => []);

  const getFormContent = (): ReactNode => {
    if (
      AsyncResult.isInitial(marketsResult) ||
      AsyncResult.isWaiting(marketsResult)
    ) {
      return <ContentLoaderSquare heightPx={340} />;
    }
    if (AsyncResult.isFailure(marketsResult)) {
      return (
        <BorrowNotice tone="error" title={t("dashboard.borrow.error_title")}>
          {t("dashboard.borrow.error_description")}
        </BorrowNotice>
      );
    }
    if (!selectedMarket || !selectedCollateralToken) {
      return (
        <BorrowNotice title={t("dashboard.borrow.empty_title")}>
          {t("dashboard.borrow.empty_description")}
        </BorrowNotice>
      );
    }

    return (
      <>
        <AmountField
          amount={borrowAmount}
          balanceLabel={
            <BorrowBalanceLabel
              amount={selectedMarket.availableLiquidity}
              symbol={selectedMarket.loanToken.symbol}
              translationKey="dashboard.borrow.form.available"
            />
          }
          isInvalid={borrowAmountGreaterThanAvailable}
          label={t("dashboard.borrow.form.borrow")}
          highlight
          onMaxClick={onBorrowMaxClick}
          onAmountChange={setBorrowAmount}
          tokenSelector={
            <MarketSelectModal
              integrations={integrations}
              markets={markets}
              onSelect={onSelectMarket}
              selectedMarketId={selectedMarketId}
            />
          }
          usdValue={borrowAmount.multipliedBy(selectedMarket.loanTokenPriceUsd)}
          validationText={
            borrowAmountGreaterThanAvailable
              ? t("dashboard.borrow.form.validation.available_liquidity")
              : null
          }
        />

        <AmountField
          amount={collateralAmount}
          balanceLabel={
            <BorrowBalanceLabel
              amount={selectedCollateralBalance?.amount ?? "0"}
              symbol={selectedCollateralToken.token.symbol}
              translationKey="dashboard.borrow.form.wallet_balance"
            />
          }
          isInvalid={collateralAmountGreaterThanBalance}
          label={t("dashboard.borrow.form.collateral")}
          onMaxClick={onCollateralMaxClick}
          onAmountChange={setCollateralAmount}
          tokenSelector={
            <CollateralSelectModal
              collateralTokens={selectedMarket.collateralTokens}
              marketNetwork={selectedMarket.network}
              onSelect={onSelectCollateral}
              selectedCollateralTokenAddress={selectedCollateralTokenAddress}
            />
          }
          usdValue={collateralAmount.multipliedBy(
            selectedCollateralToken.priceUsd
          )}
          validationText={
            collateralAmountGreaterThanBalance
              ? t("dashboard.borrow.form.validation.wallet_balance")
              : null
          }
        />

        <BorrowFormDetails
          borrowAmount={borrowAmount}
          collateralAmount={collateralAmount}
          ltvGreaterThanMax={ltvGreaterThanMax}
          market={selectedMarket}
          projection={projection}
          walletBalances={walletBalances}
        />
      </>
    );
  };
  const formContent = getFormContent();

  const getCtaLabel = () => {
    if (isActionReady) return t("dashboard.borrow.review");
    if (hasValidationError) return t("dashboard.borrow.fix_errors");
    return t("dashboard.borrow.enter_amounts");
  };
  const ctaLabel = getCtaLabel();

  return (
    <>
      {formContent}

      <PageCtaButton
        cta={{
          disabled: !isActionReady,
          isLoading: false,
          label: ctaLabel,
          onClick: onReviewClick,
        }}
      />
    </>
  );
};

const AmountField = ({
  amount,
  balanceLabel,
  highlight = false,
  isInvalid,
  label,
  onMaxClick,
  onAmountChange,
  tokenSelector,
  usdValue,
  validationText,
}: {
  readonly amount: BigNumber;
  readonly balanceLabel: ReactNode;
  readonly highlight?: boolean;
  readonly isInvalid?: boolean;
  readonly label: string;
  readonly onMaxClick: (() => void) | null;
  readonly onAmountChange: (amount: BigNumber) => void;
  readonly tokenSelector: ReactNode;
  readonly usdValue: BigNumber;
  readonly validationText?: string | null;
}) => (
  <Box display="flex" flexDirection="column" gap="2">
    <Text variant={{ weight: "bold" }}>{label}</Text>
    <Box
      className={clsx(
        styles.amountCard,
        highlight && styles.amountCardHighlighted,
        isInvalid && styles.amountCardInvalid
      )}
      data-rk="borrow-amount-section"
    >
      <Box className={styles.amountCardHeader}>
        <NumberInput
          isInvalid={isInvalid}
          onChange={onAmountChange}
          shakeOnInvalid
          value={amount}
        />

        {tokenSelector}
      </Box>

      <Box className={styles.amountCardFooter}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {usdValue.gt(0) ? `$${formatNumber(usdValue, 2)}` : "$0"}
        </Text>
        <Box className={styles.amountBalanceGroup}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            {balanceLabel}
          </Text>
          {onMaxClick ? <MaxButton onMaxClick={onMaxClick} /> : null}
        </Box>
      </Box>
      {validationText ? (
        <Text variant={{ type: "danger", weight: "normal" }}>
          {validationText}
        </Text>
      ) : null}
    </Box>
  </Box>
);

const BorrowBalanceLabel = ({
  amount,
  translationKey,
  symbol,
}: {
  readonly amount: string | number | BigNumber;
  readonly translationKey:
    | "dashboard.borrow.form.available"
    | "dashboard.borrow.form.wallet_balance";
  readonly symbol: string;
}) => {
  const { t } = useTranslation();

  return (
    <AmountToggle.Root>
      <AmountToggle.Amount>
        {({ state }) =>
          t(translationKey, {
            amount:
              state === "full"
                ? formatNumber(amount)
                : defaultFormattedNumber(amount),
            symbol,
          })
        }
      </AmountToggle.Amount>
    </AmountToggle.Root>
  );
};

const BorrowFormDetails = ({
  borrowAmount,
  collateralAmount,
  ltvGreaterThanMax,
  market,
  projection,
  walletBalances,
}: {
  readonly borrowAmount: BigNumber;
  readonly collateralAmount: BigNumber;
  readonly ltvGreaterThanMax: boolean;
  readonly market: Market;
  readonly projection: ReturnType<typeof useBorrowDashboard>["projection"];
  readonly walletBalances: BorrowMarketWalletBalances | null;
}) => {
  const { t } = useTranslation();
  const model = getBorrowDetailsModel({
    balances: walletBalances,
    borrowAmount,
    collateralAmount,
    integration: null,
    market,
    projection,
    t,
  });

  return (
    <Box display="flex" flexDirection="column" gap="2">
      <Text variant={{ weight: "bold" }}>
        {t("dashboard.borrow.form.details")}
      </Text>
      <Box className={styles.detailCard}>
        {model.formRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}
      </Box>
      <BorrowInfoNote tone={ltvGreaterThanMax ? "error" : "default"}>
        {ltvGreaterThanMax
          ? t("dashboard.borrow.form.validation.ltv")
          : t("dashboard.borrow.form.ltv_note")}
      </BorrowInfoNote>
    </Box>
  );
};

const AmountTokenButtonContent = ({
  showCaret,
  token,
}: {
  readonly showCaret: boolean;
  readonly token: DashboardBorrowToken;
}) => (
  <>
    <TokenIcon token={token} />
    <Text className={styles.amountTokenButtonText} variant={{ weight: "bold" }}>
      {token.symbol}
    </Text>
    {showCaret ? (
      <Box className={styles.amountTokenButtonCaret}>
        <CaretDownIcon />
      </Box>
    ) : null}
  </>
);

const MarketSelectModal = ({
  integrations,
  markets,
  onSelect,
  selectedMarketId,
}: {
  readonly integrations: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly markets: readonly Market[];
  readonly onSelect: (marketId: string) => void;
  readonly selectedMarketId: string | null;
}) => {
  const { t } = useTranslation();
  const variant = useWidgetConfig("variant");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ??
    markets[0] ??
    null;

  if (!selectedMarket) {
    return null;
  }

  const token = toDashboardToken({
    network: selectedMarket.network,
    token: selectedMarket.loanToken,
  });
  const integrationsById = new Map(
    integrations.map((integration) => [integration.id, integration])
  );
  const normalizedSearch = normalizeSearch(search);
  const marketGroups = getBorrowMarketGroups(markets).flatMap(
    (group): BorrowMarketGroup[] => {
      const groupMatches = borrowGroupMatchesSearch({
        group,
        search: normalizedSearch,
      });
      const marketItems = group.marketItems.filter((market) =>
        groupMatches
          ? true
          : marketMatchesSearch({
              integrationName:
                integrationsById.get(market.integrationId)?.name ?? null,
              market,
              search: normalizedSearch,
            })
      );

      return groupMatches || marketItems.length > 0
        ? [{ ...group, marketItems }]
        : [];
    }
  );

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setExpandedGroupKey(null);
      setSearch("");
    }
  };

  if (markets.length <= 1) {
    return (
      <Box
        className={clsx(
          styles.amountTokenButton,
          combineRecipeWithVariant({
            rec: selectTokenButton,
            variant,
          })
        )}
      >
        <AmountTokenButtonContent showCaret={false} token={token} />
      </Box>
    );
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_market")}
      trigger={
        <Trigger asChild>
          <Box
            as="button"
            className={clsx(
              styles.amountTokenButton,
              styles.amountTokenButtonSelectable,
              pressAnimation,
              combineRecipeWithVariant({
                rec: selectTokenButton,
                variant,
              })
            )}
            data-testid="borrow-market-select"
            type="button"
          >
            <AmountTokenButtonContent showCaret token={token} />
          </Box>
        </Trigger>
      }
    >
      <BorrowAssetSelectorList
        title={t("dashboard.borrow.form.borrowable_assets")}
      >
        {marketGroups.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          marketGroups.map((group) => {
            const isExpanded = expandedGroupKey === group.key;
            const token = toDashboardToken({
              network: group.network,
              token: group.loanToken,
            });

            return (
              <Box className={styles.assetSelectorGroup} key={group.key}>
                <BorrowAssetSelectorRow
                  expandable
                  expanded={isExpanded}
                  label={group.loanToken.symbol}
                  onClick={() =>
                    setExpandedGroupKey((prev) =>
                      prev === group.key ? null : group.key
                    )
                  }
                  rate={`${formatNumber(group.bestRate * 100, 2)}%`}
                  selected={isExpanded}
                  testId={`borrow-market-select__group_${group.loanToken.symbol.toLowerCase()}`}
                  token={token}
                />

                {isExpanded
                  ? group.marketItems.map((market) => (
                      <BorrowAssetSelectorRow
                        indented
                        key={market.id}
                        label={getBorrowMarketPairLabel(market)}
                        maxAmount={`${t("shared.max")}: ${formatNumber(
                          market.availableLiquidity,
                          0
                        )}`}
                        meta={
                          integrationsById.get(market.integrationId)?.name ??
                          market.integrationId
                        }
                        onClick={() => {
                          onSelect(market.id);
                          onOpenChange(false);
                        }}
                        rate={`${formatNumber(market.borrowRate * 100, 2)}%`}
                        selected={market.id === selectedMarketId}
                        testId={`borrow-market-select__item_${market.id}`}
                        token={toDashboardToken({
                          network: market.network,
                          token: market.loanToken,
                        })}
                      />
                    ))
                  : null}
              </Box>
            );
          })
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};

const CollateralSelectModal = ({
  collateralTokens,
  marketNetwork,
  onSelect,
  selectedCollateralTokenAddress,
}: {
  readonly collateralTokens: readonly CollateralToken[];
  readonly marketNetwork: BorrowNetwork;
  readonly onSelect: (collateralToken: CollateralToken) => void;
  readonly selectedCollateralTokenAddress: string | null;
}) => {
  const { t } = useTranslation();
  const variant = useWidgetConfig("variant");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedCollateralToken =
    collateralTokens.find(
      (collateralToken) =>
        collateralToken.token.address === selectedCollateralTokenAddress
    ) ??
    collateralTokens[0] ??
    null;

  if (!selectedCollateralToken) {
    return null;
  }

  const token = toDashboardToken({
    network: marketNetwork,
    token: selectedCollateralToken.token,
  });
  const normalizedSearch = normalizeSearch(search);
  const filteredCollateralTokens = normalizedSearch
    ? collateralTokens.filter((collateralToken) =>
        searchableText([
          collateralToken.token.address,
          collateralToken.token.name,
          collateralToken.token.symbol,
        ]).includes(normalizedSearch)
      )
    : collateralTokens;

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      setSearch("");
    }
  };

  if (collateralTokens.length <= 1) {
    return (
      <Box
        className={clsx(
          styles.amountTokenButton,
          combineRecipeWithVariant({
            rec: selectTokenButton,
            variant,
          })
        )}
      >
        <AmountTokenButtonContent showCaret={false} token={token} />
      </Box>
    );
  }

  return (
    <SelectModal
      inputPlaceholder={t("dashboard.borrow.form.search_assets")}
      onSearch={setSearch}
      searchValue={search}
      state={{ isOpen, setOpen: onOpenChange }}
      title={t("dashboard.borrow.form.select_collateral")}
      trigger={
        <Trigger asChild>
          <Box
            as="button"
            className={clsx(
              styles.amountTokenButton,
              styles.amountTokenButtonSelectable,
              pressAnimation,
              combineRecipeWithVariant({
                rec: selectTokenButton,
                variant,
              })
            )}
            data-testid="borrow-collateral-select"
            type="button"
          >
            <AmountTokenButtonContent showCaret token={token} />
          </Box>
        </Trigger>
      }
    >
      <BorrowAssetSelectorList
        title={t("dashboard.borrow.form.collateral_assets")}
      >
        {filteredCollateralTokens.length === 0 ? (
          <BorrowSelectorEmpty>
            {t("dashboard.borrow.form.no_assets")}
          </BorrowSelectorEmpty>
        ) : (
          filteredCollateralTokens.map((collateralToken) => (
            <BorrowAssetSelectorRow
              key={
                collateralToken.token.address ?? collateralToken.token.symbol
              }
              label={collateralToken.token.symbol}
              meta={t("dashboard.borrow.form.max_ltv", {
                value: formatNumber(collateralToken.maxLtv * 100, 2),
              })}
              onClick={() => {
                onSelect(collateralToken);
                onOpenChange(false);
              }}
              rate={`${formatNumber(collateralToken.supplyRate * 100, 2)}%`}
              selected={
                collateralToken.token.address === selectedCollateralTokenAddress
              }
              testId={`borrow-collateral-select__item_${
                collateralToken.token.address ?? collateralToken.token.symbol
              }`}
              token={toDashboardToken({
                network: marketNetwork,
                token: collateralToken.token,
              })}
            />
          ))
        )}
      </BorrowAssetSelectorList>
    </SelectModal>
  );
};

const BorrowAssetSelectorList = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <Box className={styles.assetSelectorList} mx="4">
    <Text
      className={styles.assetSelectorSectionTitle}
      variant={{ weight: "bold" }}
    >
      {title}
    </Text>
    {children}
  </Box>
);

const BorrowSelectorEmpty = ({ children }: { readonly children: string }) => (
  <Box className={styles.assetSelectorEmpty}>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);

const BorrowAssetSelectorRow = ({
  expandable = false,
  expanded = false,
  indented = false,
  label,
  maxAmount,
  meta,
  onClick,
  rate,
  selected = false,
  testId,
  token,
}: {
  readonly expandable?: boolean;
  readonly expanded?: boolean;
  readonly indented?: boolean;
  readonly label: string;
  readonly maxAmount?: string;
  readonly meta?: string;
  readonly onClick: () => void;
  readonly rate: string;
  readonly selected?: boolean;
  readonly testId?: string;
  readonly token: DashboardBorrowToken;
}) => (
  <Box
    as="button"
    className={clsx(
      styles.assetSelectorRow,
      indented && styles.assetSelectorMarketRow,
      selected && styles.assetSelectorRowSelected
    )}
    data-testid={testId}
    onClick={onClick}
    type="button"
  >
    {expandable ? (
      <Box
        className={clsx(
          styles.assetSelectorChevron,
          expanded && styles.assetSelectorChevronExpanded
        )}
      >
        <CaretDownIcon size={10} />
      </Box>
    ) : null}
    <TokenIcon token={token} />
    <Box className={styles.assetSelectorText}>
      <Text className={styles.assetSelectorLabel} variant={{ weight: "bold" }}>
        {label}
      </Text>
      {meta ? (
        <Text className={styles.assetSelectorMeta} variant={{ type: "muted" }}>
          {meta}
        </Text>
      ) : null}
    </Box>
    <Box className={styles.assetSelectorRate}>
      <Text variant={{ weight: "normal" }}>{rate}</Text>
      {maxAmount ? (
        <Text
          className={styles.assetSelectorMeta}
          variant={{ type: "muted", weight: "bold" }}
        >
          {maxAmount}
        </Text>
      ) : null}
    </Box>
  </Box>
);

const BorrowInfoNote = ({
  children,
  tone = "default",
}: {
  readonly children: string;
  readonly tone?: "default" | "error";
}) => (
  <Box
    className={clsx(styles.infoNote, tone === "error" && styles.infoNoteError)}
  >
    <Text
      variant={{
        type: tone === "error" ? "danger" : "muted",
        weight: "normal",
      }}
    >
      {children}
    </Text>
  </Box>
);

const BorrowDetailsPanel = ({
  borrowAmount,
  collateralAmount,
  integrationsResult,
  marketsResult,
  projection,
  selectedIntegration,
  selectedMarket,
  walletBalances,
}: ReturnType<typeof useBorrowDashboard>) => {
  const { t } = useTranslation();

  if (
    AsyncResult.isInitial(marketsResult) ||
    AsyncResult.isWaiting(marketsResult) ||
    AsyncResult.isInitial(integrationsResult) ||
    AsyncResult.isWaiting(integrationsResult)
  ) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  if (
    AsyncResult.isFailure(marketsResult) ||
    AsyncResult.isFailure(integrationsResult)
  ) {
    return (
      <BorrowDetailsEmpty title={t("dashboard.borrow.error_title")}>
        {t("dashboard.borrow.error_description")}
      </BorrowDetailsEmpty>
    );
  }

  if (!selectedMarket) {
    return (
      <BorrowDetailsEmpty title={t("dashboard.borrow.details.empty_title")}>
        {t("dashboard.borrow.details.empty_description")}
      </BorrowDetailsEmpty>
    );
  }

  const model = getBorrowDetailsModel({
    balances: walletBalances,
    borrowAmount,
    collateralAmount,
    integration: selectedIntegration,
    market: selectedMarket,
    projection,
    t,
  });
  const loanToken = toDashboardToken({
    network: selectedMarket.network,
    token: selectedMarket.loanToken,
  });

  return (
    <Box
      className={styles.detailsScroll}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <Box className={styles.detailsHeader}>
        <TokenIcon token={loanToken} tokenLogoHw="12" />

        <Box minWidth="0">
          <Text variant={{ weight: "bold" }}>{model.title}</Text>
          <Box display="flex" alignItems="center" gap="1" flexWrap="wrap">
            <Image
              wrapperProps={{ hw: "5" }}
              imgProps={{ borderRadius: "base" }}
              src={selectedIntegration?.metadata.logoURI}
              fallbackName={
                selectedIntegration?.name ?? selectedMarket.integrationId
              }
            />
            <Text variant={{ type: "muted", weight: "normal" }}>
              {selectedIntegration?.name ?? selectedMarket.integrationId}
              {" · "}
              {selectedMarket.network}
            </Text>
            <HeaderBadge
              label={t(`dashboard.borrow.market_type.${selectedMarket.type}`)}
            />
          </Box>
        </Box>
      </Box>

      <BorrowMetricGrid cards={model.metricCards} />

      <DetailsSection title={t("dashboard.borrow.details.about")}>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {selectedIntegration?.metadata.description ??
            t("dashboard.borrow.details.about_fallback", {
              market: model.title,
              provider:
                selectedIntegration?.name ?? selectedMarket.integrationId,
            })}
        </Text>
      </DetailsSection>

      <DetailsSection title={t("dashboard.borrow.details.market_stats")}>
        {model.marketRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}
      </DetailsSection>

      <DetailsSection title={t("dashboard.borrow.details.protocol")}>
        {model.protocolRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}

        {selectedMarket.poolAddress ? (
          <Box marginTop="2">
            <AddressRow
              address={selectedMarket.poolAddress}
              label={t("dashboard.borrow.details.pool_address")}
            />
          </Box>
        ) : null}
      </DetailsSection>
    </Box>
  );
};

const BorrowMetricGrid = ({
  cards,
}: {
  readonly cards: ReturnType<typeof getBorrowDetailsModel>["metricCards"];
}) => (
  <Box className={styles.metricGrid}>
    {cards.map((card) => (
      <Box
        className={styles.metricCard}
        display="flex"
        flexDirection="column"
        gap="1"
        key={card.id}
      >
        <Text variant={{ type: "muted", weight: "normal" }}>{card.label}</Text>
        <Text variant={{ weight: "bold" }}>{card.value}</Text>
        {card.subValue ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {card.subValue}
          </Text>
        ) : null}
      </Box>
    ))}
  </Box>
);

const BorrowNotice = ({
  children,
  title,
  tone,
}: {
  readonly children: string;
  readonly title: string;
  readonly tone?: "error";
}) => (
  <Box className={styles.mutedPanel}>
    <Text
      className={tone === "error" ? styles.errorText : undefined}
      variant={{ weight: "bold" }}
    >
      {title}
    </Text>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);

const BorrowDetailsEmpty = ({
  children,
  title,
}: {
  readonly children: string;
  readonly title: string;
}) => (
  <Box
    alignItems="center"
    className={styles.detailsScroll}
    display="flex"
    flexDirection="column"
    gap="2"
    justifyContent="center"
  >
    <Text variant={{ weight: "bold" }}>{title}</Text>
    <Text variant={{ type: "muted", weight: "normal" }}>{children}</Text>
  </Box>
);
