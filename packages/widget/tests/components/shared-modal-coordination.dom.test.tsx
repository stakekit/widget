import { DismissableLayer } from "@radix-ui/react-dismissable-layer";
import { FocusGuards } from "@radix-ui/react-focus-guards";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { hideOthers } from "aria-hidden";
import { RemoveScroll } from "react-remove-scroll";
import { expect, it } from "vitest";
import { render } from "../utils/test-utils.dom";

// Separate React roots model a host modal and a widget modal. The package build
// checks that their document-wide coordination modules are not embedded in dist.
it("restores pointer events when the older modal closes first", async () => {
  const original = document.body.style.pointerEvents;
  const host = await render(<DismissableLayer disableOutsidePointerEvents />);
  const widget = await render(<DismissableLayer disableOutsidePointerEvents />);
  expect(document.body.style.pointerEvents).toBe("none");
  host.unmount();
  expect(document.body.style.pointerEvents).toBe("none");
  widget.unmount();
  expect(document.body.style.pointerEvents).toBe(original);
});

it("pauses the host focus trap while the widget trap is active", async () => {
  const host = await render(
    <FocusScope trapped>
      <button type="button">Host</button>
    </FocusScope>
  );
  const widget = await render(
    <FocusScope trapped>
      <button type="button">Widget</button>
    </FocusScope>
  );
  const hostButton = host.container.querySelector("button");
  const widgetButton = widget.container.querySelector("button");
  expect(document.activeElement).toBe(widgetButton);
  hostButton?.focus();
  expect(document.activeElement).toBe(widgetButton);
  widget.unmount();
  await expect.poll(() => document.activeElement).toBe(hostButton);
});

it("retains focus guards and scroll locking until the last modal closes", async () => {
  const modal = (
    <FocusGuards>
      <RemoveScroll>Modal</RemoveScroll>
    </FocusGuards>
  );
  const host = await render(modal);
  const widget = await render(modal);
  host.unmount();
  expect(document.querySelectorAll("[data-radix-focus-guard]")).toHaveLength(2);
  expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  widget.unmount();
  expect(document.querySelectorAll("[data-radix-focus-guard]")).toHaveLength(0);
  expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
});

it("restores accessibility attributes after overlapping modal lifetimes", () => {
  const background = document.createElement("main");
  const modal = document.createElement("div");
  document.body.append(background, modal);
  try {
    const closeHost = hideOthers(modal);
    const closeWidget = hideOthers(modal);
    closeHost();
    expect(background.getAttribute("aria-hidden")).toBe("true");
    closeWidget();
    expect(background.hasAttribute("aria-hidden")).toBe(false);
  } finally {
    background.remove();
    modal.remove();
  }
});
