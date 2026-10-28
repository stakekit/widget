import BigNumber from "bignumber.js";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { type PriceRequest, Prices } from "../../../src/domain/health/models";
import { TokenAddress } from "../../../src/domain/identity/identifiers";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionValidatorOptionsViewAtom,
  earnSelectionViewAtom,
  earnSelectionYieldOptionsViewAtom,
} from "../../../src/features/earn/state/earn-selection";
import {
  earnTokenSelectionViewAtom,
  setEarnTokenSearchAtom,
} from "../../../src/features/earn/state/token-selection";
import {
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  selectEarnValidatorAtom,
  setEarnValidatorSearchAtom,
} from "../../../src/features/earn/state/validator-selection";
import {
  earnYieldSelectionViewAtom,
  setEarnYieldSearchAtom,
} from "../../../src/features/earn/state/yield-selection";
import { LegacyResourceSource } from "../../../src/services/api/resource-sources";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { decodeValidator } from "../../utils/validators";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const trackingLayer = (trackEvent: () => Effect.Effect<void>) =>
  Atom.initialValue(
    appRuntime.layer,
    Layer.unwrap(
      makeTestTracking({ trackEvent }).pipe(
        Effect.map((tracking) => tracking.layer)
      )
    ) as never
  );

const tokenSelectionInitialValues = (items: ReadonlyArray<EarnTokenOption>) => [
  Atom.initialValue(earnSelectionStatusViewAtom, {
    blockingFailure: false,
    empty: {
      categories: false,
      tokens: false,
      yields: false,
      validators: false,
    },
    isFetching: false,
    loading: {
      wallet: false,
      categories: false,
      initialSelection: false,
      tokens: false,
      yields: false,
      positions: false,
      validators: false,
    },
  }),
  Atom.initialValue(earnSelectionTokenOptionsViewAtom, {
    canSelect: true,
    items,
    selected: items[0] ?? null,
    waiting: false,
  }),
];

describe("Earn facade", () => {
  it("tracks validator intent through the Earn Selection interface", async () => {
    const selectedYield = yieldApiYieldFixture();
    const validator = decodeValidator(yieldApiValidatorFixture());
    const trackEvent = vi.fn(() => Effect.void);
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        trackingLayer(trackEvent),
        Atom.initialValue(earnSelectionValidatorOptionsViewAtom, {
          canSelect: true,
          enabled: true,
          isDebouncing: false,
          items: [validator],
          page: {
            hasMore: false,
            isLoadingFirstPage: false,
            isLoadingMore: false,
          },
          search: "",
          selected: [validator],
          selectedYield,
        }),
        Atom.initialValue(earnSelectionViewAtom, {
          canSubmit: false,
          form: {
            providerOption: null,
            stakeAmount: "0",
            tronResource: null,
            useMaxAmount: false,
          },
          positions: new Map(),
          selection: {
            category: null,
            token: null,
            validators: [validator],
            yield: selectedYield,
          },
        }),
      ],
    });
    const unmountSelect = registry.mount(selectEarnValidatorAtom);

    try {
      registry.set(selectEarnValidatorAtom, validator.key);
      await expect
        .poll(() =>
          AsyncResult.isSuccess(registry.get(selectEarnValidatorAtom))
        )
        .toBe(true);
      expect(AsyncResult.isFailure(registry.get(selectEarnValidatorAtom))).toBe(
        false
      );
      await expect.poll(() => trackEvent.mock.calls.length).toBe(1);
      expect(trackEvent).toHaveBeenCalledWith("validatorSelected", {
        validatorAddress: validator.address,
        validatorName: validator.name,
      });

      registry.set(earnValidatorModalEventAtom, { _tag: "Opened" });
      await expect
        .poll(() => registry.get(earnValidatorModalEventAtom).waiting)
        .toBe(false);
      expect(trackEvent).toHaveBeenLastCalledWith("selectValidatorModalOpened");
    } finally {
      unmountSelect();
      registry.dispose();
    }
  });

  it("projects client-side token and yield search from semantic options", () => {
    const selectedYield = yieldApiYieldFixture();
    const tokenOption = {
      amount: new BigNumber("10"),
      availableYields: [selectedYield.id],
      source: "balance",
      token: selectedYield.token,
    } satisfies EarnTokenOption;
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        ...tokenSelectionInitialValues([tokenOption]),
        Atom.initialValue(earnSelectionYieldOptionsViewAtom, {
          availableCategories: [],
          canSelect: true,
          items: [selectedYield],
          selected: selectedYield,
          selectedCategory: null,
          waiting: false,
        }),
      ],
    });

    try {
      registry.set(setEarnTokenSearchAtom, selectedYield.token.symbol);
      registry.set(setEarnYieldSearchAtom, selectedYield.metadata.name);

      expect(registry.get(earnTokenSelectionViewAtom)).toMatchObject({
        filtered: [tokenOption],
      });
      expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([
        selectedYield,
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("shows wallet amount and USD value for funded tokens only", async () => {
    const selectedYield = yieldApiYieldFixture();
    const option = (
      symbol: string,
      address: string,
      amount: string | null
    ): EarnTokenOption => ({
      amount: amount === null ? null : new BigNumber(amount),
      availableYields: [selectedYield.id],
      source: amount === null ? "default" : "balance",
      token: {
        ...selectedYield.token,
        address: Schema.decodeSync(TokenAddress)(address),
        symbol,
      },
    });
    const priced = option("PRC", "0xAAA", "1.234567891");
    const unpriced = option("UNP", "0xbbb", "5");
    const empty = option("EMP", "0xccc", "0");
    const unscanned = option("DEF", "0xddd", null);
    const getPrices = vi.fn((_request: PriceRequest) =>
      Effect.succeed(
        new Prices(
          new Map([
            [
              `${priced.token.network}-0xaaa`,
              { price: new BigNumber(100), price24H: undefined },
            ],
          ])
        )
      )
    );
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(LegacyResourceSource, { getPrices } as never) as never
        ),
        ...tokenSelectionInitialValues([priced, unpriced, empty, unscanned]),
      ],
    });
    const unmount = registry.mount(earnTokenSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          registry
            .get(earnTokenSelectionViewAtom)
            .filtered.map(({ token, fundedAmount, fundedUsd }) => ({
              symbol: token.symbol,
              fundedAmount: fundedAmount?.toString(10) ?? null,
              fundedUsd: fundedUsd?.toString(10) ?? null,
            }))
        ).toEqual([
          {
            symbol: "PRC",
            fundedAmount: "1.234567891",
            fundedUsd: "123.4567891",
          },
          { symbol: "UNP", fundedAmount: "5", fundedUsd: null },
          { symbol: "EMP", fundedAmount: null, fundedUsd: null },
          { symbol: "DEF", fundedAmount: null, fundedUsd: null },
        ])
      );
      expect(
        getPrices.mock.calls.flatMap(([request]) =>
          request.tokenList.map((token) => token.symbol)
        )
      ).toEqual(["PRC", "UNP"]);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("hides wallet amount and USD value for dust balances", async () => {
    const selectedYield = yieldApiYieldFixture();
    const option = (
      symbol: string,
      address: string,
      amount: string
    ): EarnTokenOption => ({
      amount: new BigNumber(amount),
      availableYields: [selectedYield.id],
      source: "balance",
      token: {
        ...selectedYield.token,
        address: Schema.decodeSync(TokenAddress)(address),
        symbol,
      },
    });
    const funded = option("FND", "0xaaa", "0.002");
    const pricedDust = option("PDU", "0xbbb", "0.001");
    const weiDust = option("WEI", "0xccc", "0.000000000000000001");
    const unpricedDust = option("UDU", "0xddd", "0.0000005");
    const getPrices = vi.fn((_request: PriceRequest) =>
      Effect.succeed(
        new Prices(
          new Map([
            [
              `${funded.token.network}-0xaaa`,
              { price: new BigNumber(2500), price24H: undefined },
            ],
            [
              `${funded.token.network}-0xbbb`,
              { price: new BigNumber(1), price24H: undefined },
            ],
            [
              `${funded.token.network}-0xccc`,
              { price: new BigNumber(3000), price24H: undefined },
            ],
          ])
        )
      )
    );
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(LegacyResourceSource, { getPrices } as never) as never
        ),
        ...tokenSelectionInitialValues([
          funded,
          pricedDust,
          weiDust,
          unpricedDust,
        ]),
      ],
    });
    const unmount = registry.mount(earnTokenSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          registry
            .get(earnTokenSelectionViewAtom)
            .filtered.map(({ token, fundedAmount, fundedUsd }) => ({
              symbol: token.symbol,
              fundedAmount: fundedAmount?.toString(10) ?? null,
              fundedUsd: fundedUsd?.toString(10) ?? null,
            }))
        ).toEqual([
          { symbol: "FND", fundedAmount: "0.002", fundedUsd: "5" },
          { symbol: "PDU", fundedAmount: null, fundedUsd: null },
          { symbol: "WEI", fundedAmount: null, fundedUsd: null },
          { symbol: "UDU", fundedAmount: null, fundedUsd: null },
        ])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("forwards validator search into the stable selection view", () => {
    const registry = AtomRegistry.make({
      initialValues: [applicationRuntimeInitInitialValue()],
    });
    const unmount = registry.mount(earnValidatorSelectionViewAtom);

    try {
      registry.set(setEarnValidatorSearchAtom, " validator ");
      expect(registry.get(earnValidatorSelectionViewAtom)).toMatchObject({
        isDebouncing: true,
        isLoading: true,
        search: " validator ",
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
