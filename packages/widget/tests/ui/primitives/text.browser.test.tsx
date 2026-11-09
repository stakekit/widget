import { describe, expect, it, onTestFinished } from "vitest";
import { Text } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

// Each type role, and whether it sets figures in tabular numerals.
const roles = [
  { variant: "display", tabular: true },
  { variant: "title", tabular: false },
  { variant: "heading", tabular: false },
  { variant: "metric", tabular: true },
  { variant: "body", tabular: false },
  { variant: "label", tabular: false },
  { variant: "caption", tabular: false },
  { variant: "overline", tabular: false },
] as const;

describe("Text", () => {
  it.each(roles)(
    "sets $variant in px, whatever the root font size",
    async ({ variant, tabular }) => {
      const root = document.documentElement.style;
      onTestFinished(() => {
        root.removeProperty("font-size");
      });
      root.fontSize = "16px";
      const screen = await render(
        <Text as="p" variant={variant}>
          1,234.56
        </Text>
      );
      const style = getComputedStyle(screen.getByText("1,234.56").element());
      const atDefaultRoot = {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      };

      root.fontSize = "24px";

      expect({
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      }).toEqual(atDefaultRoot);
      expect(style.fontVariantNumeric === "tabular-nums").toBe(tabular);
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
