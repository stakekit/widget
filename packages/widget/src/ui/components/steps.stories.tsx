import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { expect, within } from "storybook/test";
import { Steps } from "./steps";

const meta = {
  title: "Components/Steps",
  component: Steps,
  args: {
    label: "Transaction progress",
    statusLabels: {
      idle: "waiting",
      active: "in progress",
      signing: "waiting for signature",
      failed: "failed",
      done: "done",
    },
    steps: [
      { id: "sign", label: "Approve in your wallet", status: "done" },
      {
        id: "submit",
        label: "Submitting",
        description: "Sending the transaction to the network.",
        status: "active",
      },
      { id: "confirm", label: "Confirming", status: "idle" },
    ],
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Steps {...args} />
    </div>
  ),
} satisfies Meta<typeof Steps>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Each step reads its status; the active step is the current one. A waiting
 * step's ring is drawn in its state line's muted tone, which the contrast
 * test holds to 3:1 on every surface.
 */
export const InProgress: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", {
      name: "Transaction progress",
    });
    const [sign, submit, confirm] = within(list).getAllByRole("listitem");

    await expect(sign).toHaveTextContent("Approve in your wallet, done");
    await expect(submit).toHaveAttribute("aria-current", "step");
    await expect(submit).toHaveTextContent("Submitting, in progress");
    await expect(confirm).toHaveTextContent("Confirming, waiting");
    await expect(confirm).not.toHaveAttribute("aria-current");

    // A step's marker comes just before its text, after any connector.
    const [marker, text] = Array.from(confirm?.children ?? []).slice(-2);
    const stateLine = text?.children[1];
    if (marker === undefined || stateLine === undefined) {
      throw new Error("Expected a marker and a state line.");
    }
    await expect(getComputedStyle(marker).borderTopColor).toBe(
      getComputedStyle(stateLine).color
    );
  },
};

export const InProgressDark: Story = {
  ...InProgress,
  globals: { colorScheme: "dark" },
};

/**
 * A step waiting for the wallet's signature is the current one, and its
 * marker reads apart from a step under way: the accent tint, not a spinner.
 */
export const Signing: Story = {
  args: {
    steps: [
      { id: "approve", label: "Approve", status: "done" },
      { id: "stake", label: "Stake", status: "signing" },
      { id: "confirm", label: "Confirming", status: "active" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [approve, stake, confirm] =
      within(canvasElement).getAllByRole("listitem");
    await expect(stake).toHaveAttribute("aria-current", "step");
    await expect(stake).toHaveTextContent("Stake, waiting for signature");

    // A step's marker comes just before its text, after any connector.
    const marker = (item: HTMLElement | undefined) => {
      const element = Array.from(item?.children ?? []).at(-2);
      if (!(element instanceof HTMLElement)) {
        throw new Error("Expected a marker.");
      }
      return getComputedStyle(element);
    };
    const signing = marker(stake);
    await expect(signing.backgroundColor).not.toBe(
      marker(confirm).backgroundColor
    );
    // Done reads in the success tone, an outline on no fill of its own.
    const done = marker(approve);
    await expect(done.borderTopColor).not.toBe(signing.borderTopColor);
    // An outline check: no fill (alpha 0).
    await expect(done.backgroundColor).toMatch(/, 0\)$/);
  },
};

export const SigningDark: Story = {
  ...Signing,
  globals: { colorScheme: "dark" },
};

export const Failed: Story = {
  args: {
    steps: [
      { id: "sign", label: "Approve in your wallet", status: "done" },
      {
        id: "submit",
        label: "Submitting",
        description: "Something went wrong.",
        status: "failed",
      },
      { id: "confirm", label: "Confirming", status: "idle" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [, submit] = within(canvasElement).getAllByRole("listitem");
    await expect(submit).toHaveTextContent("Submitting, failed");
  },
};

/** A step can link out, such as to its transaction on a block explorer. */
export const WithLink: Story = {
  args: {
    steps: [
      {
        id: "sign",
        label: "Approve in your wallet",
        status: "done",
        link: {
          href: "https://etherscan.io/tx/0x1",
          label: "View transaction",
          newTabLabel: "opens in a new tab",
        },
      },
      { id: "confirm", label: "Confirming", status: "active" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [sign] = within(canvasElement).getAllByRole("listitem");
    await expect(
      within(sign ?? canvasElement).getByRole("link", {
        name: "View transaction opens in a new tab",
      })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
  },
};

const hashSteps: ComponentProps<typeof Steps>["steps"] = [
  {
    id: "approve",
    label: "Approve",
    status: "done",
    state: "Confirmed",
    link: {
      href: "https://etherscan.io/tx/0x1",
      label: "0x1234…abcd",
      context: "View transaction",
      newTabLabel: "opens in a new tab",
    },
  },
  {
    id: "stake",
    label: "Stake",
    status: "failed",
    description: "The transaction was rejected.",
  },
];

/**
 * A step's own state line replaces its status's label, and a shortened hash
 * link reads what it opens first.
 */
export const WithStateAndHash: Story = {
  args: {
    steps: hashSteps,
  },
  play: async ({ canvasElement }) => {
    const [approve, stake] = within(canvasElement).getAllByRole("listitem");
    await expect(approve).toHaveTextContent("Approve, Confirmed");
    await expect(
      within(approve ?? canvasElement).getByRole("link", {
        name: "View transaction, 0x1234…abcd opens in a new tab",
      })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
    await expect(stake).toHaveTextContent(
      "Stake, failedThe transaction was rejected."
    );
  },
};

export const WithStateAndHashDark: Story = {
  ...WithStateAndHash,
  globals: { colorScheme: "dark" },
};

const box = (element: Element | undefined) => {
  if (element === undefined) throw new Error("Expected an element.");
  return element.getBoundingClientRect();
};

/**
 * Markers are 24px circles; each connector runs from its marker to the next
 * one; steps sit 20px apart; nothing leaves the list at a narrow width.
 */
export const Geometry: Story = {
  args: { steps: hashSteps },
  render: (args) => (
    <div style={{ width: 200 }}>
      <Steps {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list");
    const [first, second] = within(list).getAllByRole("listitem");
    const [connector, marker, text] = Array.from(first?.children ?? []);
    const nextMarker = second?.children[0];

    await expect(box(marker).width).toBe(24);
    await expect(box(marker).height).toBe(24);
    await expect(box(connector).top).toBe(box(marker).bottom);
    await expect(box(connector).bottom).toBe(box(nextMarker).top);
    await expect(box(second).top - box(text).bottom).toBe(20);

    const listBox = list.getBoundingClientRect();
    for (const element of list.querySelectorAll("*")) {
      const { left, right } = element.getBoundingClientRect();
      await expect(left).toBeGreaterThanOrEqual(listBox.left);
      await expect(right).toBeLessThanOrEqual(listBox.right);
    }
  },
};
