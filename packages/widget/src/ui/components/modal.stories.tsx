import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Text } from "../primitives/text";
import { Button } from "./button";
import { EmbeddedPage } from "./embedded-page";
import { Modal } from "./modal";
import { Spinner } from "./spinner";

const meta = {
  title: "Components/Modal",
  component: Modal,
  args: {
    title: "What is Yield.xyz?",
    description: "Yield.xyz connects you to staking and lending yields.",
    closeLabel: "Close",
    trigger: <Button variant="primary">Learn more</Button>,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;

const dialog = () =>
  screen.findByRole("dialog", { name: "What is Yield.xyz?" });

/** Opens from its trigger; the close button closes it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** Footer actions sit under the body. */
export const WithFooter: Story = {
  ...Default,
  args: {
    children: <Text tone="muted">Read the documentation to learn more.</Text>,
    footer: (
      <Button variant="primary" size="cta">
        Got it
      </Button>
    ),
  },
};

/**
 * A bottom sheet below a 520px viewport, with a grab handle over its header:
 * dragged down far enough, or flicked, it closes; a shorter drag settles
 * back.
 */
export const Sheet: Story = {
  ...WithFooter,
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const sheet = await screen.findByRole("dialog");
    const handle = sheet.firstElementChild;
    if (handle === null) throw new Error("The sheet has no handle.");
    await expect(handle).toHaveAttribute("aria-hidden", "true");
    await expect(getComputedStyle(handle).display).toBe("flex");
  },
};

/** A centered dialog has no grab handle and does not drag. */
export const NoHandleOnDialog: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const dialog = await screen.findByRole("dialog");
    const handle = dialog.firstElementChild;
    if (handle === null) throw new Error("The dialog has no first part.");
    await expect(getComputedStyle(handle).display).toBe("none");
  },
};

/**
 * Enter opens it from the keyboard; focus moves inside and stays there on Tab;
 * Escape closes it and returns focus to the trigger.
 */
export const KeyboardOpenClose: Story = {
  args: {
    footer: <Button variant="primary">Got it</Button>,
  },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Learn more",
    });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    const popup = await dialog();
    await waitFor(() =>
      expect(popup.contains(document.activeElement)).toBe(true)
    );

    for (let presses = 0; presses < 4; presses++) {
      await userEvent.tab();
      await waitFor(() =>
        expect(popup.contains(document.activeElement)).toBe(true)
      );
    }

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

/**
 * `initialFocus="dialog"` focuses the dialog itself as it opens from the
 * keyboard, so the close button shows no focus ring; Tab then reaches it.
 */
export const InitialFocusOnDialog: Story = {
  args: { initialFocus: "dialog" },
  play: async () => {
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    const popup = await dialog();
    await waitFor(() => expect(popup).toHaveFocus());
    const close = within(popup).getByRole("button", { name: "Close" });
    await expect(getComputedStyle(close).outlineStyle).toBe("none");

    await userEvent.tab();
    await expect(close).toHaveFocus();
  },
};

/** The close button closes it and returns focus to the trigger. */
export const CloseButton: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Learn more",
    });
    await userEvent.click(trigger);
    const popup = await dialog();

    await userEvent.click(within(popup).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

const ControlledModal = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reopen</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Not available in your region"
        closeLabel="Close"
        description="This feature is not available in your region."
      />
    </>
  );
};

/** Controlled and open on mount, as a notice the Widget shows itself. */
export const Controlled: Story = {
  render: () => <ControlledModal />,
  play: async () => {
    const popup = await screen.findByRole("dialog", {
      name: "Not available in your region",
    });
    await waitFor(() => expect(popup).toBeVisible());
    await expect(popup).toHaveAccessibleDescription(
      "This feature is not available in your region."
    );

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

/** The popup renders into the portal container inside the theme root. */
export const InsideThemeRoot: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await dialog();
    await expect(popup.closest("[data-sk-root]")).not.toBeNull();
    await expect(popup.closest("[data-sk-portal]")).not.toBeNull();
  },
};

/**
 * `page` is a page dialog's width, 800px, and fills the dialog's
 * height; its body holds an embedded page edge to edge.
 */
export const Page: Story = {
  args: {
    size: "page",
    title: "Verify identity",
    description: undefined,
    closeTestId: "modal-close",
    children: (
      <EmbeddedPage src="about:blank" title="Verification" testId="frame" />
    ),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await screen.findByRole("dialog", {
      name: "Verify identity",
    });
    await waitFor(() => expect(popup).toBeVisible());
    const frame = within(popup).getByTitle("Verification");
    await expect(frame.getBoundingClientRect().height).toBeGreaterThan(200);
    // A page dialog is not held to a list dialog's cap.
    await expect(popup.getBoundingClientRect().height).toBeCloseTo(
      window.innerHeight - 48,
      0
    );
    await userEvent.click(within(popup).getByTestId("modal-close"));
    await waitFor(() => expect(popup).not.toBeInTheDocument());
  },
};

/** `picker` is a narrower dialog for a compact choice, such as a network. */
export const Picker: Story = {
  args: { size: "picker" },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Learn more" })
    );
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
    await expect(popup.getBoundingClientRect().width).toBe(400);
  },
};

// Choices, as in a network picker: the keyboard scrolls the body by them.
const thirtyRows = Array.from({ length: 30 }, (_, index) => (
  <Button key={index}>Network {index + 1}</Button>
));

/**
 * A long list is capped at 560px, or 80% of a shorter viewport; the body
 * scrolls under the title, which stays in view.
 */
export const LongList: Story = {
  args: {
    open: true,
    description: undefined,
    bodyTestId: "modal-body",
    titleTestId: "modal-title",
    children: thirtyRows,
  },
  render: ({ trigger: _trigger, ...args }) => <Modal {...args} />,
  play: async () => {
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
    const cap = Math.min(560, window.innerHeight * 0.8);
    await expect(popup.getBoundingClientRect().height).toBeLessThanOrEqual(
      cap + 0.5
    );
    await expect(popup.getBoundingClientRect().height).toBeGreaterThan(cap - 1);
    const body = within(popup).getByTestId("modal-body");
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    const title = within(popup).getByTestId("modal-title");
    const titleTop =
      title.getBoundingClientRect().top - popup.getBoundingClientRect().top;
    const lastRow = within(popup).getByText("Network 30");
    await expect(lastRow.getBoundingClientRect().top).toBeGreaterThan(
      popup.getBoundingClientRect().bottom
    );
    body.scrollTop = body.scrollHeight;
    // The body scrolls the last row into the dialog; the title stays put.
    await waitFor(() =>
      expect(lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        popup.getBoundingClientRect().bottom
      )
    );
    await expect(
      title.getBoundingClientRect().top - popup.getBoundingClientRect().top
    ).toBeCloseTo(titleTop, 0);
    // Its rows take focus, so the body adds no Tab stop of its own.
    await expect(body).not.toHaveAttribute("tabindex");
  },
};

/**
 * A long text with nothing to focus in it: the body takes focus itself, as a
 * region named by the title, so the keyboard can scroll it. It keeps its
 * scrollbar's gutter whether or not it overflows, so content that grows
 * never shifts when the scrollbar appears.
 */
export const LongText: Story = {
  args: {
    open: true,
    description: undefined,
    bodyTestId: "modal-body",
    children: Array.from({ length: 30 }, (_, index) => (
      <Text key={index}>Paragraph {index + 1} of the terms.</Text>
    )),
  },
  render: ({ trigger: _trigger, ...args }) => <Modal {...args} />,
  play: async () => {
    const popup = await dialog();
    const body = within(popup).getByTestId("modal-body");
    await waitFor(() =>
      expect(
        within(popup).getByRole("region", { name: "What is Yield.xyz?" })
      ).toBe(body)
    );
    await expect(body).toHaveAttribute("tabindex", "0");
    await expect(getComputedStyle(body).scrollbarGutter).toBe("stable");
  },
};

/** As a sheet, a long list is capped at 75% of the viewport's height. */
export const LongListSheet: Story = {
  ...LongList,
  globals: { viewport: { value: "mobile1", isRotated: false } },
  play: async () => {
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
    await expect(popup.getBoundingClientRect().height).toBeLessThanOrEqual(
      window.innerHeight * 0.75 + 0.5
    );
    const body = within(popup).getByTestId("modal-body");
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
  },
};

/**
 * A back button before the title steps back; a status sits right after the
 * title, such as a spinner while work is pending.
 */
export const BackAndTitleStatus: Story = {
  args: {
    open: true,
    back: { label: "Back", onBack: fn(), testId: "modal-back" },
    titleStatus: <Spinner size="sm" label="Connecting" />,
  },
  render: ({ trigger: _trigger, ...args }) => <Modal {...args} />,
  play: async ({ args }) => {
    const popup = await dialog();
    await waitFor(() => expect(popup).toBeVisible());
    await expect(within(popup).getByRole("status")).toHaveAccessibleName(
      "Connecting"
    );
    await userEvent.click(within(popup).getByTestId("modal-back"));
    await expect(args.back?.onBack).toHaveBeenCalledOnce();
  },
};

const SuspendedModal = () => {
  const [open, setOpen] = useState(false);
  const [suspended, setSuspended] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Button onClick={() => setSuspended(false)}>Resume</Button>
      <Modal
        open={open}
        suspended={suspended}
        onOpenChange={setOpen}
        title="Connect a wallet"
        closeLabel="Close"
      >
        <Button onClick={() => setSuspended(true)}>Show over it</Button>
      </Modal>
    </>
  );
};

/**
 * `suspended` hides the open modal without moving focus to its opener; once
 * shown again and closed, focus returns to the original opener.
 */
export const Suspended: Story = {
  render: () => <SuspendedModal />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const opener = canvas.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    const popup = await screen.findByRole("dialog", {
      name: "Connect a wallet",
    });
    await userEvent.click(
      within(popup).getByRole("button", { name: "Show over it" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(opener).not.toHaveFocus();

    // The modal makes the page inert while open; the resume control is outside.
    canvas
      .getByRole("button", { name: "Resume" })
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await screen.findByRole("dialog", { name: "Connect a wallet" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
  },
};

/** The modal bodies a `ResizeObserver` started observing during a story. */
const observedBodies: HTMLElement[] = [];

const RerenderingModal = () => {
  const [count, setCount] = useState(0);
  return (
    <Modal open title="Counter" closeLabel="Close" bodyTestId="modal-body">
      <Button onClick={() => setCount(count + 1)}>Rendered {count}</Button>
    </Modal>
  );
};

/**
 * The body's overflow observer is set up once: re-rendering the open modal
 * keeps observing the same body instead of reconnecting an observer.
 */
export const ObservesBodyOnce: Story = {
  render: () => <RerenderingModal />,
  beforeEach: () => {
    // oxlint-disable-next-line typescript/unbound-method -- kept to restore the prototype; the patch calls it with `.call(this, …)`
    const observe = ResizeObserver.prototype.observe;
    observedBodies.length = 0;
    ResizeObserver.prototype.observe = function (target, options) {
      if (
        target instanceof HTMLElement &&
        target.dataset.testid === "modal-body"
      ) {
        observedBodies.push(target);
      }
      observe.call(this, target, options);
    };
    return () => {
      ResizeObserver.prototype.observe = observe;
    };
  },
  play: async () => {
    const popup = await screen.findByRole("dialog", { name: "Counter" });
    for (const rendered of [0, 1, 2]) {
      await userEvent.click(
        within(popup).getByRole("button", { name: `Rendered ${rendered}` })
      );
    }
    await within(popup).findByRole("button", { name: "Rendered 3" });
    await expect(observedBodies).toHaveLength(1);
  },
};
