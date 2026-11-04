import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Meter } from "./meter";

const meta = {
  title: "Components/Meter",
  component: Meter,
  args: { label: "Loan to value", value: 62, valueText: "62%" },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Meter {...args} />
    </div>
  ),
} satisfies Meta<typeof Meter>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A `meter` named by its label that reads out the formatted value. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", {
      name: "Loan to value",
    });
    await expect(meter).toHaveAttribute("aria-valuenow", "62");
    await expect(meter).toHaveAttribute("aria-valuetext", "62%");
  },
};

export const Tones: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 16, width: 320 }}>
      {(["accent", "success", "warning", "danger"] as const).map((tone) => (
        <Meter
          key={tone}
          {...args}
          tone={tone}
          label={`Loan to value ${tone}`}
        />
      ))}
    </div>
  ),
};

export const TonesDark: Story = { ...Tones, globals: { colorScheme: "dark" } };

/**
 * A marker ticks a point on the scale, such as the liquidation threshold, and
 * reads out with the value; the scale captions the track's ends.
 */
export const WithMarker: Story = {
  args: {
    tone: "warning",
    marker: { value: 86, label: "Liquidation at 86%" },
    scale: { start: "Low risk", end: "Liquidation at 86%" },
  },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole("meter", {
      name: "Loan to value",
    });
    await expect(meter).toHaveAttribute(
      "aria-valuetext",
      "62%, Liquidation at 86%"
    );
    await expect(within(canvasElement).getByText("Low risk")).toBeVisible();
  },
};

export const WithMarkerDark: Story = {
  ...WithMarker,
  globals: { colorScheme: "dark" },
};
