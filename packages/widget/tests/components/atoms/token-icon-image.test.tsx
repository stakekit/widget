import { describe, expect, it } from "vitest";
import { TokenIconImage } from "../../../src/components/atoms/token-icon/token-icon-image";
import { render } from "../../utils/test-utils";

const validSrc =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'%3E%3C/svg%3E";
const brokenSrcOne = "data:image/png;base64,dG9rZW4x";

describe("TokenIconImage", () => {
  it("uses a single image element and prefers mainUrl when present", async () => {
    const app = await render(
      <TokenIconImage
        mainUrl={validSrc}
        fallbackUrl={validSrc}
        name="Atom"
        tokenLogoHw="9"
      />
    );

    expect(app.container.querySelectorAll("img")).toHaveLength(1);

    const image = app.container.querySelector<HTMLImageElement>("img");

    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe(validSrc);
  });

  it("falls through to the generated monogram after mainUrl fails", async () => {
    const app = await render(
      <TokenIconImage
        mainUrl={brokenSrcOne}
        fallbackUrl={validSrc}
        name="Atom"
        tokenLogoHw="9"
      />
    );

    const image = app.container.querySelector<HTMLImageElement>("img");

    expect(image).not.toBeNull();
    image?.dispatchEvent(new Event("error"));

    expect(image?.getAttribute("src")).toContain("data:image/svg+xml");
  });
});
