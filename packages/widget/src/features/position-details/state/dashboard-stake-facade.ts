import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { widgetConfigAtom } from "../../../app/runtime/widget-config";
import { stakeTokenSameAsGasToken } from "../../../domain";
import type { TronResource } from "../../../domain/action/tron-resource";
import { getKycProviderName } from "../../../domain/earn/kyc";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import { getInitSelectedValidators } from "../../../domain/earn/stake";
import {
  getYieldActionArg,
  getYieldProviderYieldIds,
  isYieldValidatorSelectionRequired,
} from "../../../domain/earn/yield";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import type {
  BalanceDataKey,
  PositionsData,
} from "../../../domain/portfolio/positions";
import { equalTokens } from "../../../domain/token/token";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/prices";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesByTypeAtom,
} from "../../../resources/yield-positions/yield-positions";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  sameWalletScopeOwner,
  walletCommandIdentity,
} from "../../../services/wallet/wallet-scope";
import { getPullResultItems } from "../../../shared/effect/pagination";
import { formatUsd } from "../../../shared/lib/formatters";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../shared/lib/number-format";
import { tokenBalancesScanAtom } from "../../portfolio/state";
import { walletConnectionStateAtom, walletScopeAtom } from "../../wallet/state";
import {
  makeYieldEntry,
  YieldValidatorsKey,
  yieldValidatorsPullAtom,
} from "../../yield-entry/state";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  makeYieldSummary,
  refreshCurrentYieldKycAtom,
} from "../../yield-summary/state";
import {
  type PositionDetailsStakeEntryKey,
  positionDetailsStakeAtom,
} from "./dashboard-stake-machine";

const resolveProviderYieldId = (
  selectedYield: EarnYieldWithProvider | null
) => {
  const argument = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "providerId")
    : null;
  const providerYieldIds = selectedYield
    ? getYieldProviderYieldIds(selectedYield)
    : [];
  return argument?.required && providerYieldIds.length > 0
    ? EArray.head(providerYieldIds).pipe(Option.getOrNull)
    : null;
};

const resolveTronResource = (selectedYield: EarnYieldWithProvider | null) => {
  const argument = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "tronResource")
    : null;
  return argument?.required
    ? EArray.head(argument.options).pipe(Option.getOrNull)
    : null;
};

const getPositionDetailsStakeValidationKey = (
  key: PositionDetailsStakeEntryKey
): string =>
  JSON.stringify([
    key.integrationId,
    key.balanceId,
    key.walletScope.network,
    key.walletScope.address,
    key.walletScope.additionalAddresses,
  ]);

const positionDetailsStakeFacadeAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) => {
    const intentAtom = positionDetailsStakeAtom(key);
    const selectedYieldAtom = Atom.make((get) =>
      get(
        yieldOpportunityAtom.foreground(
          new YieldOpportunityKey({ yieldId: key.integrationId })
        )
      ).pipe(AsyncResult.value, Option.getOrNull)
    ).pipe(Atom.withLabel("positionDetailsStakeSelectedYieldAtom"));
    const positionKey = new PositionBalancesKey({
      balanceId: key.balanceId,
      scope: key.walletScope,
      yieldId: key.integrationId,
    });
    const positionsByTypeAtom = positionBalancesByTypeAtom(positionKey);
    const selectedValidatorsAtom = Atom.make((get) => {
      const selectedYield = get(selectedYieldAtom);
      if (!selectedYield || !isYieldValidatorSelectionRequired(selectedYield)) {
        return new Map();
      }
      const result = get(
        yieldValidatorsPullAtom(
          new YieldValidatorsKey({
            network: selectedYield.token.network,
            search: null,
            yieldId: selectedYield.id,
          })
        )
      );
      return getInitSelectedValidators({
        initQueryParams: null,
        validators: getPullResultItems(result).flatMap((page) => page.items),
      });
    }).pipe(Atom.withLabel("positionDetailsStakeSelectedValidatorsAtom"));
    const summary = makeYieldSummary(
      Atom.make((get) => ({
        selectedProviderYieldId: resolveProviderYieldId(get(selectedYieldAtom)),
        validators: get(selectedValidatorsAtom),
        yield: get(selectedYieldAtom),
      }))
    );
    const yieldEntryInputAtom = Atom.make((get) => {
      const config = get(widgetConfigAtom);
      const intent = get(intentAtom);
      const selectedYield = get(selectedYieldAtom);
      const selectedToken = selectedYield?.token ?? null;
      const tokenBalances = get(tokenBalancesScanAtom);
      const tokenBalanceValues = tokenBalances.result.pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const availableAmount = selectedToken
        ? (() => {
            const balance = tokenBalanceValues?.find((item) =>
              equalTokens(item.token, selectedToken)
            );
            return balance ? new BigNumber(balance.amount) : null;
          })()
        : null;
      const positionsByType = get(positionsByTypeAtom).pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const positionsData = selectedYield
        ? (new Map([
            [
              selectedYield.id,
              {
                balanceData: new Map([
                  [
                    "default" as BalanceDataKey,
                    {
                      balances: positionsByType
                        ? [...positionsByType.values()].flat()
                        : [],
                      type: "default" as const,
                    },
                  ],
                ]),
                rewardRate: selectedYield.rewardRate,
                yieldId: selectedYield.id,
              },
            ],
          ]) as PositionsData)
        : (new Map() as PositionsData);
      const rawAmount = new BigNumber(intent.stakeAmount);
      const amount =
        intent.useMaxAmount || !rawAmount.isZero()
          ? rawAmount
          : new BigNumber(0);
      const validators = get(selectedValidatorsAtom);
      const summaryView = get(summary.viewAtom);
      const wallet = get(walletConnectionStateAtom);
      const tronResource =
        intent.tronResource ?? resolveTronResource(selectedYield);
      const kyc = get(
        currentYieldKycGateAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: selectedYield,
          })
        )
      );
      const pricesRequest = getTokensPricesRequest({
        token: selectedToken,
        yieldDto: selectedYield,
      });
      const pricesResult = get(
        pricesAtom.foreground(new PricesKey({ request: pricesRequest }))
      );
      const prices = pricesResult.pipe(AsyncResult.value, Option.getOrNull);
      const validatorsResult = get(
        yieldValidatorsPullAtom(
          new YieldValidatorsKey({
            network: selectedYield?.token.network ?? null,
            search: null,
            yieldId:
              selectedYield && isYieldValidatorSelectionRequired(selectedYield)
                ? selectedYield.id
                : null,
          })
        )
      );
      const isFetching =
        AsyncResult.isInitial(
          get(
            yieldOpportunityAtom.foreground(
              new YieldOpportunityKey({ yieldId: key.integrationId })
            )
          )
        ) ||
        (tokenBalances.enabled &&
          AsyncResult.isInitial(tokenBalances.result)) ||
        AsyncResult.isInitial(validatorsResult);
      const symbol = selectedToken?.symbol ?? "";
      const currentScope = get(walletScopeAtom);
      const ownerCurrent =
        currentScope !== null &&
        sameWalletScopeOwner(currentScope, key.walletScope);
      const appLoading =
        AsyncResult.isInitial(
          get(
            yieldOpportunityAtom.foreground(
              new YieldOpportunityKey({ yieldId: key.integrationId })
            )
          )
        ) || !selectedYield;

      return {
        availableAmount,
        canSubmit: ownerCurrent,
        connected: wallet.status === "connected",
        defaultToMinimum: true,
        entry: {
          amount,
          selectedProviderYieldId: resolveProviderYieldId(selectedYield),
          token: selectedToken,
          tronResource,
          useMaxAmount: intent.useMaxAmount,
          validators,
          yield: selectedYield,
        },
        externalProviders: Boolean(config.externalProviders),
        hasNoYields: false,
        isAppLoading: appLoading,
        isFetching,
        isKycBlocking: kyc.isBlocking,
        isKycLoading: kyc.isLoading,
        isLedgerAccountPlaceholder:
          wallet.status === "connected" &&
          wallet.isLedgerLiveAccountPlaceholder,
        isWalletConnecting: wallet.status === "connecting",
        mount: {
          _tag: "PositionStake",
          balanceId: key.balanceId,
          integrationId: key.integrationId,
        },
        kyc: {
          gate: kyc.gate,
          isBlocking: kyc.isBlocking,
          isChecking: kyc.isChecking,
          providerName: getKycProviderName(selectedYield),
        },
        ownerCurrent,
        positionsData,
        providers: summaryView.providers,
        prices,
        selectedStake: selectedYield,
        selectedToken,
        selectedValidators: validators,
        stakeAmount: amount,
        symbol,
        tronResource,
        validationKey: getPositionDetailsStakeValidationKey(key),
        validateAmount: true,
        wallet: {
          additionalAddresses:
            wallet.status === "connected" ? wallet.additionalAddresses : null,
          address: wallet.status === "connected" ? wallet.address : null,
          isLedgerLive: wallet.isLedgerLive,
        },
        walletCommandIdentity: walletCommandIdentity(wallet),
        walletScope: key.walletScope,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsStakeYieldEntryInputAtom"));

    const yieldEntry = makeYieldEntry(yieldEntryInputAtom);
    const refreshKycAtom = Atom.fnSync(
      (_input: undefined, context) => {
        context.set(
          refreshCurrentYieldKycAtom(
            new CurrentYieldKycGateKey({
              enabled: true,
              yieldDto: context(yieldEntryInputAtom).selectedStake,
            })
          ),
          undefined
        );
      },
      { initialValue: undefined }
    ).pipe(Atom.withLabel("refreshPositionDetailsStakeKycAtom"));

    const viewAtom = Atom.make((get) => {
      const input = get(yieldEntryInputAtom);
      const entry = get(yieldEntry.viewAtom);
      const selectedYield = input.selectedStake;
      const selectedToken = input.selectedToken;
      const availableAmount = input.availableAmount;
      const symbol = input.symbol;
      // Both yield-labelled actions wait for the selected yield, because their
      // label is derived from it.
      const cta =
        entry.cta._tag === "Submit" || entry.cta._tag === "ConnectWallet"
          ? { ...entry.cta, loading: entry.cta.loading || !selectedYield }
          : entry.cta;

      return {
        appLoading: input.isAppLoading,
        cta,
        estimatedRewards: entry.estimatedRewards,
        footerIsLoading: input.isFetching,
        formattedPrice:
          input.prices && selectedYield && selectedToken
            ? formatUsd(
                getTokenPriceInUSD({
                  amount: entry.amount,
                  baseToken: selectedYield.token,
                  pricePerShare: null,
                  prices: input.prices,
                  token: selectedToken,
                })
              )
            : "",
        isFetching: input.isFetching,
        isStakeTokenSameAsGasToken:
          selectedYield && selectedToken
            ? stakeTokenSameAsGasToken({
                stakeToken: selectedToken,
                yieldDto: selectedYield,
              })
            : false,
        kyc: input.kyc,
        ownerCurrent: input.ownerCurrent,
        preparation: entry.preparation,
        providers: input.providers,
        selectedStake: selectedYield,
        selectedToken,
        selectedTokenAvailableAmount: availableAmount
          ? {
              amount: availableAmount,
              fullFormattedAmount: formatNumber(availableAmount),
              shortFormattedAmount: defaultFormattedNumber(availableAmount),
              symbol,
            }
          : null,
        selectedValidators: input.selectedValidators,
        stakeAmount: entry.amount,
        stakeMaxAmount:
          selectedYield &&
          entry.constraints.maximum &&
          !entry.constraints.forceMax
            ? entry.constraints.allowedMaximum.toNumber()
            : null,
        stakeMinAmount:
          selectedYield &&
          entry.constraints.minimum &&
          !entry.constraints.forceMax &&
          entry.constraints.allowedMinimum.isGreaterThan(0)
            ? entry.constraints.allowedMinimum.toNumber()
            : null,
        symbol,
        tronResource: input.tronResource,
        validation: entry.validation,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsStakeViewAtom"));

    const setAmountAtom = Atom.fnSync((amount: BigNumber, context) =>
      context.set(intentAtom, {
        type: "stakeAmount/change",
        amount: amount.toString(10),
      })
    );
    const setTronResourceAtom = Atom.fnSync(
      (tronResource: TronResource, context) =>
        context.set(intentAtom, {
          type: "tronResource/select",
          tronResource,
        })
    );
    const setMaxAmountAtom = appRuntime.fn((_input: undefined, context) => {
      const view = context(viewAtom);
      const maximum = context(yieldEntry.viewAtom).constraints.allowedMaximum;
      context.set(intentAtom, {
        type: "stakeAmount/max",
        amount: maximum.toString(10),
      });
      return TrackingService.use((tracking) =>
        tracking.trackEvent("positionDetailsPageMaxClicked", {
          yieldId: view.selectedStake?.id,
        })
      );
    });
    return Atom.make({
      refreshKycAtom,
      setAmountAtom,
      setMaxAmountAtom,
      setTronResourceAtom,
      submitAtom: yieldEntry.submitAtom,
      viewAtom,
    } as const).pipe(Atom.withLabel("positionDetailsStakeFacadeAtom"));
  }
);

export const positionDetailsStakeViewAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.make((get) => {
      const facade = get(positionDetailsStakeFacadeAtom(key));
      return get(facade.viewAtom);
    })
);

export const refreshPositionDetailsStakeKycAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.set(
          context(positionDetailsStakeFacadeAtom(key)).refreshKycAtom,
          undefined
        ),
      { initialValue: undefined }
    )
);

export const setPositionDetailsStakeAmountAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync((amount: BigNumber, context) =>
      context.set(
        context(positionDetailsStakeFacadeAtom(key)).setAmountAtom,
        amount
      )
    )
);

export const setPositionDetailsStakeMaxAmountAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.set(
          context(positionDetailsStakeFacadeAtom(key)).setMaxAmountAtom,
          undefined
        ),
      { initialValue: undefined }
    )
);

export const setPositionDetailsStakeTronResourceAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync((tronResource: TronResource, context) =>
      context.set(
        context(positionDetailsStakeFacadeAtom(key)).setTronResourceAtom,
        tronResource
      )
    )
);

export const submitPositionDetailsStakeAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.set(
          context(positionDetailsStakeFacadeAtom(key)).submitAtom,
          undefined
        ),
      { initialValue: undefined }
    )
);
