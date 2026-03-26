import { describe, expect, it } from "vitest";
import { Image } from "../../../src/components/atoms/image";
import { render } from "../../utils/test-utils";

const validSrcTwo =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='2'%20height='2'%3E%3C/svg%3E";
const brokenSrcOne = "data:image/png;base64,Zm9vYmFy";
const brokenSrcFour = "data:image/png;base64,YmFkMw==";

describe("Image", () => {
  it("swaps to the generated monogram when src fails and resets on src change", async () => {
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

    image?.dispatchEvent(new Event("error"));

    expect(image?.getAttribute("src")).toContain("data:image/svg+xml");

    await app.rerender(
      <Image src={validSrcTwo} fallbackName="Atom" imgProps={{ alt: "icon" }} />
    );

    const rerenderedImage =
      app.container.querySelector<HTMLImageElement>("img[alt='icon']");

    expect(rerenderedImage).not.toBeNull();
    expect(rerenderedImage?.getAttribute("src")).toBe(validSrcTwo);

    app.unmount();
  });

  it("uses the generated monogram when src is missing", async () => {
    const app = await render(
      <Image fallbackName="Atom" imgProps={{ alt: "missing-src" }} />
    );

    const image = app.container.querySelector<HTMLImageElement>(
      "img[alt='missing-src']"
    );

    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toContain("data:image/svg+xml");
  });

  it("falls back to the generated monogram after src fails", async () => {
    const app = await render(
      <Image
        src={brokenSrcOne}
        fallbackName="Atom"
        imgProps={{ alt: "monogram" }}
      />
    );

    const image = app.container.querySelector<HTMLImageElement>(
      "img[alt='monogram']"
    );

    expect(image).not.toBeNull();
    image?.dispatchEvent(new Event("error"));

    expect(image?.getAttribute("src")).toContain("data:image/svg+xml");
  });

  it("keeps the broken src when there is no monogram fallback", async () => {
    const app = await render(
      <Image src={brokenSrcFour} imgProps={{ alt: "no-fallback" }} />
    );

    const image = app.container.querySelector("img[alt='no-fallback']");

    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(brokenSrcFour);
  });
});
