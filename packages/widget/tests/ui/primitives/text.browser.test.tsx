import { describe, expect, it } from "vitest";
import { Text } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

const roles = [
  { variant: "display", size: "32px", lineHeight: "40px", tabular: true },
  { variant: "title", size: "20px", lineHeight: "28px", tabular: false },
  { variant: "heading", size: "16px", lineHeight: "24px", tabular: false },
  { variant: "metric", size: "18px", lineHeight: "24px", tabular: true },
  { variant: "body", size: "14px", lineHeight: "20px", tabular: false },
  { variant: "label", size: "13px", lineHeight: "18px", tabular: false },
  { variant: "caption", size: "12px", lineHeight: "16px", tabular: false },
  { variant: "overline", size: "11px", lineHeight: "16px", tabular: false },
] as const;

describe("Text", () => {
  it.each(roles)(
    "sets $variant in px, whatever the root font size",
    async ({ variant, size, lineHeight, tabular }) => {
      document.documentElement.style.fontSize = "24px";
      const screen = await render(
        <Text as="p" variant={variant}>
          1,234.56
        </Text>
      );
      const style = getComputedStyle(screen.getByText("1,234.56").element());

      expect(style.fontSize).toBe(size);
      expect(style.lineHeight).toBe(lineHeight);
      expect(style.fontVariantNumeric === "tabular-nums").toBe(tabular);

      document.documentElement.style.removeProperty("font-size");
    }
  );

  it("renders a heading role as the element it names", async () => {
    const screen = await render(
      <Text as="h2" variant="title">
        Yield
      </Text>
    );

    await expect
      .element(screen.getByRole("heading", { level: 2, name: "Yield" }))
      .toBeInTheDocument();
  });

  it("sets overlines in capitals", async () => {
    const screen = await render(<Text variant="overline">Rewards</Text>);

    expect(
      getComputedStyle(screen.getByText("Rewards").element()).textTransform
    ).toBe("uppercase");
  });
});
