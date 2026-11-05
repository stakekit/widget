import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Badge } from "./badge";
import { DetailList, DetailRow } from "./detail-list";
import { ExpandableAmount } from "./expandable-amount";

const address = "0x9f8d3e2b7c1a4f6e5d0c8b7a6f5e4d3c2b1a0f9e";

const meta = {
  title: "Components/DetailList",
  component: DetailList,
  args: {
    children: (
      <>
        <DetailRow label="Reward rate" value="4.21%" />
        <DetailRow
          label="Staked"
          value={<ExpandableAmount short="1.23K ETH" full="1,234.5678 ETH" />}
        />
        <DetailRow
          label="Status"
          value={<Badge tone="warning">Pending</Badge>}
        />
        <DetailRow label="Health factor" value="1.08" tone="danger" />
        <DetailRow
          label="Validator"
          value="0x9f8d…0f9e"
          copyable={{
            value: address,
            label: "Copy address",
            copiedLabel: "Copied",
          }}
        />
      </>
    ),
  },
} satisfies Meta<typeof DetailList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Rows: Story = {};

export const RowsDark: Story = { globals: { colorScheme: "dark" } };

/** A caption under the value gives its context, such as its fiat value. */
export const WithCaption: Story = {
  args: {
    children: (
      <DetailRow label="Active" value="12.5 ETH" caption="$40,120.00" />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12.5 ETH")).toBeVisible();
    await expect(canvas.getByText("$40,120.00")).toBeVisible();
  },
};

export const WithCaptionDark: Story = {
  ...WithCaption,
  globals: { colorScheme: "dark" },
};

/**
 * The copy button copies the full value, shows a check and announces the
 * outcome. The story replaces the clipboard, so nothing leaves the page.
 */
export const Copy: Story = {
  beforeEach: () => {
    const clipboard = navigator.clipboard;
    const writeText = fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    return () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy address" }));

    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(address);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Copied")
    );
  },
};

/**
 * A row's meter draws its value as a thin gauge across the row, under the
 * label and value, in the row's tone; it reads out as a `meter` named by the
 * row's label.
 */
export const WithMeter: Story = {
  args: {
    children: (
      <>
        <DetailRow
          label="LTV ratio"
          testId="ltv-row"
          value="72%"
          tone="warning"
          meter={{
            value: 72,
            valueText: "72%",
            marker: { value: 80, label: "Max LTV 80%" },
          }}
        />
        <DetailRow label="Health factor" value="1.18" tone="warning" />
      </>
    ),
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <DetailList {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const meter = canvas.getByRole("meter", { name: "LTV ratio" });
    await expect(meter).toHaveAttribute("aria-valuetext", "72%, Max LTV 80%");
    // The gauge sits under the label and value and spans the row.
    const row = canvas.getByTestId("ltv-row");
    const value = canvas.getByText("72%").getBoundingClientRect();
    const gauge = meter.getBoundingClientRect();
    await expect(gauge.top).toBeGreaterThanOrEqual(value.bottom);
    await expect(gauge.width).toBe(row.getBoundingClientRect().width);
  },
};

export const WithMeterDark: Story = {
  ...WithMeter,
  globals: { colorScheme: "dark" },
};
