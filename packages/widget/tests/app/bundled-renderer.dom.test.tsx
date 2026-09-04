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
    widget.rerender({ apiKey: "replacement-api-key" });

    expect(createRoot).toHaveBeenCalledOnce();
    expect(reactRoot.render).toHaveBeenCalledTimes(2);
    expect(reactRoot.render.mock.calls[1]?.[0]).toMatchObject({
      props: {
        apiKey: "replacement-api-key",
      },
    });

    widget.unmount();
    widget.rerender({ apiKey: "ignored-api-key" });

    expect(reactRoot.render).toHaveBeenCalledTimes(2);
    expect(reactRoot.unmount).toHaveBeenCalledOnce();
  });

  it("applies the latest props across immediate rerenders", () => {
    const widget = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    widget.rerender({ apiKey: "first-api-key" });
    widget.rerender({ apiKey: "latest-api-key" });

    expect(reactRoot.render).toHaveBeenCalledTimes(3);
    expect(reactRoot.render.mock.lastCall?.[0]).toMatchObject({
      props: {
        apiKey: "latest-api-key",
      },
    });

    widget.unmount();
  });

  it("supports concurrent Widget Instances in the same document", () => {
    const first = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });
    const second = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(reactRoot.unmount).not.toHaveBeenCalled();

    first.unmount();
    second.unmount();
  });

  it("supports a clean sequential bundled remount", () => {
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

  it("allows separately evaluated copies to mount concurrently", async () => {
    const activeWidget = renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    vi.resetModules();
    const secondCopy = await import("../../src/App");

    const secondWidget = secondCopy.renderSKWidget({
      apiKey: "api-key",
      container: document.createElement("div"),
    });

    expect(createRoot).toHaveBeenCalledTimes(2);

    activeWidget.unmount();
    secondWidget.unmount();
  });
});
