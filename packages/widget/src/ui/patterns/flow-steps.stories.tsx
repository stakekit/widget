import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { tokenLogo } from "../storybook/images";
import { FlowSteps } from "./flow-steps";

const stateLabels = {
  pending: "Waiting",
  active: "In progress",
  signing: "Waiting for signature",
  broadcasting: "Broadcasting",
  done: "Confirmed",
  failed: "Failed",
} as const;

const meta = {
  title: "Patterns/FlowSteps",
  component: FlowSteps,
  args: {
    label: "Transaction progress",
    stateLabels,
    explorerLink: {
      label: "View transaction",
      newTabLabel: "opens in a new tab",
    },
    steps: [
      { id: "approve", label: "Approve", state: "done" },
      { id: "stake", label: "Stake", state: "signing" },
    ],
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <FlowSteps {...args} />
    </div>
  ),
} satisfies Meta<typeof FlowSteps>;
export default meta;

type Story = StoryObj<typeof meta>;

const stepItems = (canvasElement: HTMLElement) =>
  within(
    within(canvasElement).getByRole("list", { name: "Transaction progress" })
  ).getAllByRole("listitem");

/** Waiting its turn, a step says so and is not the current one. */
export const Pending: Story = {
  args: { steps: [{ id: "stake", label: "Stake", state: "pending" }] },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent("Stake, Waiting");
    await expect(stake).not.toHaveAttribute("aria-current");
  },
};

/** The current step, before the wallet is asked. */
export const Active: Story = {
  args: { steps: [{ id: "stake", label: "Stake", state: "active" }] },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Stake, In progress");
  },
};

/** Waiting for the signature, the step says so. */
export const Signing: Story = {
  play: async ({ canvasElement }) => {
    const [, stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Stake, Waiting for signature");
  },
};

export const SigningDark: Story = {
  ...Signing,
  globals: { colorScheme: "dark" },
};

/** Being sent to the network, the step says so. */
export const Broadcasting: Story = {
  args: {
    steps: [{ id: "stake", label: "Stake", state: "broadcasting" }],
  },
  play: async ({ canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Stake, Broadcasting");
  },
};

/** Done, the step links to its transaction. */
export const Done: Story = {
  args: {
    steps: [
      {
        id: "stake",
        label: "Stake",
        state: "done",
        explorerUrl: "https://etherscan.io/tx/0x1",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent("Stake, Confirmed");
    await expect(
      canvas.getByRole("link", { name: "View transaction opens in a new tab" })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
  },
};

/** With its hash, a done step's link shows the hash and reads what it opens. */
export const DoneWithHash: Story = {
  args: {
    steps: [
      {
        id: "stake",
        label: "Stake",
        state: "done",
        explorerUrl: "https://etherscan.io/tx/0x1",
        hash: "0x1234…abcd",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "View transaction, 0x1234…abcd opens in a new tab",
    });
    await expect(link).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
    await expect(link).toHaveTextContent("0x1234…abcd");
  },
};

/** Failed, the step says so and what went wrong; retrying is the page's. */
export const Failed: Story = {
  args: {
    steps: [
      { id: "approve", label: "Approve", state: "done" },
      {
        id: "stake",
        label: "Stake",
        state: "failed",
        message: "The transaction was rejected.",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const [, stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent(
      "Stake, FailedThe transaction was rejected."
    );
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

export const FailedDark: Story = {
  ...Failed,
  globals: { colorScheme: "dark" },
};

/** The action the steps run heads them, with how far the flow got. */
export const WithSummary: Story = {
  args: {
    summary: {
      title: "Stake 0.01 ETH",
      detail: "via Lido",
      token: { name: "ETH" },
    },
    progressLabel: ({ confirmed, total }) =>
      `${confirmed} of ${total} confirmed`,
    steps: [
      {
        id: "approve",
        label: "Approve",
        state: "done",
        explorerUrl: "https://etherscan.io/tx/0x1",
        hash: "0x1234…abcd",
      },
      { id: "stake", label: "Stake", state: "signing" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Stake 0.01 ETH")).toBeVisible();
    await expect(canvas.getByText("via Lido")).toBeVisible();
    await expect(canvas.getByText("1 of 2 confirmed")).toBeVisible();
  },
};

export const WithSummaryDark: Story = {
  ...WithSummary,
  globals: { colorScheme: "dark" },
};

/** Every state in one flow. */
export const AllStates: Story = {
  args: {
    steps: [
      { id: "1", label: "Approve", state: "done" },
      { id: "2", label: "Wrap", state: "failed", message: "Out of gas." },
      { id: "3", label: "Stake", state: "broadcasting" },
      { id: "4", label: "Delegate", state: "signing" },
      { id: "5", label: "Bridge", state: "active" },
      { id: "6", label: "Claim", state: "pending" },
    ],
  },
  play: async ({ canvasElement }) => {
    const steps = stepItems(canvasElement);
    await expect(steps.map((step) => step.textContent)).toEqual([
      "Approve, Confirmed",
      "Wrap, FailedOut of gas.",
      "Stake, Broadcasting",
      "Delegate, Waiting for signature",
      "Bridge, In progress",
      "Claim, Waiting",
    ]);
  },
};

const signaturePrompt = {
  title: "Check your wallet",
  description: "Approve the Stake transaction in MetaMask",
  wallet: { name: "MetaMask", logo: tokenLogo },
};

const details = [
  { label: "Amount", value: "0.01 ETH", caption: "$24.20" },
  { label: "Yield", value: "Lido Staking via Lido" },
  { label: "Estimated gas", value: "0.0002 ETH ($0.48)" },
  { label: "You'll receive", value: "0.01 stETH" },
];

/**
 * While a signature is awaited, a card under the steps asks to approve it
 * in the wallet, with the wallet's logo; the flow's details follow it.
 */
export const AwaitingSignature: Story = {
  args: { signaturePrompt, details },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prompt = canvas.getByTestId("flow-steps-signature-prompt");
    await expect(prompt).toHaveTextContent(
      "Check your walletApprove the Stake transaction in MetaMask"
    );
    await waitFor(() =>
      expect(prompt.querySelector("img")).toHaveAttribute("src", tokenLogo)
    );

    const card = canvas.getByTestId("flow-steps-details");
    const terms = within(card).getAllByRole("term");
    await expect(terms.map((term) => term.textContent)).toEqual([
      "Amount",
      "Yield",
      "Estimated gas",
      "You'll receive",
    ]);
    await expect(card).toHaveTextContent("0.01 ETH$24.20");

    // Steps, then the wallet prompt, then the details.
    const list = canvas.getByRole("list", { name: "Transaction progress" });
    await expect(
      list.compareDocumentPosition(prompt) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await expect(
      prompt.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  },
};

export const AwaitingSignatureDark: Story = {
  ...AwaitingSignature,
  globals: { colorScheme: "dark" },
};

/** A wallet whose logo is not known shows a wallet icon in its place. */
export const AwaitingUnknownWallet: Story = {
  args: {
    signaturePrompt: {
      title: "Check your wallet",
      description: "Approve the Stake transaction in your wallet",
    },
  },
  play: async ({ canvasElement }) => {
    const prompt = within(canvasElement).getByTestId(
      "flow-steps-signature-prompt"
    );
    await expect(prompt).toHaveTextContent(
      "Approve the Stake transaction in your wallet"
    );
    await expect(prompt.querySelector("img")).toBeNull();
    await expect(prompt.querySelector("svg")).not.toBeNull();
    await expect(
      within(canvasElement).queryByTestId("flow-steps-details")
    ).toBeNull();
  },
};

/**
 * Being sent fills a third of a step's connector, confirming two thirds;
 * both turn an arc on the step's marker.
 */
export const Sending: Story = {
  args: {
    steps: [
      { id: "approve", label: "Approve", state: "broadcasting" },
      { id: "stake", label: "Stake", state: "active" },
      { id: "wrap", label: "Wrap", state: "pending" },
    ],
    details,
  },
  play: async ({ canvasElement }) => {
    const [approve, stake] = stepItems(canvasElement);
    const filled = (item: HTMLElement | undefined) => {
      const fill = item?.querySelector("[data-step-part='connector-fill']");
      const track = fill?.parentElement?.getBoundingClientRect().height ?? 0;
      return (fill?.getBoundingClientRect().height ?? 0) / track;
    };
    await expect(filled(approve)).toBeCloseTo(0.33, 2);
    await expect(filled(stake)).toBeCloseTo(0.67, 2);
    await expect(
      approve?.querySelector("[data-step-part='arc']")
    ).not.toBeNull();
    await expect(stake?.querySelector("[data-step-part='arc']")).not.toBeNull();
    await expect(
      within(canvasElement).queryByTestId("flow-steps-signature-prompt")
    ).toBeNull();
  },
};

export const SendingDark: Story = {
  ...Sending,
  globals: { colorScheme: "dark" },
};
