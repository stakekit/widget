import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CompleteSummary } from "./complete-summary";

const meta = {
  title: "Patterns/CompleteSummary",
  component: CompleteSummary,
  args: {
    title: "Successfully restaked 0.001 ETH",
    detail: "via Ether.fi",
    rows: [
      {
        label: "You received",
        value: "0.001 eETH",
        caption: "$2.42",
        testId: "received",
      },
    ],
    transactions: {
      heading: "Transactions",
      newTabLabel: "opens in a new tab",
      items: [
        {
          id: "approve",
          label: "Approve",
          href: "https://etherscan.io/tx/0x1",
          hash: "0x12ab…9f3c",
          viewLabel: "View Approve transaction",
        },
        {
          id: "stake",
          label: "Stake",
          href: "https://etherscan.io/tx/0x2",
          hash: "0x34cd…1a2b",
          viewLabel: "View Stake transaction",
        },
      ],
    },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <CompleteSummary {...args} />
    </div>
  ),
} satisfies Meta<typeof CompleteSummary>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A success mark over what happened, what it returned, and its transactions
 * as a compact list of explorer links.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", {
        level: 2,
        name: "Successfully restaked 0.001 ETH",
      })
    ).toBeVisible();
    await expect(
      within(canvas.getByTestId("received")).getByText("0.001 eETH")
    ).toBeVisible();
    const list = canvas.getByRole("list", { name: "Transactions" });
    await expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await expect(
      within(list).getByRole("link", { name: /View Stake transaction/u })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x2");
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** An exit says what is left to do: withdraw once the funds unlock. */
export const WithNote: Story = {
  args: {
    title: "Successfully unstaked 12.57 POL",
    rows: [],
    note: "12.57 POL unlocks around Nov 12. Come back then to withdraw it from your position.",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/unlocks around Nov 12/u)
    ).toBeVisible();
  },
};

/** Opening a transaction's link reports it, such as to record the visit. */
export const OpensTransaction: Story = {
  args: {
    transactions: {
      heading: "Transactions",
      newTabLabel: "opens in a new tab",
      items: [
        {
          id: "stake",
          label: "Stake",
          href: "https://etherscan.io/tx/0x2",
          viewLabel: "View Stake transaction",
        },
      ],
      onOpen: fn(),
    },
  },
  beforeEach: () => {
    // Keep the test page from opening the explorer in a new tab.
    const stay = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", stay, { capture: true });
    return () => window.removeEventListener("click", stay, { capture: true });
  },
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: /View Stake transaction/u,
    });
    await userEvent.click(link);
    await expect(args.transactions?.onOpen).toHaveBeenCalledOnce();
  },
};

/** Only what happened, for an action that sent nothing to show. */
export const TitleOnly: Story = {
  render: ({ title }) => (
    <div style={{ width: 360 }}>
      <CompleteSummary title={title} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("list")).toBeNull();
  },
};
