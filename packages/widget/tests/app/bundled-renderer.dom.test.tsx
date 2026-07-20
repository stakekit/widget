import { beforeEach, describe, expect, it, vi } from "vitest";

const reactRoot = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
}));
const createRoot = vi.hoisted(() => vi.fn(() => reactRoot));

vi.mock("react-dom/client", () => ({
  default: { createRoot },
}));

import { renderSKWidget } from "../../src/App";

describe("bundled widget renderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required public configuration before creating a React root", () => {
    expect(() =>
      renderSKWidget({ apiKey: "", container: document.createElement("div") })
    ).toThrow("API key is required");
    expect(createRoot).not.toHaveBeenCalled();
  });

  it("initializes the bundled component and exposes its lifecycle API", () => {
    const container = document.createElement("div");
    const widget = renderSKWidget({ apiKey: "api-key", container });

    expect(createRoot).toHaveBeenCalledWith(container);
    expect(reactRoot.render).toHaveBeenCalledOnce();
    expect(widget).toEqual({
      rerender: expect.any(Function),
      unmount: expect.any(Function),
    });

    widget.unmount();

    expect(reactRoot.unmount).toHaveBeenCalledOnce();
  });

  it("rerenders through the mounted component without replacing its React root", () => {
    const widget = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });
    const rendered = reactRoot.render.mock.calls[0]?.[0] as {
      props: {
        ref: {
          current: { rerender: (props: unknown) => void } | null;
        };
      };
    };
    const rerender = vi.fn();
    rendered.props.ref.current = { rerender };

    widget.rerender({ apiKey: "replacement-api-key" });

    expect(reactRoot.render).toHaveBeenCalledOnce();
    expect(rerender).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "replacement-api-key",
        ref: rendered.props.ref,
      })
    );

    widget.unmount();
  });

  it("rejects a second Widget Instance without disturbing the active root", () => {
    const activeWidget = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    let mountError: unknown;
    try {
      renderSKWidget({
        apiKey: "api-key",
        container: document.createElement("div"),
      });
    } catch (error) {
      mountError = error;
    }

    expect(mountError).toMatchObject({
      name: "StakeKitWidgetInstanceAlreadyMountedError",
      message:
        "Only one StakeKit Widget may be mounted in a browser document at a time.",
    });
    expect(createRoot).toHaveBeenCalledOnce();
    expect(reactRoot.unmount).not.toHaveBeenCalled();

    activeWidget.unmount();
  });

  it("releases the claim for a clean sequential bundled remount", () => {
    const first = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    first.unmount();

    const second = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    expect(createRoot).toHaveBeenCalledTimes(2);

    second.unmount();
  });

  it("shares the document claim across separately evaluated copies", async () => {
    const activeWidget = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    vi.resetModules();
    const secondCopy = await import("../../src/App");

    expect(() =>
      secondCopy.renderSKWidget({
        apiKey: "api-key",
        container: document.createElement("div"),
      })
    ).toThrow(
      "Only one StakeKit Widget may be mounted in a browser document at a time."
    );
    expect(createRoot).toHaveBeenCalledOnce();

    activeWidget.unmount();
  });
});
