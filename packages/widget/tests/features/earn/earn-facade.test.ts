import BigNumber from "bignumber.js";
import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import { type PriceRequest, Prices } from "../../../src/domain/finance/prices";
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
  selectEarnValidatorAtom,
} from "../../../src/features/earn/state/validator-selection";
import {
  earnYieldSelectionViewAtom,
  setEarnYieldSearchAtom,
} from "../../../src/features/earn/state/yield-selection";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { LegacyResourceSource } from "../../../src/services/api/resource-sources";
import {
  yieldApiProviderFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
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
            amountTouched: false,
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

  it("finds token contracts without matching addressless tokens", () => {
    const baseYield = yieldApiYieldFixture();
    const nativeOption = {
      amount: null,
      availableYields: [baseYield.id],
      funded: false,
      source: "default",
      token: baseYield.token,
    } satisfies EarnTokenOption;
    const contractOption = {
      ...nativeOption,
      token: {
        ...baseYield.token,
        address: Schema.decodeSync(TokenAddress)("0xaBc123"),
      },
    };
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        ...tokenSelectionInitialValues([nativeOption, contractOption]),
      ],
    });

    try {
      for (const search of ["  0xABC123  ", "Bc12", "ETH 0xabc"]) {
        registry.set(setEarnTokenSearchAtom, search);
        expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([
          expect.objectContaining(contractOption),
        ]);
      }

      registry.set(setEarnTokenSearchAtom, "0xdef456");
      expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([]);

      registry.set(setEarnTokenSearchAtom, " \t ");
      expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([
        expect.objectContaining(nativeOption),
        expect.objectContaining(contractOption),
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("projects client-side token and yield search from semantic options", () => {
    const selectedYield = {
      ...yieldApiYieldFixture(),
      provider: yieldApiProviderFixture({ name: "Unique Provider" }),
    };
    const tokenOption = {
      amount: new BigNumber("10"),
      availableYields: [selectedYield.id],
      funded: true,
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

      for (const search of [
        "unique provider",
        "PrOvIdEr",
        "  Provider  ",
        "Provider\tEthereum",
        " \n ",
      ]) {
        registry.set(setEarnYieldSearchAtom, search);
        expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([
          selectedYield,
        ]);
      }

      registry.set(setEarnTokenSearchAtom, " \t eTh \n ");
      expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([
        expect.objectContaining(tokenOption),
      ]);

      registry.set(setEarnTokenSearchAtom, "Ethereum ETH");
      expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([
        expect.objectContaining(tokenOption),
      ]);

      registry.set(setEarnTokenSearchAtom, "Ethereum missing");
      expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([]);

      registry.set(setEarnYieldSearchAtom, "Ethereum missing");
      expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([]);

      registry.set(setEarnYieldSearchAtom, "unmatched provider");
      expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([]);

      registry.set(setEarnYieldSearchAtom, "");
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
      funded: amount !== null,
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
      funded: false,
      source: "balance",
      token: {
        ...selectedYield.token,
        address: Schema.decodeSync(TokenAddress)(address),
        symbol,
      },
    });
    const funded = option("FND", "0xaaa", "0.002");
    const pricedDust = option("PDU", "0xbbb", "0.001");
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
        ...tokenSelectionInitialValues([funded, pricedDust]),
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
        ])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
