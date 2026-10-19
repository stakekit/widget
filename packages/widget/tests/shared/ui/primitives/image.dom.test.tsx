import { act } from "react";
import { describe, expect, it } from "vitest";
import { Image } from "../../../../src/shared/ui/primitives/image";
import { render } from "../../../utils/test-utils.dom.tsx";

const validSrcTwo =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='2'%20height='2'%3E%3C/svg%3E";
const brokenSrcOne = "data:image/png;base64,Zm9vYmFy";
const brokenSrcFour = "data:image/png;base64,YmFkMw==";

describe("Image", () => {
  it("swaps to the monogram when src fails and resets on src change", async () => {
    const app = await render(
      <Image
        src={brokenSrcOne}
        fallbackName="Atom"
        imgProps={{ alt: "icon" }}
      />
    );

    const image =
      app.container.querySelector<HTMLImageElement>("img[alt='icon']");

    expect(image).not.toBeNull();

    act(() => image?.dispatchEvent(new Event("error")));

    expect(app.container.querySelector("img")).toBeNull();
    expect(
      app.container.querySelector("svg[role='img'][aria-label='icon']")
        ?.textContent
    ).toBe("A");

    await app.rerender(
      <Image src={validSrcTwo} fallbackName="Atom" imgProps={{ alt: "icon" }} />
    );

    const rerenderedImage =
      app.container.querySelector<HTMLImageElement>("img[alt='icon']");

    expect(rerenderedImage).not.toBeNull();
    expect(rerenderedImage?.getAttribute("src")).toBe(validSrcTwo);

    app.unmount();
  });

  it("renders the monogram when src is missing", async () => {
    const app = await render(
      <Image fallbackName="atom" imgProps={{ alt: "missing-src" }} />
    );

    expect(
      app.container.querySelector("svg[role='img'][aria-label='missing-src']")
        ?.textContent
    ).toBe("A");
  });

  it("keeps the broken src when there is no monogram fallback", async () => {
    const app = await render(
      <Image src={brokenSrcFour} imgProps={{ alt: "no-fallback" }} />
    );

    const image = app.container.querySelector("img[alt='no-fallback']");

    expect(image).not.toBeNull();

    act(() => image?.dispatchEvent(new Event("error")));

    expect(
      app.container.querySelector("img[alt='no-fallback']")?.getAttribute("src")
    ).toBe(brokenSrcFour);
  });
});
