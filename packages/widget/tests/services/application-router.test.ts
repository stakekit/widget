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
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../src/services/navigation/widget-navigation";

const navigationCommandAtom = appRuntime
  .fn(
    (command: WidgetNavigationCommand) =>
      WidgetNavigation.use((navigation) => navigation.execute(command)),
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

  it("constructs the router at the atom-derived deep link without navigating", () => {
    vi.stubGlobal("location", {
      href: "https://host.test/?tab=positions",
    });
    const registry = AtomRegistry.make({
      initialValues: [
        [
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "test",
            dashboardVariant: true,
            variant: "default",
          }),
        ],
      ],
    });

    try {
      const router = registry.get(applicationRouterAtom);

      expect(router.state.location.pathname).toBe("/positions");
      expect(router.state.historyAction).toBe("POP");
    } finally {
      registry.dispose();
      vi.unstubAllGlobals();
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
