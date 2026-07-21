import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Deferred, Effect, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { SKAtomRegistryProvider } from "../../src/app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import { classicFlowSessionStore } from "../../src/features/transaction-flow/state/classic-flow-session-store";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom";

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
            Effect.runFork(tracking.value.trackEvent("txSigned"));
          }
        }}
      >
        Track
      </button>
    </>
  );
};

const activityIntake = (): ClassicTransactionFlowIntake => {
  const selectedYield = yieldApiYieldFixture();
  return {
    _tag: "ActivityResume",
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

const ClassicFlowRuntimeHarness = () => {
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const start = useAtomSet(classicFlowSessionStore.startAtom);

  return (
    <>
      <output data-testid="classic-flow-session">
        {session ? "present" : "none"}
      </output>
      <button type="button" onClick={() => start(activityIntake())}>
        Start classic flow
      </button>
    </>
  );
};

const settings = (trackEvent: (event: string) => void, apiKey = "api-key") =>
  normalizeWidgetConfig({
    apiKey,
    tracking: { trackEvent },
    variant: "default",
  });

describe("API runtime generations", () => {
  it("retains intake for live settings and clears it on runtime replacement before routing", async () => {
    const firstTrack = vi.fn();
    const secondTrack = vi.fn();
    const app = await render(
      <SKAtomRegistryProvider settings={settings(firstTrack)}>
        <ClassicFlowRuntimeHarness />
      </SKAtomRegistryProvider>
    );

    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="classic-flow-session"]')
          ?.textContent
      ).not.toBe("none")
    );
    const sessionKey = app.container.querySelector(
      '[data-testid="classic-flow-session"]'
    )?.textContent;

    await app.rerender(
      <SKAtomRegistryProvider settings={settings(secondTrack)}>
        <ClassicFlowRuntimeHarness />
      </SKAtomRegistryProvider>
    );
    expect(
      app.container.querySelector('[data-testid="classic-flow-session"]')
        ?.textContent
    ).toBe(sessionKey);

    await app.rerender(
      <SKAtomRegistryProvider
        settings={settings(secondTrack, "replacement-api-key")}
      >
        <ClassicFlowRuntimeHarness />
      </SKAtomRegistryProvider>
    );
    await vi.waitFor(() =>
      expect(
        app.container.querySelector('[data-testid="classic-flow-session"]')
          ?.textContent
      ).toBe("none")
    );
  });

  it("keeps the runtime and staged state while resolving new live callbacks", async () => {
    const firstTrack = vi.fn();
    const secondTrack = vi.fn();
    const probe: LifecycleProbe = { disposed: 0, initialized: 0 };
    const workflowProbe: WorkflowProbe = {
      deferredSigning: await Effect.runPromise(Deferred.make<void>()),
      finalized: 0,
      machine: null,
      starts: 0,
      states: [],
      submissions: 0,
      walletPrompts: 0,
    };
    const app = await render(
      <SKAtomRegistryProvider settings={settings(firstTrack)}>
        <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
      </SKAtomRegistryProvider>
    );

    await vi.waitFor(() => expect(probe.initialized).toBe(1));
    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    await vi.waitFor(() => expect(workflowProbe.starts).toBe(1));
    const machine = workflowProbe.machine;
    await act(async () =>
      [
        ...app.container.querySelectorAll<HTMLButtonElement>("button"),
      ][1]?.click()
    );
    await vi.waitFor(() => expect(firstTrack).toHaveBeenCalledOnce());

    await app.rerender(
      <SKAtomRegistryProvider settings={settings(secondTrack)}>
        <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
      </SKAtomRegistryProvider>
    );
    await act(async () =>
      [
        ...app.container.querySelectorAll<HTMLButtonElement>("button"),
      ][1]?.click()
    );

    await vi.waitFor(() => expect(secondTrack).toHaveBeenCalledOnce());
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

    await Effect.runPromise(
      Deferred.succeed(workflowProbe.deferredSigning, undefined)
    );
    await vi.waitFor(() => expect(workflowProbe.submissions).toBe(1));
    expect(workflowProbe).toMatchObject({
      machine,
      starts: 1,
      states: ["Signing", "Completed"],
      submissions: 1,
      walletPrompts: 1,
    });
  });

  it("disposes all old registry state when API configuration changes", async () => {
    const probe: LifecycleProbe = { disposed: 0, initialized: 0 };
    const workflowProbe: WorkflowProbe = {
      deferredSigning: await Effect.runPromise(Deferred.make<void>()),
      finalized: 0,
      machine: null,
      starts: 0,
      states: [],
      submissions: 0,
      walletPrompts: 0,
    };
    const track = vi.fn();
    const app = await render(
      <SKAtomRegistryProvider settings={settings(track)}>
        <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
      </SKAtomRegistryProvider>
    );

    await vi.waitFor(() => expect(probe.initialized).toBe(1));
    await act(async () =>
      app.container.querySelector<HTMLButtonElement>("button")?.click()
    );
    await vi.waitFor(() => expect(workflowProbe.starts).toBe(1));

    await app.rerender(
      <SKAtomRegistryProvider settings={settings(track, "replacement-api-key")}>
        <RuntimeHarness probe={probe} workflowProbe={workflowProbe} />
      </SKAtomRegistryProvider>
    );

    await vi.waitFor(() =>
      expect(probe).toEqual({ disposed: 1, initialized: 2 })
    );
    expect(
      app.container.querySelector('[data-testid="staged"]')?.textContent
    ).toBe("empty");
    await vi.waitFor(() => expect(workflowProbe.finalized).toBe(1));

    await Effect.runPromise(
      Deferred.succeed(workflowProbe.deferredSigning, undefined)
    );
    expect(workflowProbe).toMatchObject({
      finalized: 1,
      starts: 1,
      submissions: 0,
      walletPrompts: 1,
    });
  });
});
