import { describe, expect, it } from "vitest";
import { TokenIconImage } from "../../../src/features/widget-shell/ui/token-icon/token-icon-image";
import { render } from "../../utils/test-utils";

const validSrc =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1'%20height='1'%3E%3C/svg%3E";

describe("TokenIconImage", () => {
  it("sizes the image from a host-overridden wrapper", async () => {
    const app = await render(
      <div data-test-host>
        <style>{`
          [data-test-host] [data-rk="token-logo"] {
            width: 24px;
            height: 24px;
          }
        `}</style>
        <TokenIconImage mainUrl={validSrc} name="Atom" tokenLogoHw="9" />
      </div>
    );

    const wrapper = app.container.querySelector<HTMLElement>(
      '[data-rk="token-logo"]'
    );
    const image = wrapper?.querySelector<HTMLImageElement>("img");

    expect(wrapper?.getBoundingClientRect().width).toBe(24);
    expect(wrapper?.getBoundingClientRect().height).toBe(24);
    expect(image?.getBoundingClientRect().width).toBe(24);
    expect(image?.getBoundingClientRect().height).toBe(24);
  });
});
