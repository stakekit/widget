import { userEvent } from "vitest/browser";

import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const formControlTags = ["input", "select", "textarea"] as const;
const formControlProperties = [
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "margin",
] as const;

const computedFormControlStyles = (document: Document) =>
  Object.fromEntries(
    formControlTags.map((tag) => {
      const style = getComputedStyle(
        document.querySelector(`[data-host-control="${tag}"]`) as Element
      );
      return [
        tag,
        Object.fromEntries(
          formControlProperties.map((property) => [property, style[property]])
        ),
      ];
    })
  );

const appendHostFormControls = (document: Document) => {
  for (const tag of formControlTags) {
    const control = document.createElement(tag);
    control.dataset.hostControl = tag;
    document.body.append(control);
  }
};

/** The same controls in a document no Widget stylesheet reaches. */
const unstyledFormControlStyles = async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument as Document;
  appendHostFormControls(frameDocument);
  const styles = computedFormControlStyles(frameDocument);
  frame.remove();
  return styles;
};

const appendHostStyle = (css: string) => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return style;
};

const layouts = [
  { name: "Compact", skProps: {} },
  { name: "Dashboard", skProps: { dashboardVariant: true } },
] as const;

describe("Design System isolation", () => {
  it("leaves host form controls outside the Widget unstyled", async () => {
    const expected = await unstyledFormControlStyles();
    appendHostFormControls(document);

    const app = await renderApp();

    await expect
      .element(app.getByRole("button", { name: "Connect wallet" }))
      .toBeInTheDocument();

    expect(computedFormControlStyles(document)).toEqual(expected);

    for (const tag of formControlTags) {
      document.querySelector(`[data-host-control="${tag}"]`)?.remove();
    }
    await app.unmount();
  });

  it.each(layouts)(
    "keeps a host button rule off the $name Layout call-to-action",
    async ({ skProps }) => {
      const hostStyle = appendHostStyle(
        "button { background: red; padding: 40px; }"
      );

      const app = await renderApp({
        skProps: { apiKey: import.meta.env.VITE_API_KEY, ...skProps },
      });
      const cta = app.getByRole("button", { name: "Connect wallet" });

      await expect.element(cta).toBeInTheDocument();

      const style = getComputedStyle(cta.element());
      expect(style.backgroundColor).not.toBe("rgb(255, 0, 0)");
      expect(style.paddingTop).not.toBe("40px");
      expect(style.paddingLeft).not.toBe("40px");

      hostStyle.remove();
      await app.unmount();
    }
  );

  it("shows a focus ring on the call-to-action reached by keyboard", async () => {
    const app = await renderApp();
    const cta = app.getByRole("button", { name: "Connect wallet" });

    await expect.element(cta).toBeEnabled();

    const target = cta.element();
    for (let presses = 0; presses < 50; presses++) {
      if (document.activeElement === target) break;
      await userEvent.tab();
    }

    expect(document.activeElement).toBe(target);
    const style = getComputedStyle(target);
    expect(style.outlineStyle).not.toBe("none");
    expect(style.outlineWidth).not.toBe("0px");

    await app.unmount();
  });
});
