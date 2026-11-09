import BigNumber from "bignumber.js";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { EarnBalance } from "../../../src/domain/earn/balance";
import type { EarnYield } from "../../../src/domain/earn/yield-schema";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { positionDetailsViewAtom } from "../../../src/features/position-details/state/details-view";
import { PositionDetailsEnterKey } from "../../../src/features/position-details/state/enter-entry";
import { positionDetailsEnterAtoms } from "../../../src/features/position-details/state/enter-view";
import { PositionDetailsWorkflowKey } from "../../../src/features/position-details/state/workflow";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../src/resources/yield-opportunity/provider";
import { YieldOpportunityError } from "../../../src/resources/yield-opportunity/yield-opportunity";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../src/resources/yield-positions/yield-positions";
import {
  ResponseDecodeError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const selectedYield = yieldApiYieldFixture();
const balance = Schema.decodeSync(EarnBalance)(
  yieldBalanceFixture({ address, amount: "1", token: selectedYield.token })
);
const workflowKey = new PositionDetailsWorkflowKey({
  balanceId: "default",
  integrationId: selectedYield.id,
  pendingActionType: null,
  scope,
});
const positionKey = new PositionBalancesKey({
  balanceId: workflowKey.balanceId,
  scope,
  yieldId: selectedYield.id,
});
const yieldKey = new YieldOpportunityKey({ yieldId: selectedYield.id });
const decodeFailure = () =>
  new ResponseDecodeError({
    cause: null,
    issue: "unexpected response",
    operation: "getOpportunity",
  });
const yieldFailure = () =>
  Cause.fail(new YieldOpportunityError({ cause: decodeFailure() }));

type PositionValue = {
  readonly balances: ReadonlyArray<EarnBalance>;
  readonly rewardRate: null;
  readonly type: "default";
};

const loadedPosition = AsyncResult.success<PositionValue>({
  balances: [balance],
  rewardRate: null,
  type: "default",
});
const loadedPositionsByType = AsyncResult.success(
  new Map([["active", [{ ...balance, tokenPriceInUsd: new BigNumber(1) }]]])
);

const makeDetailsRegistry = ({
  position = loadedPosition,
  positionsByType = loadedPositionsByType,
  yieldOpportunity,
}: {
  readonly position?: AsyncResult.AsyncResult<PositionValue | null, unknown>;
  readonly positionsByType?: AsyncResult.AsyncResult<unknown, unknown>;
  readonly yieldOpportunity: AsyncResult.AsyncResult<EarnYield, unknown>;
}) => {
  const navigation = makeWidgetNavigation({
    back: () => Effect.void,
    push: () => Effect.void,
    replace: () => Effect.void,
  });
  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.unwrap(
          Effect.all({
            navigation: makeTestNavigation({ execute: navigation.execute }),
            tracking: makeTestTracking({ trackEvent: () => Effect.void }),
          }).pipe(
            Effect.map(({ navigation: testNavigation, tracking }) =>
              Layer.merge(testNavigation.layer, tracking.layer)
            )
          )
        ) as never
      ),
      Atom.initialValue(
        walletRuntime.layer,
        Layer.unwrap(
          makeYieldFlowTestKit({
            initialWalletState: {
              connection: disconnectedNormalizedWalletState,
              ledger: disconnectedLedgerConnectorState,
            },
            navigation: { execute: navigation.execute },
          }).pipe(Effect.map((kit) => kit.layer))
        ) as never
      ),
      Atom.initialValue(
        yieldOpportunityAtom(yieldKey),
        yieldOpportunity as never
      ),
      Atom.initialValue(positionBalancesAtom(positionKey), position as never),
      Atom.initialValue(
        positionBalancesByTypeAtom(positionKey),
        positionsByType as never
      ),
    ],
  });
};

const readPage = (registry: AtomRegistry.AtomRegistry) => {
  const viewAtom = positionDetailsViewAtom(workflowKey);
  const unmount = registry.mount(viewAtom);
  try {
    return registry.get(viewAtom).page;
  } finally {
    unmount();
    registry.dispose();
  }
};

describe("Position details page state", () => {
  it("fails the page, rather than loading forever, when the yield's first load fails", () => {
    expect(
      readPage(
        makeDetailsRegistry({
          yieldOpportunity: AsyncResult.failure(yieldFailure()),
        })
      )
    ).toEqual({ _tag: "Failed" });
  });

  it("fails the page when the position's first load fails", () => {
    expect(
      readPage(
        makeDetailsRegistry({
          position: AsyncResult.failure(Cause.fail("positions failed")),
          positionsByType: AsyncResult.failure(Cause.fail("positions failed")),
          yieldOpportunity: AsyncResult.success(selectedYield),
        })
      )
    ).toEqual({ _tag: "Failed" });
  });

  it("keeps showing the position when a refetch fails after it loaded", () => {
    const registry = makeDetailsRegistry({
      yieldOpportunity: AsyncResult.failure(yieldFailure(), {
        previousSuccess: Option.some(AsyncResult.success(selectedYield)),
      }),
    });
    const viewAtom = positionDetailsViewAtom(workflowKey);
    const unmount = registry.mount(viewAtom);

    try {
      expect(registry.get(viewAtom)).toMatchObject({
        integrationData: { id: selectedYield.id },
        page: { _tag: "Ready" },
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("loads while a failed first load retries", () => {
    expect(
      readPage(
        makeDetailsRegistry({
          yieldOpportunity: AsyncResult.failure(yieldFailure(), {
            waiting: true,
          }),
        })
      )
    ).toEqual({ _tag: "Loading" });
  });

  it("leaves for the list once a settled load finds no position", () => {
    expect(
      readPage(
        makeDetailsRegistry({
          position: AsyncResult.success(null),
          positionsByType: AsyncResult.success(null),
          yieldOpportunity: AsyncResult.success(selectedYield),
        })
      )
    ).toEqual({ _tag: "PositionLost" });
  });
});

describe("Position details stake entry load", () => {
  it("fails, not loads, when the yield's first load fails, and retries it", async () => {
    const getOpportunity = vi
      .fn()
      .mockReturnValueOnce(Effect.fail(decodeFailure()))
      .mockReturnValue(Effect.succeed(selectedYield));
    const entryKey = new PositionDetailsEnterKey({
      balanceId: "default",
      integrationId: selectedYield.id,
      walletScope: scope,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, scope),
        Atom.initialValue(
          positionBalancesAtom(positionKey),
          loadedPosition as never
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                getOpportunity,
                getPositions: () => Effect.never,
                getProvider: () => Effect.succeedNone,
              } as never)
            )
          ) as never
        ),
      ],
    });
    const atoms = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(atoms.viewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(atoms.viewAtom).status).toEqual({ _tag: "Failed" })
      );

      registry.set(atoms.retryAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(atoms.viewAtom).status).toEqual({ _tag: "Ready" })
      );
      expect(getOpportunity).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
