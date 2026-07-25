import { Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "../../src/features/earn/state/atoms-state/machine/atoms";
import { makeEarnView } from "../../src/features/earn/state/atoms-state/resolver/view-model";
import {
  type EarnTokenOption,
  type EarnValidatorsViewResource,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/atoms-state/types";
import {
  earnTokenSelectionViewAtom,
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  earnYieldSelectionViewAtom,
  loadMoreEarnTokensAtom,
  loadMoreEarnValidatorsAtom,
  removeEarnValidatorAtom,
  retryEarnPageAtom,
  selectEarnValidatorAtom,
  setEarnTokenSearchAtom,
  setEarnValidatorSearchAtom,
  setEarnYieldSearchAtom,
} from "../../src/features/earn/state/earn-facade";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import type { PullPage } from "../../src/shared/effect/pagination";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { decodeValidator } from "../utils/validators";

const makePullAtom = <A>(
  items: ReadonlyArray<A>,
  pulled: () => void
): Atom.Writable<Atom.PullResult<PullPage<A>, never>, void> =>
  Atom.writable(
    () =>
      AsyncResult.success({
        done: false,
        items: [{ hasNextPage: true, items }],
      }),
    () => pulled()
  );

const noopRememberValidatorsAtom: EarnValidatorsViewResource["rememberValidatorsAtom"] =
  Atom.writable(
    () => new Map(),
    () => {}
  );

describe("Earn facade", () => {
  it("selects cached validators and ignores unknown selection or removal keys", async () => {
    const selectedYield = yieldApiYieldFixture();
    const validator = decodeValidator(yieldApiValidatorFixture());
    const trackEvent = vi.fn(() => Effect.void);
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            TrackingService,
            TrackingService.of({
              trackEvent,
              trackPageView: () => Effect.void,
            })
          ) as never
        ),
        Atom.initialValue(
          earnMachineViewAtom,
          makeEarnView({
            intent: makeDefaultEarnIntent(),
            resources: {
              validators: {
                enabled: true,
                items: [validator],
                rememberValidatorsAtom: noopRememberValidatorsAtom,
                validatorsPullAtom: () => makePullAtom([], () => undefined),
              },
            },
            selection: { yield: selectedYield },
            status: "ready",
          })
        ),
      ],
    });
    const unmountSelect = registry.mount(selectEarnValidatorAtom);
    const unmountRemove = registry.mount(removeEarnValidatorAtom);

    try {
      expect(
        registry.get(earnMachineViewAtom).resources.validators.items
      ).toEqual([validator]);
      registry.set(selectEarnValidatorAtom, "unknown-validator" as never);
      await expect
        .poll(() => registry.get(selectEarnValidatorAtom).waiting)
        .toBe(false);
      expect(trackEvent).not.toHaveBeenCalled();

      registry.set(selectEarnValidatorAtom, validator.key);
      await expect
        .poll(() => registry.get(selectEarnValidatorAtom).waiting)
        .toBe(false);
      expect(AsyncResult.isFailure(registry.get(selectEarnValidatorAtom))).toBe(
        false
      );
      expect(
        registry.get(earnMachineIntentAtom).selectedValidatorKeys
      ).toContain(validator.key);
      await expect.poll(() => trackEvent.mock.calls.length).toBe(1);

      expect(trackEvent).toHaveBeenCalledWith("validatorSelected", {
        validatorAddress: validator.address,
        validatorName: validator.name,
      });

      registry.set(removeEarnValidatorAtom, "unknown-validator" as never);
      await expect
        .poll(() =>
          AsyncResult.isSuccess(registry.get(removeEarnValidatorAtom))
        )
        .toBe(true);
      expect(trackEvent).toHaveBeenCalledTimes(1);

      registry.set(earnValidatorModalEventAtom, { _tag: "Opened" });
      await expect
        .poll(() => registry.get(earnValidatorModalEventAtom).waiting)
        .toBe(false);
      expect(trackEvent).toHaveBeenLastCalledWith("selectValidatorModalOpened");

      registry.set(earnValidatorModalEventAtom, { _tag: "Closed" });
      await expect
        .poll(() => registry.get(earnValidatorModalEventAtom).waiting)
        .toBe(false);
      expect(trackEvent).toHaveBeenLastCalledWith("selectValidatorModalClosed");

      registry.set(earnValidatorModalEventAtom, { _tag: "ViewMoreClicked" });
      await expect
        .poll(() => registry.get(earnValidatorModalEventAtom).waiting)
        .toBe(false);
      expect(trackEvent).toHaveBeenLastCalledWith(
        "selectValidatorViewMoreClicked"
      );
    } finally {
      unmountRemove();
      unmountSelect();
      registry.dispose();
    }
  });

  it("projects search and routes pagination and retry commands", () => {
    const selectedYield = yieldApiYieldFixture();
    const tokenOption = {
      amount: "10",
      availableYields: [selectedYield.id],
      source: "balance",
      token: selectedYield.token,
    } satisfies EarnTokenOption;
    const validator = decodeValidator(yieldApiValidatorFixture());
    const tokenPull = vi.fn();
    const validatorPull = vi.fn();
    const tokenPullAtom = makePullAtom([tokenOption], tokenPull);
    const validatorPullAtom = makePullAtom([validator], validatorPull);
    const validatorsPullAtom = vi.fn(() => validatorPullAtom);
    const retry = vi.fn();
    const retryTargetAtom = Atom.readable(
      () => undefined,
      () => retry()
    );
    const machine = makeEarnView({
      can: {
        selectToken: true,
        selectValidator: true,
        selectYield: true,
        submit: true,
      },
      intent: makeDefaultEarnIntent(),
      resources: {
        tokenOptions: {
          items: [tokenOption],
          pullAtom: tokenPullAtom,
          waiting: false,
        },
        validators: {
          enabled: true,
          items: [validator],
          rememberValidatorsAtom: noopRememberValidatorsAtom,
          validatorsPullAtom,
        },
        yields: { items: [selectedYield], waiting: false },
      },
      retryTargetAtom,
      selection: {
        token: tokenOption,
        yield: selectedYield,
      },
      status: "ready",
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(earnMachineViewAtom, machine),
        Atom.initialValue(
          widgetConfigAtom,
          normalizeWidgetConfig({ apiKey: "test", variant: "default" })
        ),
      ],
    });

    try {
      registry.set(retryEarnPageAtom, undefined);
      expect(retry).toHaveBeenCalledOnce();

      const unmountValidators = registry.mount(earnValidatorSelectionViewAtom);
      try {
        registry.set(setEarnTokenSearchAtom, selectedYield.token.symbol);
        registry.set(setEarnYieldSearchAtom, selectedYield.metadata.name);

        expect(registry.get(earnTokenSelectionViewAtom).filtered).toEqual([
          tokenOption,
        ]);
        expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([
          selectedYield,
        ]);

        registry.set(loadMoreEarnTokensAtom, undefined);
        expect(tokenPull).toHaveBeenCalledOnce();

        registry.set(loadMoreEarnValidatorsAtom, undefined);
        expect(validatorPull).toHaveBeenCalledOnce();

        registry.set(setEarnValidatorSearchAtom, " validator ");
        expect(registry.get(earnValidatorSelectionViewAtom)).toMatchObject({
          isDebouncing: true,
          isLoading: true,
          search: " validator ",
        });
      } finally {
        unmountValidators();
      }
    } finally {
      registry.dispose();
    }
  });
});
