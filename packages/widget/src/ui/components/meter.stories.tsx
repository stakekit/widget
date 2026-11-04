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
