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
      cancelled: "cancelled in wallet",
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

/** A step's motion part: its signing halo, active arc or connector fill. */
const stepPart = (
  item: HTMLElement | undefined,
  part: "halo" | "arc" | "connector-fill"
) => {
  const element = item?.querySelector(`[data-step-part="${part}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected the step's ${part}.`);
  }
  return element;
};

/**
 * Waiting for its signature, a step's wallet pulses a halo, slowly, around
 * its marker; no other step has one. Reduced motion holds it still: see
 * `steps-reduced-motion.browser.test.tsx`.
 */
export const SigningHalo: Story = {
  ...Signing,
  play: async ({ canvasElement }) => {
    const [approve, stake, confirm] =
      within(canvasElement).getAllByRole("listitem");
    const halo = getComputedStyle(stepPart(stake, "halo"));
    await expect(halo.animationName).not.toBe("none");
    await expect(halo.animationIterationCount).toBe("infinite");
    // Slower than the arc's turn.
    await expect(Number.parseFloat(halo.animationDuration)).toBeGreaterThan(
      Number.parseFloat(
        getComputedStyle(stepPart(confirm, "arc")).animationDuration
      )
    );
    await expect(approve?.querySelector("[data-step-part='halo']")).toBeNull();

    // The halo centres on the marker, behind its wallet icon.
    const marker = Array.from(stake?.children ?? []).at(-2);
    const haloBox = stepPart(stake, "halo").getBoundingClientRect();
    const markerBox = marker?.getBoundingClientRect();
    await expect(haloBox.left + haloBox.width / 2).toBeCloseTo(
      (markerBox?.left ?? 0) + (markerBox?.width ?? 0) / 2,
      0
    );
  },
};

export const SigningHaloDark: Story = {
  ...SigningHalo,
  globals: { colorScheme: "dark" },
};

/**
 * Under way, a step's marker turns an accent arc on its ring, and its
 * connector fills toward the next step by its stage: a third while it is
 * submitted, two thirds while it is confirmed, all once it is done.
 */
export const Progressing: Story = {
  args: {
    steps: [
      { id: "approve", label: "Approve", status: "done" },
      { id: "stake", label: "Stake", status: "active", stage: "submitting" },
      { id: "wrap", label: "Wrap", status: "active", stage: "confirming" },
      { id: "confirm", label: "Confirm", status: "idle" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [approve, stake, wrap, confirm] =
      within(canvasElement).getAllByRole("listitem");
    const arc = stepPart(stake, "arc");
    const turning = getComputedStyle(arc);
    await expect(turning.animationName).not.toBe("none");
    await expect(turning.animationIterationCount).toBe("infinite");
    await expect(Number.parseFloat(turning.animationDuration)).toBeGreaterThan(
      0
    );
    // The arc lies on the marker's ring (layout boxes: the arc turns).
    const marker = Array.from(stake?.children ?? []).at(-2);
    await expect(arc.offsetWidth).toBe(
      marker instanceof HTMLElement ? marker.offsetWidth : -1
    );
    await expect(approve?.querySelector("[data-step-part='arc']")).toBeNull();
    // A thick accent quarter turns on a lighter track than a waiting ring.
    const waitingMarker = Array.from(confirm?.children ?? []).at(-2);
    const waitingRing =
      waitingMarker instanceof HTMLElement
        ? getComputedStyle(waitingMarker).borderTopColor
        : "";
    await expect(turning.borderBottomColor).not.toBe(waitingRing);
    await expect(turning.borderTopColor).not.toBe(turning.borderBottomColor);
    await expect(turning.borderTopWidth).toBe("2px");

    const filled = (item: HTMLElement | undefined) => {
      const fill = stepPart(item, "connector-fill");
      const track = fill.parentElement?.getBoundingClientRect().height ?? 0;
      return fill.getBoundingClientRect().height / track;
    };
    await expect(filled(approve)).toBe(1);
    await expect(filled(stake)).toBeCloseTo(0.33, 2);
    await expect(filled(wrap)).toBeCloseTo(0.67, 2);
    // The last step has no connector.
    await expect(
      confirm?.querySelector("[data-step-part='connector-fill']")
    ).toBeNull();
    // Done leads on in the success tone; under way, in the accent.
    await expect(
      getComputedStyle(stepPart(approve, "connector-fill")).backgroundColor
    ).not.toBe(
      getComputedStyle(stepPart(stake, "connector-fill")).backgroundColor
    );
  },
};

export const ProgressingDark: Story = {
  ...Progressing,
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
    reference: "0x1234…abcd",
    link: {
      href: "https://etherscan.io/tx/0x1",
      label: "View on explorer",
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
 * A step's own state line replaces its status's label, and a sent
 * transaction's shortened hash shows beside its explorer link.
 */
export const WithStateAndHash: Story = {
  args: {
    steps: hashSteps,
  },
  play: async ({ canvasElement }) => {
    const [approve, stake] = within(canvasElement).getAllByRole("listitem");
    await expect(approve).toHaveTextContent("Approve, Confirmed");
    await expect(approve).toHaveTextContent("0x1234…abcd");
    await expect(
      within(approve ?? canvasElement).getByRole("link", {
        name: "View on explorer opens in a new tab",
      })
    ).toHaveAttribute("href", "https://etherscan.io/tx/0x1");
    await expect(stake).toHaveTextContent(
      "Stake, failedThe transaction was rejected."
    );
  },
};

/**
 * A request the user declined in the wallet reads as neutral, not failed: a
 * muted dash on the waiting ring and a muted state line.
 */
export const Cancelled: Story = {
  args: {
    steps: [
      { id: "stake", label: "Stake", status: "cancelled" },
      { id: "fail", label: "Wrap", status: "failed" },
    ],
  },
  play: async ({ canvasElement }) => {
    const [stake, wrap] = within(canvasElement).getAllByRole("listitem");
    await expect(stake).toHaveTextContent("Stake, cancelled in wallet");
    const stateColor = (item: HTMLElement | undefined) => {
      const line = Array.from(item?.children ?? []).at(-1)?.children[1];
      return line ? getComputedStyle(line).color : "";
    };
    await expect(stateColor(stake)).not.toBe(stateColor(wrap));
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
