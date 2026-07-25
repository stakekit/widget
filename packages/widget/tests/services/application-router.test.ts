import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationRouterAtom } from "../../src/app/runtime/application-router-runtime";
import {
  runWidgetNavigationCommand,
  type WidgetNavigationCommand,
} from "../../src/app/runtime/navigation";
import { toWidgetPath } from "../../src/services/navigation/widget-navigation";

const navigationCommandAtom = appRuntime
  .fn(
    (command: WidgetNavigationCommand) => runWidgetNavigationCommand(command),
    { concurrent: false }
  )
  .pipe(Atom.withLabel("applicationRouterTestNavigationCommandAtom"));

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [
      [
        widgetConfigAtom,
        normalizeWidgetConfig({ apiKey: "test", variant: "default" }),
      ],
    ],
  });

describe("ApplicationRouter runtime", () => {
  it("synchronously exposes the memory router on the first registry read", () => {
    const registry = makeRegistry();

    try {
      const router = registry.get(applicationRouterAtom);

      expect(router.state.location.pathname).toBe("/");
      expect(router.routes).toHaveLength(1);
    } finally {
      registry.dispose();
    }
  });

  it("drives real memory history through WidgetNavigation", async () => {
    const registry = makeRegistry();

    try {
      const router = registry.get(applicationRouterAtom);

      registry.set(navigationCommandAtom, {
        _tag: "Push",
        path: toWidgetPath("/review"),
        scroll: "preserve",
      });

      await vi.waitFor(() =>
        expect(router.state.location.pathname).toBe("/review")
      );

      registry.set(navigationCommandAtom, {
        _tag: "Replace",
        path: toWidgetPath("/complete"),
        scroll: "preserve",
      });

      await vi.waitFor(() =>
        expect(router.state.location.pathname).toBe("/complete")
      );

      registry.set(navigationCommandAtom, {
        _tag: "Back",
        scroll: "preserve",
      });

      await vi.waitFor(() => expect(router.state.location.pathname).toBe("/"));
    } finally {
      registry.dispose();
    }
  });

  it("preserves one router within a generation and resets fresh generations", async () => {
    const firstRegistry = makeRegistry();
    const secondRegistry = makeRegistry();

    try {
      const firstRouter = firstRegistry.get(applicationRouterAtom);

      firstRegistry.set(navigationCommandAtom, {
        _tag: "Push",
        path: toWidgetPath("/review"),
        scroll: "preserve",
      });
      await vi.waitFor(() =>
        expect(firstRouter.state.location.pathname).toBe("/review")
      );

      expect(firstRegistry.get(applicationRouterAtom)).toBe(firstRouter);

      const secondRouter = secondRegistry.get(applicationRouterAtom);
      expect(secondRouter).not.toBe(firstRouter);
      expect(secondRouter.state.location.pathname).toBe("/");
    } finally {
      firstRegistry.dispose();
      secondRegistry.dispose();
    }
  });

  it("disposes the router exactly once with its registry generation", () => {
    const registry = makeRegistry();
    const router = registry.get(applicationRouterAtom);
    const dispose = vi.spyOn(router, "dispose");

    registry.dispose();
    registry.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });
});
