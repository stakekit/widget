import { Effect, Layer, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import type { EarnYield } from "../../../src/domain/earn/models";
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  earnSelectionStatusViewAtom,
  earnSelectionViewAtom,
  setEarnSelectionAmountAtom,
} from "../../../src/features/earn/state/earn-selection";
import { earnEntryAtom } from "../../../src/features/earn/state/earn-selection/state/atoms";
import type { EarnEntry } from "../../../src/features/earn/state/earn-selection/types";
import {
  LegacyResourceSource,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../../fixtures";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const baseYield = yieldApiYieldFixture();
const validatorYield: EarnYield = {
  ...baseYield,
  mechanics: { ...baseYield.mechanics, requiresValidatorSelection: true },
};

// The stubbed source bypasses decoding, so the derived `key` is supplied the
// same way the schema derives it from the address.
const validator = (address: string, name: string) => ({
  ...yieldApiValidatorFixture({ address, name }),
  key: address as never,
});
const first = validator("0x1111111111111111111111111111111111111111", "First");
const requested = validator(
  "0x2222222222222222222222222222222222222222",
  "Requested"
);

const entry = (requestedValidator: string): EarnEntry => ({
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: false,
  initParams: {
    accountId: null,
    balanceId: null,
    network: "ethereum",
    pendingaction: null,
    tab: "earn",
    token: null,
    validator: requestedValidator,
    yieldId: validatorYield.id,
  },
  preferredTokenYieldsPerNetwork: null,
  walletResolution: "settled",
  walletScope: new WalletScopeKey({
    address: Schema.decodeSync(WalletAddress)(
      "0x9999999999999999999999999999999999999999"
    ),
    network: "ethereum",
  }),
});

const page = (
  request: ValidatorDirectoryRequest,
  items: ReadonlyArray<typeof first>,
  total = items.length
) =>
  Effect.succeed({
    items,
    limit: request.limit,
    offset: request.offset,
    total,
  });

const makeRegistry = ({
  listValidators,
  requestedValidator,
}: {
  readonly listValidators: (
    request: ValidatorDirectoryRequest
  ) => Effect.Effect<unknown>;
  readonly requestedValidator: string;
}) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(earnEntryAtom, entry(requestedValidator)),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(
            LegacyResourceSource,
            LegacyResourceSource.of({
              getTokenOptions: () =>
                Effect.succeed([
                  {
                    availableYields: [validatorYield.id],
                    token: validatorYield.token,
                  },
                ]),
              scanTokenBalances: () =>
                Effect.succeed(
                  Schema.decodeSync(TokenBalancesResponse)([
                    {
                      amount: "5",
                      availableYields: [validatorYield.id],
                      token: validatorYield.token,
                    },
                  ])
                ),
            } as never)
          ),
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getPositions: () => Effect.succeed({ errors: [], items: [] }),
              getProvider: () => Effect.succeedNone,
              listValidators,
              listYields: () =>
                Effect.succeed({
                  items: [validatorYield],
                  limit: 100,
                  offset: 0,
                  total: 1,
                }),
            } as never)
          )
        ) as never
      ),
    ],
  });

const selectedAddresses = (registry: AtomRegistry.AtomRegistry) =>
  registry
    .get(earnSelectionViewAtom)
    .selection.validators.map((selected) => selected.address);

describe("Earn initial validator", () => {
  it("keeps the requested validator after the amount changes", async () => {
    const registry = makeRegistry({
      listValidators: (request) =>
        page(request, request.preferred ? [] : [first, requested]),
      requestedValidator: requested.address,
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(selectedAddresses(registry)).toEqual([requested.address])
      );

      registry.set(setEarnSelectionAmountAtom, "1");

      expect(registry.get(earnSelectionViewAtom).form.stakeAmount).toBe("1");
      expect(selectedAddresses(registry)).toEqual([requested.address]);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("finds a requested validator outside the loaded catalog page", async () => {
    const registry = makeRegistry({
      listValidators: (request) => {
        if (request.preferred) return page(request, []);
        if (request.name === "requested") return page(request, [requested]);
        if (request.name || request.address) return page(request, []);
        return page(request, [first], 101);
      },
      requestedValidator: "requested",
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(selectedAddresses(registry)).toEqual([requested.address])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("leaves the selection empty when the requested validator does not exist", async () => {
    const listValidators = vi.fn((request: ValidatorDirectoryRequest) =>
      page(
        request,
        request.preferred || request.name || request.address ? [] : [first]
      )
    );
    const registry = makeRegistry({
      listValidators,
      requestedValidator: "missing",
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          listValidators.mock.calls.some(
            ([request]) => request.name === "missing"
          )
        ).toBe(true)
      );
      await vi.waitFor(() =>
        expect(
          registry.get(earnSelectionStatusViewAtom).loading.validators
        ).toBe(false)
      );
      registry.set(setEarnSelectionAmountAtom, "1");

      expect(selectedAddresses(registry)).toEqual([]);
      expect(registry.get(earnSelectionViewAtom).canSubmit).toBe(false);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
