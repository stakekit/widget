import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { networkLogo, tokenLogo } from "../storybook/images";
import { ReviewSummary } from "./review-summary";

const meta = {
  title: "Patterns/ReviewSummary",
  component: ReviewSummary,
  args: {
    title: "Stake",
    amount: "1.5 ETH",
    destination: "Lido Staked ETH via Lido",
    token: { name: "ETH", src: tokenLogo, networkSrc: networkLogo },
    facts: [
      { label: "Reward rate", value: "3.2% APY" },
      { label: "You receive", value: "1.5 stETH" },
    ],
    fees: {
      heading: "Fees",
      rows: [
        { label: "Estimated gas fee", value: "$1.20" },
        {
          label: "Deposit fee",
          value: "0.5%",
          info: {
            label: "About the deposit fee",
            text: "Charged once, when you deposit.",
          },
        },
      ],
    },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <ReviewSummary {...args} />
    </div>
  ),
} satisfies Meta<typeof ReviewSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The action heads the summary; its facts and fees read as label-value pairs. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Stake" })
    ).toBeVisible();
    await expect(canvas.getByText("1.5 ETH")).toBeVisible();
    await expect(
      canvas.getByRole("heading", { level: 3, name: "Fees" })
    ).toBeVisible();
    await expect(canvas.getByText("Estimated gas fee")).toBeVisible();
    await expect(canvas.getByText("$1.20")).toBeVisible();
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** A fee's info button explains it; keyboard focus opens it. */
export const FeeInfo: Story = {
  parameters: {
    // Base UI's focus guards around the open popup are focus plumbing, as
    // the InfoTip stories explain.
    a11y: {
      config: {
        rules: [
          {
            id: "aria-hidden-focus",
            selector: '[aria-hidden="true"]:not([data-base-ui-focus-guard])',
          },
        ],
      },
    },
  },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(
      within(canvasElement).getByRole("button", {
        name: "About the deposit fee",
      })
    ).toHaveFocus();
    await waitFor(() =>
      expect(screen.getByText("Charged once, when you deposit.")).toBeVisible()
    );
  },
};

/** While fees load, placeholders hold their place and the region is busy. */
export const LoadingFees: Story = {
  args: {
    fees: { heading: "Fees", rows: [], loading: true },
  },
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole("heading", {
      name: "Fees",
    });
    await expect(heading.parentElement).toHaveAttribute("aria-busy", "true");
  },
};

/** Headings follow the page's outline. */
export const UnderPageHeading: Story = {
  args: { as: "h3" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { level: 3, name: "Stake" })
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { level: 4, name: "Fees" })
    ).toBeVisible();
  },
};

/** Only the amount, for an action without facts or fees. */
export const AmountOnly: Story = {
  render: ({ title, amount }) => (
    <div style={{ width: 360 }}>
      <ReviewSummary title={title} amount={amount} />
    </div>
  ),
};

/** While the gas fee is estimated, only its value waits; the other fees show. */
export const LoadingOneFee: Story = {
  args: {
    fees: {
      heading: "Fees",
      rows: [
        { label: "Estimated gas fee", loading: true, testId: "gas-fee" },
        { label: "Commission", value: "10%" },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { name: "Fees" });
    await expect(heading.parentElement).toHaveAttribute("aria-busy", "true");
    await expect(
      within(canvas.getByTestId("gas-fee")).getByText("Estimated gas fee")
    ).toBeVisible();
    await expect(canvas.getByText("10%")).toBeVisible();
  },
};

/**
 * A full-precision amount in a 400px frame, inside its gutters, wraps rather
 * than overflow.
 */
export const LongAmountNarrow: Story = {
  args: { amount: "0.123456789012345678 ETH" },
  render: (args) => (
    <div style={{ width: 352 }} data-testid="frame">
      <ReviewSummary {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByTestId("frame").getBoundingClientRect();
    const amount = canvas.getByText("0.123456789012345678 ETH");
    const box = amount.getBoundingClientRect();
    await expect(box.right).toBeLessThanOrEqual(frame.right);
    await expect(amount.scrollWidth).toBeLessThanOrEqual(amount.clientWidth);
  },
};
