import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Meter } from "../components/meter";
import { ContainerFrame } from "../storybook/container-frame";
import { PositionSummary } from "./position-summary";

const box = (element: Element | null | undefined) => {
  if (!element) throw new Error("Expected an element");
  return element.getBoundingClientRect();
};

const meta = {
  title: "Patterns/PositionSummary",
  component: PositionSummary,
  args: {
    label: "Your position",
    value: "$1,234.56",
    subvalue: "1,234.5678 USDC",
    metrics: [
      { label: "APY", value: "4.12%" },
      { label: "Est. earnings", value: "+$50.86 / yr", tone: "success" },
    ],
  },
  render: (args) => (
    <ContainerFrame width={480}>
      <PositionSummary {...args} />
    </ContainerFrame>
  ),
} satisfies Meta<typeof PositionSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The hero figure with the token amount under it, and the side figures on
 * its right, each read as a term and its description.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = canvas.getByText("$1,234.56");
    const apy = canvas.getByText("4.12%");

    await expect(canvas.getByText("1,234.5678 USDC")).toBeVisible();
    await expect(canvas.getByText("+$50.86 / yr")).toBeVisible();
    await expect(box(hero).right).toBeLessThanOrEqual(box(apy).left);
    await expect(canvas.getAllByRole("term")).toHaveLength(3);
    await expect(canvas.getAllByRole("definition")).toHaveLength(3);
  },
};

export const DefaultDark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** Below `sm` the side figures stack under the hero. */
export const Narrow: Story = {
  render: (args) => (
    <ContainerFrame width={320}>
      <PositionSummary {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const subvalue = canvas.getByText("1,234.5678 USDC");
    const apy = canvas.getByText("4.12%");

    await expect(box(apy).top).toBeGreaterThanOrEqual(box(subvalue).bottom);
  },
};

export const NarrowDark: Story = {
  ...Narrow,
  globals: { colorScheme: "dark" },
};

/** Extra content, such as a borrow position's LTV gauge, sits under the figures. */
export const WithGauge: Story = {
  args: {
    value: "$8,420.00",
    subvalue: "Net worth",
    metrics: [
      { label: "Debt", value: "$2,100.00" },
      { label: "Health factor", value: "1.42", tone: "warning" },
    ],
    children: <Meter label="Loan to value" value={62} valueText="62%" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("meter")).toBeVisible();
  },
};

/**
 * A side figure can carry a muted caption under its value and an info
 * button beside its label, such as what the wallet earned this week.
 */
export const WithCaptionAndInfo: Story = {
  args: {
    metrics: [
      { label: "APY", value: "4.12%" },
      {
        label: "Earned (7d)",
        value: "+0.0123 POL",
        caption: "+$0.01 · 0.52 POL total",
        info: {
          label: "About earned",
          text: "Tracked since your wallet was first indexed · updated hourly",
        },
        tone: "success",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("+$0.01 · 0.52 POL total")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "About earned" })
    ).toBeVisible();
    await expect(canvas.getAllByRole("term")).toHaveLength(3);
  },
};

/** While the position loads, placeholders keep the card's shape. */
export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("$1,234.56")).toBeNull();
    await expect(canvas.getByText("Your position")).toBeVisible();
  },
};
