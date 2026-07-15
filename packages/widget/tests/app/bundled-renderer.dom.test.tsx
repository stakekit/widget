import { describe, expect, it, vi } from "vitest";

const reactRoot = vi.hoisted(() => ({
  render: vi.fn(),
}));
const createRoot = vi.hoisted(() => vi.fn(() => reactRoot));

vi.mock("react-dom/client", () => ({
  default: { createRoot },
}));

import { renderSKWidget } from "../../src/App";

describe("bundled widget renderer", () => {
  it("validates required public configuration before creating a React root", () => {
    expect(() =>
      renderSKWidget({ apiKey: "", container: document.createElement("div") })
    ).toThrow("API key is required");
    expect(createRoot).not.toHaveBeenCalled();
  });

  it("initializes the bundled component and exposes the compatible rerender API", () => {
    const container = document.createElement("div");
    const widget = renderSKWidget({ apiKey: "api-key", container });

    expect(createRoot).toHaveBeenCalledWith(container);
    expect(reactRoot.render).toHaveBeenCalledOnce();
    expect(widget).toEqual({ rerender: expect.any(Function) });
  });
});
