import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Meter } from "../components/meter";
import { ContainerFrame } from "../storybook/container-frame";
import { PositionSummary } from "./position-summary";

const box = (element: Element | null | undefined) => {
  if (!element) throw new Error("Expected an element");
  return element.getBoundingClientRect();
};

const earnedInfo = {
  label: "About earned",
  text: "Tracked since your wallet was first indexed · updated hourly",
};

// An earning position's rate and rows; a borrow position has neither.
const earning = {
  badge: "4.12% APY",
  rows: [
    {
      label: "Earned · last 7 days",
      value: "+$0.97",
      caption: "+0.9712 USDC",
      tone: "success",
    },
    {
      label: "Earned · all time",
      value: "+$12.40",
      caption: "+12.4012 USDC",
      tone: "success",
      info: earnedInfo,
    },
    { label: "Projected · per year", value: "≈ $50.86", tone: "muted" },
  ],
} as const;

const meta = {
  title: "Patterns/PositionSummary",
  component: PositionSummary,
  args: {
    label: "Your position",
    value: "$1,234.56",
    subvalue: "1,234.5678 USDC",
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
 * The hero figure with the token amount under it and the reward rate as a
 * badge beside it; what the position earned and is projected to earn reads
 * as rows under a divider, each a term and its description.
 */
export const Default: Story = {
  args: earning,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hero = canvas.getByText("$1,234.56");
    const badge = canvas.getByText("4.12% APY");
    const projected = canvas.getByText("≈ $50.86");

    await expect(canvas.getByText("1,234.5678 USDC")).toBeVisible();
    await expect(box(hero).right).toBeLessThanOrEqual(box(badge).left);
    await expect(box(projected).top).toBeGreaterThan(box(hero).bottom);
    await expect(canvas.getByRole("separator")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "About earned" })
    ).toBeVisible();
    await expect(canvas.getAllByRole("term")).toHaveLength(4);
    await expect(canvas.getAllByRole("definition")).toHaveLength(4);
  },
};

export const DefaultDark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** Narrow, the badge keeps its place beside the hero and the rows their line. */
export const Narrow: Story = {
  args: earning,
  render: (args) => (
    <ContainerFrame width={320}>
      <PositionSummary {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText("Earned · last 7 days");
    const value = canvas.getByText("+$0.97");

    await expect(box(canvas.getByText("4.12% APY")).top).toBeLessThan(
      box(canvas.getByText("1,234.5678 USDC")).top
    );
    await expect(box(label).right).toBeLessThanOrEqual(box(value).left);
  },
};

export const NarrowDark: Story = {
  ...Narrow,
  globals: { colorScheme: "dark" },
};

/**
 * A dust position: every figure is under a cent, so the projection is left
 * out and what was earned reads as a bound.
 */
export const Dust: Story = {
  args: {
    value: "<$0.01",
    subvalue: "0.0044 USDC",
    badge: "4.06% APY",
    rows: [
      { label: "Earned · last 7 days", value: "$0.00" },
      {
        label: "Earned · all time",
        value: "<$0.01",
        caption: "<0.0001 USDC",
        tone: "success",
        info: earnedInfo,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Projected · per year")).toBeNull();
    await expect(canvas.getAllByRole("term")).toHaveLength(3);
  },
};

/**
 * Side figures sit beside the hero and extra content, such as a borrow
 * position's LTV gauge, under them.
 */
export const WithMetricsAndGauge: Story = {
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
    const hero = canvas.getByText("$8,420.00");
    const debt = canvas.getByText("$2,100.00");

    await expect(box(hero).right).toBeLessThanOrEqual(box(debt).left);
    await expect(canvas.getByRole("meter")).toBeVisible();
    await expect(canvas.queryByRole("separator")).toBeNull();
  },
};

/** While the position loads, placeholders keep the card's shape. */
export const Loading: Story = {
  args: { ...earning, loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("$1,234.56")).toBeNull();
    await expect(canvas.queryByText("4.12% APY")).toBeNull();
    await expect(canvas.getByText("Your position")).toBeVisible();
  },
};
