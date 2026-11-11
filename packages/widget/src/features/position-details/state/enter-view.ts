import type BigNumber from "bignumber.js";
import { Array as EArray, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import type { TronResource } from "../../../domain/earn/tron-resource";
import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../domain/earn/validator";
import {
  getYieldActionArg,
  isYieldValidatorSelectionRequired,
  resolveYieldProviderOption,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import { getBalanceValidators } from "../../../domain/portfolio/positions";
import {
  equalTokens,
  sameTokenContract,
  type Token,
  tokenString,
} from "../../../domain/token/token";
import { sameWalletScopeOwner } from "../../../domain/wallet/wallet-scope";
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
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../resources/yield-positions/yield-positions";
import { appRuntime } from "../../../runtime/app-runtime";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  presentedValue,
  toPresentable,
} from "../../../shared/effect/async-result";
import { getPullResultItems } from "../../../shared/effect/pagination";
import { compositeKey } from "../../../shared/lib/composite-key";
import { tokenBalancesScanAtom } from "../../portfolio/index";
import { walletScopeAtom } from "../../wallet/index";
import {
  getNetworkFeeEstimate,
  getYieldEntryPriceToken,
  isHiddenTokenBalance,
  makeConfidentialTokenBalance,
  makeYieldEntry,
  YieldValidatorsKey,
  yieldValidatorsPullAtom,
} from "../../yield-entry/index";
import {
  getPositionEnterTokens,
  type PositionEnterTokenOption,
  resolvePositionEnterToken,
} from "../model/enter-token";
import {
  type PositionDetailsEnterKey,
  positionDetailsEnterAtom,
} from "./enter-entry";
import { retryPositionDetailsLoad } from "./retry";

const resolveTronResource = (selectedYield: EarnYieldWithProvider | null) => {
  const argument = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "tronResource")
    : null;
  return argument?.required
    ? EArray.head(argument.options).pipe(Option.getOrNull)
    : null;
};

const getPositionDetailsEnterValidationKey = (
  key: PositionDetailsEnterKey,
  token: Token | null
): string =>
  compositeKey([
    key.integrationId,
    key.balanceId,
    key.walletScope.network,
    key.walletScope.address,
    key.walletScope.additionalAddresses,
    token ? tokenString(token) : null,
  ]);

/**
 * Position stake entry's view and commands for one key. Every read of a key
 * gets the same Atoms.
 *
 * The record lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the record alive.
 */
export const positionDetailsEnterAtoms = Atom.family(
  (key: PositionDetailsEnterKey) => {
    const intentAtom = positionDetailsEnterAtom(key);
    const selectedYieldResultAtom = Atom.make((get) =>
      toPresentable(
        get(
          yieldOpportunityAtom.foreground(
            new YieldOpportunityKey({ yieldId: key.integrationId })
          )
        )
      )
    ).pipe(Atom.withLabel("positionDetailsEnterSelectedYieldResultAtom"));
    const selectedYieldAtom = Atom.make((get) =>
      presentedValue(get(selectedYieldResultAtom))
    ).pipe(Atom.withLabel("positionDetailsEnterSelectedYieldAtom"));
    const positionKey = new PositionBalancesKey({
      balanceId: key.balanceId,
      scope: key.walletScope,
      yieldId: key.integrationId,
    });
    const positionsByTypeAtom = positionBalancesByTypeAtom(positionKey);
    const positionBalancesResultAtom = positionBalancesAtom(positionKey);
    // Staking more must target the validators already holding this position;
    // the catalog only refreshes their display details.
    const selectedValidatorsAtom = Atom.make((get) => {
      const selectedYield = get(selectedYieldAtom);
      if (!selectedYield || !isYieldValidatorSelectionRequired(selectedYield)) {
        return new Map<EarnValidatorKey, EarnValidator>();
      }
      const balances =
        get(positionBalancesResultAtom).pipe(
          AsyncResult.value,
          Option.getOrNull
        )?.balances ?? [];
      const catalog = getPullResultItems(
        get(
          yieldValidatorsPullAtom(
            new YieldValidatorsKey({
              network: selectedYield.token.network,
              search: null,
              yieldId: selectedYield.id,
            })
          )
        )
      ).flatMap((page) => page.items);
      return new Map(
        balances.flatMap(getBalanceValidators).map((validator) => {
          const current =
            catalog.find((item) => item.key === validator.key) ?? validator;
          return [current.key, current] as const;
        })
      );
    }).pipe(Atom.withLabel("positionDetailsEnterSelectedValidatorsAtom"));
    const stakeTokenAtom = Atom.make((get) => {
      const intent = get(intentAtom);
      const selectedYield = get(selectedYieldAtom);
      const tokenBalances = get(tokenBalancesScanAtom);
      const tokenBalanceValues = tokenBalances.result.pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const currentScope = get(walletScopeAtom);
      const ownerCurrent =
        currentScope !== null &&
        sameWalletScopeOwner(currentScope, key.walletScope);
      // The scan covers the current wallet, so a token missing from it means a
      // zero balance only when that wallet owns this position.
      const getPublicAmount = (token: Token) => {
        if (tokenBalanceValues === null) return null;
        const balance = tokenBalanceValues.find((item) =>
          equalTokens(item.token, token) || sameTokenContract(item.token, token)
        );
        if (balance) return exactDecimal(balance.amount);
        return ownerCurrent ? exactZero() : null;
      };
      const selectedToken = selectedYield
        ? resolvePositionEnterToken(selectedYield, intent.token)
        : null;
      const tokenOptions = selectedYield
        ? getPositionEnterTokens(selectedYield).map(
            (token): PositionEnterTokenOption => {
              const hiddenBalance = isHiddenTokenBalance(selectedYield, token);
              return {
                amount: hiddenBalance ? null : getPublicAmount(token),
                hiddenBalance,
                selected:
                  selectedToken !== null && equalTokens(token, selectedToken),
                token,
              };
            }
          )
        : [];

      return {
        intent,
        ownerCurrent,
        publicAmount: selectedToken ? getPublicAmount(selectedToken) : null,
        selectedToken,
        selectedYield,
        tokenBalancesLoading:
          tokenBalances.enabled && AsyncResult.isInitial(tokenBalances.result),
        tokenOptions,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsEnterTokenAtom"));
    const tokenBalance = makeConfidentialTokenBalance(
      Atom.make((get) => {
        const stake = get(stakeTokenAtom);
        return {
          owner: stake.ownerCurrent ? key.walletScope.address : null,
          publicAmount: stake.publicAmount,
          token: stake.selectedToken,
          yield: stake.selectedYield,
        };
      }).pipe(Atom.withLabel("positionDetailsEnterTokenBalanceInputAtom"))
    );
    const yieldEntryInputAtom = Atom.make((get) => {
      const { intent, ownerCurrent, selectedToken, selectedYield, ...stake } =
        get(stakeTokenAtom);
      const balance = get(tokenBalance.balanceAtom);
      const positionsByType = get(positionsByTypeAtom).pipe(
        AsyncResult.value,
        Option.getOrNull
      );
      const selectedYieldHasActivePosition =
        (positionsByType?.get("active")?.length ?? 0) > 0;
      const rawAmount = exactDecimal(intent.stakeAmount);
      const amount =
        intent.useMaxAmount || !rawAmount.isZero() ? rawAmount : exactZero();
      const validators = get(selectedValidatorsAtom);
      const tronResource =
        intent.tronResource ?? resolveTronResource(selectedYield);
      const priceToken = getYieldEntryPriceToken(selectedYield, selectedToken);
      const pricesRequest = getTokensPricesRequest({
        token: priceToken,
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
      const selectedYieldResult = get(selectedYieldResultAtom);
      const isFetching =
        selectedYieldResult._tag === "Loading" ||
        stake.tokenBalancesLoading ||
        AsyncResult.isInitial(validatorsResult);
      const symbol = selectedToken?.symbol ?? "";
      // A failed yield is not loading: the view says so (`status`), and the
      // entry, with nothing to enter, stays as it would while loading.
      const readiness = (() => {
        if (!selectedYield) return { _tag: "Loading" } as const;
        if (isFetching) return { _tag: "Refreshing" } as const;
        if (!ownerCurrent) return { _tag: "Blocked" } as const;
        return { _tag: "Ready" } as const;
      })();
      const status = (() => {
        if (selectedYieldResult._tag === "Failed") {
          return { _tag: "Failed" } as const;
        }
        if (!selectedYield) return { _tag: "Loading" } as const;
        return { _tag: "Ready" } as const;
      })();

      return {
        // The amount defaults to the minimum, so there is always one.
        amountEntered: true,
        amountInitialization: "DefaultToMinimum",
        availableAmount: balance.availableAmount,
        entry: {
          amount,
          selectedProviderOption: selectedYield
            ? resolveYieldProviderOption(selectedYield, null)
            : null,
          token: selectedToken,
          tronResource,
          useMaxAmount: intent.useMaxAmount,
          validators,
          yield: selectedYield,
        },
        hasNoYields: false,
        hiddenTokenBalance: balance.hiddenTokenBalance,
        isFetching,
        mount: {
          _tag: "PositionStake",
          balanceId: key.balanceId,
          integrationId: key.integrationId,
        },
        ownerCurrent,
        prices,
        pricesStatus: toPresentable(pricesResult)._tag,
        priceToken,
        readiness,
        revealedTokenBalance: balance.revealedTokenBalance,
        selectedStake: selectedYield,
        selectedYieldHasActivePosition,
        selectedToken,
        selectedValidators: validators,
        stakeAmount: amount,
        symbol,
        tokenOptions: stake.tokenOptions,
        tronResource,
        validationKey: getPositionDetailsEnterValidationKey(key, selectedToken),
        status,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsEnterYieldEntryInputAtom"));

    const yieldEntry = makeYieldEntry(yieldEntryInputAtom);

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
        appLoading: entry.appLoading,
        // A hidden balance is unknown, so Max would clamp to zero; a gas token
        // one waits for the gas Max must leave.
        canUseMax: !input.hiddenTokenBalance && entry.maxAmount !== null,
        /** Max has nothing to fill, such as a balance the gas would use up. */
        maxFillsNothing: entry.maxAmount?.isZero() ?? false,
        cta,
        estimatedRewards: entry.estimatedRewards,
        footerIsLoading: input.isFetching,
        hiddenTokenBalance: input.hiddenTokenBalance,
        isFetching: input.isFetching,
        kyc: entry.kyc,
        maxGasReserveNote: entry.maxGasReserveNote,
        networkFee: getNetworkFeeEstimate({
          connected: entry.connected,
          hidden: entry.gasFeeHidden,
          pending: entry.networkFeePending,
          prices: input.prices,
          simulation: entry.networkFeeSimulation,
        }),
        ownerCurrent: input.ownerCurrent,
        preparation: entry.preparation,
        priceUsd:
          input.prices && selectedYield && input.priceToken
            ? getTokenPriceInUSD({
                amount: entry.amount,
                baseToken: selectedYield.token,
                pricePerShare: null,
                prices: input.prices,
                token: input.priceToken,
              })
            : null,
        // Prices only value the typed amount; while they load, its fiat
        // holds a placeholder and the rest of the form shows.
        priceUsdStatus: input.pricesStatus,
        providers: entry.providers,
        revealedTokenBalance: input.revealedTokenBalance,
        revealTokenBalanceStatus: get(tokenBalance.revealStatusAtom),
        selectedStake: selectedYield,
        selectedToken,
        selectedTokenAvailableAmount:
          availableAmount !== null ? { amount: availableAmount, symbol } : null,
        selectedValidators: input.selectedValidators,
        stakeAmount: entry.amount,
        stakeMaxAmount:
          selectedYield &&
          entry.constraints.maximum &&
          !entry.constraints.forceMax
            ? entry.constraints.allowedMaximum
            : null,
        stakeMinAmount:
          selectedYield &&
          entry.constraints.minimum &&
          !entry.constraints.forceMax &&
          entry.constraints.allowedMinimum.isGreaterThan(0)
            ? entry.constraints.allowedMinimum
            : null,
        symbol,
        /** The yield's first load: still loading, failed (retry), or loaded. */
        status: input.status,
        tokenSelection: {
          // A lone token needs no picker.
          selectable: input.tokenOptions.length > 1,
          options: input.tokenOptions,
        },
        tronResource: input.tronResource,
        validation: entry.validation,
      } as const;
    }).pipe(Atom.withLabel("positionDetailsEnterViewAtom"));

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
    const selectTokenAtom = Atom.fnSync((token: Token, context) =>
      context.set(intentAtom, { type: "token/select", token })
    );
    const setMaxAmountAtom = appRuntime.fn((_input: undefined, context) => {
      const view = context(viewAtom);
      const { maxAmount } = context(yieldEntry.viewAtom);
      if (maxAmount === null) return Effect.void;
      context.set(intentAtom, {
        type: "stakeAmount/max",
        amount: maxAmount.toString(10),
      });
      return TrackingService.use((tracking) =>
        tracking.trackEvent("positionDetailsPageMaxClicked", {
          yieldId: view.selectedStake?.id,
        })
      );
    });
    const retryAtom = Atom.fnSync(
      (_input: undefined, context) =>
        retryPositionDetailsLoad(context, {
          scope: key.walletScope,
          yieldId: key.integrationId,
        }),
      { initialValue: undefined }
    );
    return Atom.make({
      hideTokenBalanceAtom: tokenBalance.hideAtom,
      refreshKycAtom: yieldEntry.refreshKycAtom,
      retryAtom,
      revealTokenBalanceAtom: tokenBalance.revealAtom,
      selectTokenAtom,
      setAmountAtom,
      setMaxAmountAtom,
      setTronResourceAtom,
      submitAtom: yieldEntry.submitAtom,
      viewAtom,
    } as const).pipe(Atom.withLabel("positionDetailsEnterAtoms"));
  }
);
