import {
  useAtom,
  useAtomInitialValues,
  useAtomValue,
} from "@effect/atom-react";
import { describe, expect, it, vi } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Equal,
  Layer,
  MutableRef,
  Schema,
  Stream,
} from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { act } from "react";
import type { DataRouter } from "react-router";
import { SKAtomRegistryProvider } from "../../../src/app/composition/providers/atom-runtime";
import { applicationRoutes } from "../../../src/app/routes/application-routes";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { applicationRouterAtom } from "../../../src/app/runtime/application-router";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  makeYieldActionContinuationSession,
  YieldFlowHandoff,
  type YieldTransactionFlowIntake,
} from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import { makeYieldFlowExecutionPage } from "../../../src/features/yield-transaction-flow/state/execution-page";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import type { TransactionWorkflowHandle } from "../../../src/services/transaction-workflow/transaction-workflow-service";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { render } from "../../utils/test-utils.dom.tsx";
import { widgetConfigAtom } from "../../utils/widget-config";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

type LifecycleProbe = {
  initialized: number;
  disposed: number;
};

type WorkflowProbe = {
  readonly deferredSigning: Deferred.Deferred<void>;
  finalized: number;
  machine: object | null;
  starts: number;
  states: string[];
  submissions: number;
  walletPrompts: number;
};

const stagedWorkflowAtom = Atom.make("empty");
const trackingServiceProbeAtom = appRuntime.atom(
  TrackingService.use((tracking) => Effect.succeed(tracking))
);
const runtimeLifecycleAtom = Atom.family((probe: LifecycleProbe) =>
  appRuntime.atom(
    Effect.acquireRelease(
      Effect.sync(() => {
        probe.initialized += 1;
        return probe.initialized;
      }),
      () =>
        Effect.sync(() => {
          probe.disposed += 1;
        })
    )
  )
);

const controllableWorkflowAtom = Atom.family((probe: WorkflowProbe) =>
  appRuntime.atom(
    Effect.gen(function* () {
      const machine = {};
      probe.machine = machine;
      probe.starts += 1;

      yield* Effect.gen(function* () {
        probe.walletPrompts += 1;
        probe.states.push("Signing");
        yield* Deferred.await(probe.deferredSigning);
        probe.submissions += 1;
        probe.states.push("Completed");
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            probe.finalized += 1;
          })
        ),
        Effect.forkScoped
      );

      return machine;
    })
  )
);

const ControllableWorkflow = ({ probe }: { readonly probe: WorkflowProbe }) => {
  const machine = useAtomValue(controllableWorkflowAtom(probe));

  return (
    <output data-testid="machine">
      {AsyncResult.isSuccess(machine) ? "active" : "loading"}
    </output>
  );
};

const RuntimeHarness = ({
  probe,
  workflowProbe,
}: {
  readonly probe: LifecycleProbe;
  readonly workflowProbe?: WorkflowProbe;
}) => {
  const lifecycle = useAtomValue(runtimeLifecycleAtom(probe));
  const tracking = useAtomValue(trackingServiceProbeAtom);
  const [staged, setStaged] = useAtom(stagedWorkflowAtom);

  return (
    <>
      <output data-testid="runtime">
        {AsyncResult.isSuccess(lifecycle) ? lifecycle.value : "loading"}
      </output>
      <output data-testid="staged">{staged}</output>
      {workflowProbe && staged === "active-workflow" ? (
        <ControllableWorkflow probe={workflowProbe} />
      ) : null}
      <button type="button" onClick={() => setStaged("active-workflow")}>
        Stage workflow
      </button>
      <button
        type="button"
        disabled={!AsyncResult.isSuccess(tracking)}
        onClick={() => {
          if (AsyncResult.isSuccess(tracking)) {
            // ast-grep-ignore: no-run-effect-in-test -- React event handlers are non-Effect boundaries
            Effect.runFork(tracking.value.trackEvent("txSigned"));
          }
        }}
      >
        Track
      </button>
    </>
  );
};

const activityIntake = (): Extract<
  YieldTransactionFlowIntake,
  { readonly _tag: "YieldActionContinuation" }
> => {
  const selectedYield = yieldApiYieldFixture();
  return {
    _tag: "YieldActionContinuation",
    action: yieldApiActionFixture(),
    providersDetails: [],
    selectedValidators: [],
    selectedYield,
    walletScope: new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)("0xWallet"),
      network: "ethereum",
    }),
  };
};

const executionLifetime = { finalized: 0, started: 0 };
const continuationIntake = activityIntake();
const yieldFlowDependencies = Layer.unwrap(
  makeYieldFlowTestKit({
    initialWalletState: makeConnectedWalletState(
      continuationIntake.walletScope
    ),
    makeWorkflow: () =>
      Effect.acquireRelease(
        Effect.sync(() => {
          executionLifetime.started += 1;
          return { dispatch: () => Effect.void, states: Stream.never };
        }),
        () =>
          Effect.sync(() => {
            executionLifetime.finalized += 1;
          })
      ),
  }).pipe(Effect.map((kit) => kit.layer))
);

/**
 * Shows one Flow Execution in the wallet runtime. It takes the waiting
 * handoff once, so a restart would end in interruption.
 */
const YieldFlowRuntimeHarness = ({
  executionAtom,
}: {
  readonly executionAtom: Atom.Atom<
    AsyncResult.AsyncResult<TransactionWorkflowHandle, unknown>
  >;
}) => {
  useAtomInitialValues([[walletRuntime.layer, yieldFlowDependencies as never]]);
  const workflow = useAtomValue(executionAtom);

  return (
    <output data-testid="yield-flow-workflow">
      {AsyncResult.isSuccess(workflow) ? "started" : workflow._tag}
    </output>
  );
};

const ApplicationRouterHarness = ({
  capture,
}: {
  readonly capture: (router: DataRouter) => void;
}) => {
  const router = useAtomValue(applicationRouterAtom);

  return (
    <button
      data-testid="capture-router"
      type="button"
      onClick={() => capture(router)}
    >
      Capture router
    </button>
  );
};

const WidgetConfigProjection = ({
  projection,
}: {
  readonly projection: Atom.Atom<string>;
}) => {
  useAtomValue(projection);
  return null;
};

const settings = (trackEvent: (event: string) => void, apiKey = "api-key") => ({
  apiKey,
  tracking: { trackEvent },
  variant: "default" as const,
});

describe("dynamic Widget Configuration", () => {
  it("does not publish value-equal widget config across rerenders", async () => {
    const track = vi.fn();
    const projectionRead = vi.fn();
    const projection = Atom.make((get) => {
      projectionRead();
      return get(widgetConfigAtom).apiKey;
    });
    const makeInlineSettings = () => ({
      apiKey: "api-key",
      preferredTokenYieldsPerNetwork: {
        ethereum: {
          "ethereum-eth": "ethereum-eth-native-staking",
        },
      },
      tracking: { trackEvent: track },
      variant: "default" as const,
    });
    const firstSettings = makeInlineSettings();
    const equalInlineSettings = makeInlineSettings();
    const renderProvider = (
      settings: ReturnType<typeof makeInlineSettings>
    ) => (
      <SKAtomRegistryProvider
        routes={applicationRoutes}
        hostConfiguration={settings}
      >
        <WidgetConfigProjection projection={projection} />
      </SKAtomRegistryProvider>
    );

    expect(equalInlineSettings).not.toBe(firstSettings);
    expect(equalInlineSettings.preferredTokenYieldsPerNetwork).not.toBe(
      firstSettings.preferredTokenYieldsPerNetwork
    );
    expect(Equal.equals(equalInlineSettings, firstSettings)).toBe(true);

    const app = await render(renderProvider(firstSettings));

    expect(projectionRead).toHaveBeenCalledOnce();

    await app.rerender(renderProvider(equalInlineSettings));

    expect(projectionRead).toHaveBeenCalledOnce();
  });

  it.live(
    "preserves router history for live settings including a changed API key",
    () =>
      Effect.gen(function* () {
        const firstTrack = vi.fn();
        const secondTrack = vi.fn();
        const routers: DataRouter[] = [];
        const lifecycleProbe: LifecycleProbe = { disposed: 0, initialized: 0 };
        const workflowProbe: WorkflowProbe = {
          deferredSigning: yield* Deferred.make<void>(),
          finalized: 0,
          machine: null,
          starts: 0,
          states: [],
          submissions: 0,
          walletPrompts: 0,
        };
        const renderProvider = (
          currentSettings: ReturnType<typeof settings>
        ) => (
          <SKAtomRegistryProvider
            routes={applicationRoutes}
            hostConfiguration={currentSettings}
          >
            <ApplicationRouterHarness
              capture={(router) => routers.push(router)}
            />
            <RuntimeHarness
              probe={lifecycleProbe}
              workflowProbe={workflowProbe}
            />
          </SKAtomRegistryProvider>
        );
        const app = yield* Effect.promise(() =>
          render(renderProvider(settings(firstTrack)))
        );
        const capture = () =>
          app.container
            .querySelector<HTMLButtonElement>('[data-testid="capture-router"]')
            ?.click();

        yield* Effect.promise(() =>
          vi.waitFor(() => expect(lifecycleProbe.initialized).toBe(1))
        );
        yield* Effect.promise(() =>
          act(async () =>
            [...app.container.querySelectorAll<HTMLButtonElement>("button")]
              .find((button) => button.textContent === "Stage workflow")
              ?.click()
          )
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(workflowProbe.starts).toBe(1))
        );

        yield* Effect.promise(() => act(async () => capture()));
        const firstRouter = routers[0];
        if (!firstRouter)
          throw new Error("Expected the first application router");

        yield* Effect.promise(() =>
          act(async () => {
            await firstRouter.navigate("/review");
          })
        );

        yield* Effect.promise(() =>
          app.rerender(renderProvider(settings(secondTrack)))
        );
        yield* Effect.promise(() => act(async () => capture()));

        expect(routers[1]).toBe(firstRouter);
        expect(routers[1]?.state.location.pathname).toBe("/review");

        yield* Effect.promise(() =>
          app.rerender(
            renderProvider(settings(secondTrack, "replacement-api-key"))
          )
        );
        yield* Effect.promise(() => act(async () => capture()));

        expect(routers[2]).toBe(firstRouter);
        expect(routers[2]?.state.location.pathname).toBe("/review");
        expect(lifecycleProbe.disposed).toBe(0);
        expect(workflowProbe.finalized).toBe(0);
      })
  );

  it("keeps an open Flow Execution while live settings change", async () => {
    const firstTrack = vi.fn();
    const secondTrack = vi.fn();
    executionLifetime.finalized = 0;
    executionLifetime.started = 0;
    const session = makeYieldActionContinuationSession(continuationIntake);
    // As Review's handoff would leave it.
    const handoff = new YieldFlowHandoff({
      _tag: "Action",
      action: continuationIntake.action,
    });
    MutableRef.set(session.handoff.ref, { _tag: "Waiting", handoff });
    const { executionAtom } = makeYieldFlowExecutionPage(session, handoff);
    const app = await render(
      <SKAtomRegistryProvider
        routes={applicationRoutes}
        hostConfiguration={settings(firstTrack)}
      >
        <YieldFlowRuntimeHarness executionAtom={executionAtom} />
      </SKAtomRegistryProvider>
    );
    const workflow = () =>
      app.container.querySelector('[data-testid="yield-flow-workflow"]')
        ?.textContent;

    await expect.poll(workflow).toBe("started");
    expect(executionLifetime).toEqual({ finalized: 0, started: 1 });

    await app.rerender(
      <SKAtomRegistryProvider
        routes={applicationRoutes}
        hostConfiguration={settings(secondTrack)}
      >
        <YieldFlowRuntimeHarness executionAtom={executionAtom} />
      </SKAtomRegistryProvider>
    );
    await act(async () => {
      const settled = Promise.withResolvers<void>();
      setTimeout(settled.resolve, 0);
      await settled.promise;
    });

    expect(workflow()).toBe("started");
    expect(executionLifetime).toEqual({ finalized: 0, started: 1 });

    app.unmount();
    await expect.poll(() => executionLifetime.finalized).toBe(1);
    expect(executionLifetime.started).toBe(1);
  });

  it.live(
    "keeps the runtime and staged state while resolving new live callbacks",
    () =>
      Effect.gen(function* () {
        const firstTrack = vi.fn();
        const secondTrack = vi.fn();
        const probe: LifecycleProbe = { disposed: 0, initialized: 0 };
        const workflowProbe: WorkflowProbe = {
          deferredSigning: yield* Deferred.make<void>(),
          finalized: 0,
          machine: null,
          starts: 0,
          states: [],
          submissions: 0,
          walletPrompts: 0,
        };
        const app = yield* Effect.promise(() =>
          render(
            <SKAtomRegistryProvider
              routes={applicationRoutes}
              hostConfiguration={settings(firstTrack)}
            >
              <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
            </SKAtomRegistryProvider>
          )
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => expect(probe.initialized).toBe(1))
        );
        yield* Effect.promise(() =>
          act(async () =>
            app.container.querySelector<HTMLButtonElement>("button")?.click()
          )
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(workflowProbe.starts).toBe(1))
        );
        const machine = workflowProbe.machine;
        yield* Effect.promise(() =>
          act(async () =>
            [
              ...app.container.querySelectorAll<HTMLButtonElement>("button"),
            ][1]?.click()
          )
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(firstTrack).toHaveBeenCalledOnce())
        );

        yield* Effect.promise(() =>
          app.rerender(
            <SKAtomRegistryProvider
              routes={applicationRoutes}
              hostConfiguration={settings(secondTrack)}
            >
              <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
            </SKAtomRegistryProvider>
          )
        );
        yield* Effect.promise(() =>
          act(async () =>
            [
              ...app.container.querySelectorAll<HTMLButtonElement>("button"),
            ][1]?.click()
          )
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => expect(secondTrack).toHaveBeenCalledOnce())
        );
        expect(firstTrack).toHaveBeenCalledOnce();
        expect(probe).toEqual({ disposed: 0, initialized: 1 });
        expect(workflowProbe).toMatchObject({
          finalized: 0,
          machine,
          starts: 1,
          states: ["Signing"],
          submissions: 0,
          walletPrompts: 1,
        });
        expect(
          app.container.querySelector('[data-testid="staged"]')?.textContent
        ).toBe("active-workflow");

        yield* Deferred.succeed(workflowProbe.deferredSigning, undefined);
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(workflowProbe.submissions).toBe(1))
        );
        expect(workflowProbe).toMatchObject({
          machine,
          starts: 1,
          states: ["Signing", "Completed"],
          submissions: 1,
          walletPrompts: 1,
        });
      })
  );
});
