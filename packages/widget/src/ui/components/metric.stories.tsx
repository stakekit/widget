import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ExpandableAmount } from "./expandable-amount";
import { Metric, MetricGroup } from "./metric";

const meta = {
  title: "Components/Metric",
  component: Metric,
  args: { label: "Total staked", value: "1,234.56 ETH" },
} satisfies Meta<typeof Metric>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Value: Story = {};

export const WithCaption: Story = { args: { caption: "$4,012,330.12" } };

/** Green is for positive rates and claimable amounts only. */
export const PositiveRate: Story = {
  args: { label: "Reward rate", value: "4.21%", valueTone: "success" },
};

export const WithExpandableAmount: Story = {
  args: { value: <ExpandableAmount short="1.23K ETH" full="1,234.56 ETH" /> },
};

/** Metrics side by side, read as terms and their descriptions. */
export const Group: Story = {
  render: () => (
    <MetricGroup>
      <Metric label="Total staked" value="1,234.56 ETH" caption="$4,012,330" />
      <Metric label="Reward rate" value="4.21%" valueTone="success" />
      <Metric label="Rewards" value="12.34 ETH" />
    </MetricGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("term")).toHaveLength(3);
    await expect(canvas.getAllByRole("definition")).toHaveLength(3);
  },
};

export const GroupDark: Story = { ...Group, globals: { colorScheme: "dark" } };

export const GroupTwoColumns: Story = {
  render: () => (
    <MetricGroup columns={2}>
      <Metric label="Total staked" value="1,234.56 ETH" />
      <Metric label="Reward rate" value="4.21%" valueTone="success" />
      <Metric label="Rewards" value="12.34 ETH" />
      <Metric label="Validators" value="3" />
    </MetricGroup>
  ),
};
