import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  tokenOptionsPullAtom,
  yieldValidatorsAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  DefaultTokenOptionsKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import { earnMachineViewAtom } from "../../src/features/earn/state/atoms-state/machine/atoms";
import {
  earnTokenOptionsPageAtom,
  earnValidatorsPageAtom,
  loadMoreEarnTokenOptionsAtom,
  rememberEarnValidatorsAtom,
} from "../../src/features/earn/state/atoms-state/machine/view-resources";
import { makeEarnView } from "../../src/features/earn/state/atoms-state/resolver/view-model";
import {
  type EarnTokenOption,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/atoms-state/types";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { decodeValidator } from "../utils/validators";

const selectedYield = yieldApiYieldFixture();
const tokenOption = {
  amount: "10",
  availableYields: [selectedYield.id],
  source: "balance",
  token: selectedYield.token,
} satisfies EarnTokenOption;
const resourceValidator = decodeValidator(yieldApiValidatorFixture());
const searchedValidator = decodeValidator(
  yieldApiValidatorFixture({ address: "0xsearched", name: "Searched" })
);
const tokenPullKey = new DefaultTokenOptionsKey({
  category: null,
  network: null,
  tokensForEnabledYieldsOnly: false,
});
const validatorsKey = new YieldValidatorsKey({
  network: selectedYield.token.network,
  selectedYieldId: selectedYield.id,
});
const rememberValidatorsAtom =
  yieldValidatorsAtom(validatorsKey).rememberValidatorsAtom;

const makePullResult = <A>(items: ReadonlyArray<A>, done: boolean) =>
  AsyncResult.success({ done, items: [{ hasNextPage: !done, items }] });

/**
 * Publishes a view that names its resources by key, the way `resolveEarnView`
 * does, and seeds the resource Atoms those keys resolve to.
 */
const makeRegistry = ({
  publishedKeys = true,
  tokenOptionsDone = false,
}: {
  publishedKeys?: boolean;
  tokenOptionsDone?: boolean;
} = {}) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        earnMachineViewAtom,
        makeEarnView({
          intent: makeDefaultEarnIntent(),
          resources: {
            tokenOptions: {
              items: [tokenOption],
              pullKey: publishedKeys ? tokenPullKey : null,
              waiting: false,
            },
            validators: publishedKeys
              ? {
                  enabled: true,
                  items: [resourceValidator],
                  key: validatorsKey,
                }
              : { enabled: false, items: [], key: null },
          },
          selection: { token: tokenOption, yield: selectedYield },
          status: "ready",
        })
      ),
      [
        tokenOptionsPullAtom(tokenPullKey),
        makePullResult([tokenOption], tokenOptionsDone),
      ],
      [
        yieldValidatorsAtom(validatorsKey).validatorsPullAtom(
          new YieldValidatorsPullKey({ search: "searched" })
        ),
        makePullResult([searchedValidator], true),
      ],
      [
        yieldValidatorsAtom(validatorsKey).validatorsPullAtom(
          new YieldValidatorsPullKey({ search: null })
        ),
        makePullResult([], true),
      ],
    ],
  });

describe("Earn view resources", () => {
  it("projects token pagination from the published pull key", () => {
    const registry = makeRegistry();

    try {
      expect(registry.get(earnTokenOptionsPageAtom)).toEqual({
        hasMore: true,
        isLoadingFirstPage: false,
        isLoadingMore: false,
      });

      const set = vi.spyOn(registry, "set");
      registry.set(loadMoreEarnTokenOptionsAtom, undefined);
      expect(set).toHaveBeenCalledWith(
        tokenOptionsPullAtom(tokenPullKey),
        undefined
      );
    } finally {
      registry.dispose();
    }
  });

  it("does not pull past the last token page", () => {
    const registry = makeRegistry({ tokenOptionsDone: true });

    try {
      expect(registry.get(earnTokenOptionsPageAtom).hasMore).toBe(false);

      const set = vi.spyOn(registry, "set");
      registry.set(loadMoreEarnTokenOptionsAtom, undefined);
      expect(set).not.toHaveBeenCalledWith(
        tokenOptionsPullAtom(tokenPullKey),
        undefined
      );
    } finally {
      registry.dispose();
    }
  });

  it("reports no pages before a stage publishes its resource keys", () => {
    const registry = makeRegistry({ publishedKeys: false });

    try {
      expect(registry.get(earnTokenOptionsPageAtom).hasMore).toBe(false);
      expect(registry.get(earnValidatorsPageAtom(null)).items).toEqual([]);

      const set = vi.spyOn(registry, "set");
      registry.set(loadMoreEarnTokenOptionsAtom, undefined);
      registry.set(rememberEarnValidatorsAtom, [searchedValidator]);
      expect(set).not.toHaveBeenCalledWith(
        tokenOptionsPullAtom(tokenPullKey),
        undefined
      );
      expect(set).not.toHaveBeenCalledWith(rememberValidatorsAtom, [
        searchedValidator,
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("serves resource validators without a search and pulled ones with", () => {
    const registry = makeRegistry();

    try {
      expect(registry.get(earnValidatorsPageAtom(null)).items).toEqual([
        resourceValidator,
      ]);
      expect(registry.get(earnValidatorsPageAtom("searched")).items).toEqual([
        searchedValidator,
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("remembers validators against the published validators key", () => {
    const registry = makeRegistry();
    const unmount = registry.mount(rememberValidatorsAtom);

    try {
      registry.set(rememberEarnValidatorsAtom, [searchedValidator]);
      expect(registry.get(rememberValidatorsAtom)).toEqual(
        new Map([[searchedValidator.key, searchedValidator]])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
