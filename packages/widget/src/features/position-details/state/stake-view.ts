import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { TronResource } from "../../../domain/action/tron-resource";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import { stakeTokenSameAsGasToken } from "../../../domain/earn/stake";
import type { ValidatorKey } from "../../../domain/earn/validator";
import {
  getYieldActionArg,
  isYieldValidatorSelectionRequired,
  resolveYieldProviderOption,
} from "../../../domain/earn/yield";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import { getBalanceValidators } from "../../../domain/portfolio/positions";
import {
  equalTokens,
  type Token,
  tokenString,
} from "../../../domain/token/token";
import { sameWalletScopeOwner } from "../../../domain/wallet/wallet-scope";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../resources/yield-opportunity/index";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../resources/yield-positions/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { getPullResultItems } from "../../../shared/effect/pagination";
import { tokenBalancesScanAtom } from "../../portfolio/index";
import { walletScopeAtom } from "../../wallet/index";
import {
  getYieldEntryPriceToken,
  isHiddenTokenBalance,
  makeConfidentialTokenBalance,
  makeYieldEntry,
  YieldValidatorsKey,
  yieldValidatorsPullAtom,
} from "../../yield-entry/index";
import {
  getPositionStakeTokens,
  type PositionStakeTokenOption,
  resolvePositionStakeToken,
} from "../model/stake-token";
import {
  type PositionDetailsStakeEntryKey,
  positionDetailsStakeAtom,
} from "./stake-entry";

const resolveTronResource = (selectedYield: EarnYieldWithProvider | null) => {
  const argument = selectedYield
    ? getYieldActionArg(selectedYield, "enter", "tronResource")
    : null;
  return argument?.required
    ? EArray.head(argument.options).pipe(Option.getOrNull)
    : null;
};

const getPositionDetailsStakeValidationKey = (
  key: PositionDetailsStakeEntryKey,
  token: Token | null
): string =>
  JSON.stringify([
    key.integrationId,
    key.balanceId,
    key.walletScope.network,
    key.walletScope.address,
    key.walletScope.additionalAddresses,
    token ? tokenString(token) : null,
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
    const positionBalancesResultAtom = positionBalancesAtom(positionKey);
    // Staking more must target the validators already holding this position;
    // the catalog only refreshes their display details.
    const selectedValidatorsAtom = Atom.make((get) => {
      const selectedYield = get(selectedYieldAtom);
      if (!selectedYield || !isYieldValidatorSelectionRequired(selectedYield)) {
        return new Map<ValidatorKey, EarnValidator>();
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
    }).pipe(Atom.withLabel("positionDetailsStakeSelectedValidatorsAtom"));
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
          equalTokens(item.token, token)
        );
        if (balance) return exactDecimal(balance.amount);
        return ownerCurrent ? exactZero() : null;
      };
      const selectedToken = selectedYield
        ? resolvePositionStakeToken(selectedYield, intent.token)
        : null;
      const tokenOptions = selectedYield
        ? getPositionStakeTokens(selectedYield).map(
            (token): PositionStakeTokenOption => {
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
    }).pipe(Atom.withLabel("positionDetailsStakeTokenAtom"));
    const tokenBalance = makeConfidentialTokenBalance(
      Atom.make((get) => {
        const stake = get(stakeTokenAtom);
        return {
          owner: stake.ownerCurrent ? key.walletScope.address : null,
          publicAmount: stake.publicAmount,
          token: stake.selectedToken,
          yield: stake.selectedYield,
        };
      }).pipe(Atom.withLabel("positionDetailsStakeTokenBalanceInputAtom"))
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
      const isFetching =
        AsyncResult.isInitial(
          get(
            yieldOpportunityAtom.foreground(
              new YieldOpportunityKey({ yieldId: key.integrationId })
            )
          )
        ) ||
        stake.tokenBalancesLoading ||
        AsyncResult.isInitial(validatorsResult);
      const symbol = selectedToken?.symbol ?? "";
      const appLoading =
        AsyncResult.isInitial(
          get(
            yieldOpportunityAtom.foreground(
              new YieldOpportunityKey({ yieldId: key.integrationId })
            )
          )
        ) || !selectedYield;
      const readiness = (() => {
        if (appLoading) return { _tag: "Loading" } as const;
        if (isFetching) return { _tag: "Refreshing" } as const;
        if (!ownerCurrent) return { _tag: "Blocked" } as const;
        return { _tag: "Ready" } as const;
      })();

      return {
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
        validationKey: getPositionDetailsStakeValidationKey(key, selectedToken),
      } as const;
    }).pipe(Atom.withLabel("positionDetailsStakeYieldEntryInputAtom"));

    const yieldEntry = makeYieldEntry(yieldEntryInputAtom);

    const viewAtom = Atom.make((get) => {
      const input = get(yieldEntryInputAtom);
      const entry = get(yieldEntry.viewAtom);
      const selectedYield = input.selectedStake;
      const selectedToken = input.selectedToken;
      const availableAmount = input.availableAmount;
      const symbol = input.symbol;
      const isStakeTokenSameAsGasToken =
        selectedYield && selectedToken
          ? stakeTokenSameAsGasToken({
              stakeToken: selectedToken,
              yieldDto: selectedYield,
            })
          : false;
      // Both yield-labelled actions wait for the selected yield, because their
      // label is derived from it.
      const cta =
        entry.cta._tag === "Submit" || entry.cta._tag === "ConnectWallet"
          ? { ...entry.cta, loading: entry.cta.loading || !selectedYield }
          : entry.cta;

      return {
        appLoading: entry.appLoading,
        // A hidden balance is unknown, so Max would clamp to zero.
        canUseMax: !isStakeTokenSameAsGasToken && !input.hiddenTokenBalance,
        cta,
        estimatedRewards: entry.estimatedRewards,
        footerIsLoading: input.isFetching,
        hiddenTokenBalance: input.hiddenTokenBalance,
        isFetching: input.isFetching,
        kyc: entry.kyc,
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
        tokenSelection: {
          // A lone token needs no picker.
          selectable: input.tokenOptions.length > 1,
          options: input.tokenOptions,
        },
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
    const selectTokenAtom = Atom.fnSync((token: Token, context) =>
      context.set(intentAtom, { type: "token/select", token })
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
      hideTokenBalanceAtom: tokenBalance.hideAtom,
      refreshKycAtom: yieldEntry.refreshKycAtom,
      revealTokenBalanceAtom: tokenBalance.revealAtom,
      selectTokenAtom,
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

export const selectPositionDetailsStakeTokenAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync((token: Token, context) =>
      context.set(
        context(positionDetailsStakeFacadeAtom(key)).selectTokenAtom,
        token
      )
    )
);

export const revealPositionDetailsStakeTokenBalanceAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.set(
          context(positionDetailsStakeFacadeAtom(key)).revealTokenBalanceAtom,
          undefined
        ),
      { initialValue: undefined }
    )
);

export const hidePositionDetailsStakeTokenBalanceAtom = Atom.family(
  (key: PositionDetailsStakeEntryKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.set(
          context(positionDetailsStakeFacadeAtom(key)).hideTokenBalanceAtom,
          undefined
        ),
      { initialValue: undefined }
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
