import {
  act,
  Component,
  type PropsWithChildren,
  type ReactNode,
  StrictMode,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../utils/test-utils.dom.tsx";

const providersRendered = vi.hoisted(() =>
  vi.fn<(runtimeIdentity: object) => void>()
);
const runtimeReleased = vi.hoisted(() => vi.fn());

vi.mock("../../src/app/composition/providers", async () => {
  const { useAtomValue } = await import("@effect/atom-react");
  const Atom = await import("effect/unstable/reactivity/Atom");
  const { widgetConfigAtom } = await import("../utils/widget-config");
  const { useLayoutEffect } = await import("react");
  const runtimeIdentityAtom = Atom.make(() => ({}));

  return {
    Providers: ({ children }: PropsWithChildren) => {
      providersRendered(useAtomValue(runtimeIdentityAtom));
      const settings = useAtomValue(widgetConfigAtom);
      useLayoutEffect(() => () => runtimeReleased(), []);
      return (
        <>
          <output data-testid="bundled-api-key">{settings.apiKey}</output>
          <output data-testid="ledger-embed-mode">
            {String(settings.isLedgerLive)}
          </output>
          {children}
        </>
      );
    },
  };
});

vi.mock("../../src/app/routes/ui/classic-routes", () => ({
  ClassicRoutes: () => <div>active widget</div>,
}));

vi.mock("../../src/app/routes/ui/dashboard-routes", () => ({
  DashboardRoutes: () => <div>active dashboard</div>,
}));

vi.mock("../../src/shared/ui/primitives/box", () => ({
  Box: ({ children }: PropsWithChildren) => children,
}));

import { renderSKWidget, SKApp } from "../../src/App";

const originalHref = window.location.href;

class MountErrorBoundary extends Component<
  PropsWithChildren<{ readonly onError: (error: unknown) => void }>,
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? <div>mount rejected</div> : this.props.children;
  }
}

describe("Widget Instance lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.replaceState({}, "", originalHref);
  });

  it("rejects a second package mount before its providers initialize", async () => {
    const first = await render(<SKApp apiKey="first-api-key" />);
    const onError = vi.fn<(error: unknown) => void>();
    const providerCallCount = providersRendered.mock.calls.length;

    const second = await render(
      <MountErrorBoundary onError={onError}>
        <SKApp apiKey="second-api-key" />
      </MountErrorBoundary>
    );

    expect(first.container.textContent).toContain("active widget");
    expect(second.container.textContent).toContain("mount rejected");
    expect(providersRendered).toHaveBeenCalledTimes(providerCallCount);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "StakeKitWidgetInstanceAlreadyMountedError",
        message:
          "Only one StakeKit Widget may be mounted in a browser document at a time.",
      })
    );
  });

  it("supports a clean sequential package remount", async () => {
    const first = await render(<SKApp apiKey="first-api-key" />);
    const firstRuntimeIdentity = providersRendered.mock.lastCall?.[0];

    first.unmount();

    const second = await render(<SKApp apiKey="second-api-key" />);
    const secondRuntimeIdentity = providersRendered.mock.lastCall?.[0];

    expect(second.container.textContent).toContain("active widget");
    expect(firstRuntimeIdentity).toBeDefined();
    expect(secondRuntimeIdentity).toBeDefined();
    expect(secondRuntimeIdentity).not.toBe(firstRuntimeIdentity);
  });

  it("keeps Ledger embed mode sticky within a generation and fresh after remount", async () => {
    const embedMode = (container: HTMLElement) =>
      container.querySelector('[data-testid="ledger-embed-mode"]')?.textContent;

    window.history.replaceState({}, "", "/?embed=true");
    const embedded = await render(<SKApp apiKey="embedded-api-key" />);
    expect(embedMode(embedded.container)).toBe("true");

    window.history.replaceState({}, "", "/");
    await embedded.rerender(<SKApp apiKey="embedded-api-key" />);
    expect(embedMode(embedded.container)).toBe("true");
    embedded.unmount();

    const standard = await render(<SKApp apiKey="standard-api-key" />);
    expect(embedMode(standard.container)).toBe("false");

    window.history.replaceState({}, "", "/?embed=true");
    await standard.rerender(<SKApp apiKey="standard-api-key" />);
    expect(embedMode(standard.container)).toBe("false");
    standard.unmount();

    const embeddedAgain = await render(
      <SKApp apiKey="embedded-again-api-key" />
    );
    expect(embedMode(embeddedAgain.container)).toBe("true");
  });

  it("treats React StrictMode replay as one Widget Instance", async () => {
    const app = await render(
      <StrictMode>
        <SKApp apiKey="strict-api-key" />
      </StrictMode>
    );

    expect(app.container.textContent).toContain("active widget");
  });

  it("claims the document that owns the package mount container", async () => {
    const mainDocumentApp = await render(<SKApp apiKey="main-api-key" />);
    const secondaryDocument = document.implementation.createHTMLDocument();
    const secondaryContainer = secondaryDocument.createElement("div");
    secondaryDocument.body.append(secondaryContainer);
    const secondaryRoot = createRoot(secondaryContainer);

    await act(async () => {
      secondaryRoot.render(<SKApp apiKey="secondary-api-key" />);
    });

    expect(mainDocumentApp.container.textContent).toContain("active widget");
    expect(secondaryContainer.textContent).toContain("active widget");

    act(() => secondaryRoot.unmount());
  });

  it("accepts a bundled API key change and keeps the claim until unmount", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let controller: ReturnType<typeof renderSKWidget>;

    try {
      await act(async () => {
        controller = renderSKWidget({ apiKey: "api-key", container });
      });
      await act(async () => {
        controller.rerender({ apiKey: "updated-api-key" });
      });

      expect(
        container.querySelector('[data-testid="bundled-api-key"]')?.textContent
      ).toBe("updated-api-key");
      expect(() =>
        renderSKWidget({
          apiKey: "other-api-key",
          container: document.createElement("div"),
        })
      ).toThrow(
        "Only one StakeKit Widget may be mounted in a browser document at a time."
      );
    } finally {
      act(() => controller.unmount());
      container.remove();
    }
  });

  it("applies the latest rerender requested before the initial commit", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const controller = renderSKWidget({ apiKey: "initial-api-key", container });

    try {
      expect(() => {
        controller.rerender({ apiKey: "first-api-key" });
        controller.rerender({ apiKey: "latest-api-key" });
      }).not.toThrow();

      await act(async () => undefined);

      expect(
        container.querySelector('[data-testid="bundled-api-key"]')?.textContent
      ).toBe("latest-api-key");
    } finally {
      act(() => controller.unmount());
      container.remove();
    }
  });

  it("ignores rerender after the bundled Widget Instance unmounts", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let controller: ReturnType<typeof renderSKWidget>;

    await act(async () => {
      controller = renderSKWidget({ apiKey: "api-key", container });
    });
    act(() => controller.unmount());

    expect(() => controller.rerender({ apiKey: "late-api-key" })).not.toThrow();
    expect(container.textContent).toBe("");

    container.remove();
  });

  it("releases the package claim after runtime cleanup", async () => {
    const app = await render(<SKApp apiKey="api-key" />);
    let cleanupMount: ReturnType<typeof renderSKWidget> | undefined;
    let cleanupMountError: unknown;

    runtimeReleased.mockImplementation(() => {
      try {
        cleanupMount = renderSKWidget({
          apiKey: "cleanup-api-key",
          container: document.createElement("div"),
        });
      } catch (error) {
        cleanupMountError = error;
      }
    });

    app.unmount();
    cleanupMount?.unmount();

    expect(cleanupMount).toBeUndefined();
    expect(cleanupMountError).toMatchObject({
      name: "StakeKitWidgetInstanceAlreadyMountedError",
    });

    let remountedController: ReturnType<typeof renderSKWidget>;
    await act(async () => {
      remountedController = renderSKWidget({
        apiKey: "remount-api-key",
        container: document.createElement("div"),
      });
    });
    act(() => remountedController.unmount());
  });
});
