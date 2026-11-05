import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
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

/** Failed, the step says what went wrong, and its retry button retries. */
export const Failed: Story = {
  args: {
    retry: { label: "Try again", onClick: fn() },
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
  play: async ({ args, canvasElement }) => {
    const [approve, stake] = stepItems(canvasElement);
    await expect(stake).toHaveTextContent(
      "Stake, FailedThe transaction was rejected.Try again"
    );
    await expect(
      within(approve ?? canvasElement).queryByRole("button")
    ).toBeNull();
    await userEvent.click(
      within(stake ?? canvasElement).getByRole("button", { name: "Try again" })
    );
    await expect(args.retry?.onClick).toHaveBeenCalledOnce();
  },
};

export const FailedDark: Story = {
  ...Failed,
  globals: { colorScheme: "dark" },
};

/** With no step showing the failure, the retry button sits under the list. */
export const RetryWithoutFailedStep: Story = {
  args: {
    retry: { label: "Try again", onClick: fn() },
    steps: [{ id: "stake", label: "Stake", state: "pending" }],
  },
  play: async ({ args, canvasElement }) => {
    const [stake] = stepItems(canvasElement);
    await expect(
      within(stake ?? canvasElement).queryByRole("button")
    ).toBeNull();
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Try again" })
    );
    await expect(args.retry?.onClick).toHaveBeenCalledOnce();
  },
};

/** Failed before any step was listed, the flow shows only its retry button. */
export const RetryWithoutSteps: Story = {
  args: {
    retry: { label: "Try again", onClick: fn() },
    steps: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("list", { name: "Transaction progress" })
    ).toBeNull();
    await expect(
      canvas.getByRole("button", { name: "Try again" })
    ).toBeVisible();
  },
};

/** While the retry runs, its button is busy. */
export const Retrying: Story = {
  args: {
    ...Failed.args,
    retry: { label: "Try again", onClick: fn(), loading: true },
  },
  play: async ({ canvasElement }) => {
    const retry = within(canvasElement).getByRole("button", {
      name: "Try again",
    });
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute("aria-busy", "true");
  },
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
