import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { isWithin } from "../storybook/geometry";
import { PopupFrame } from "../storybook/popup-frame";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  args: {
    label: "Copy address",
    children: <Button variant="secondary">Copy</Button>,
  },
  render: (args) => (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 64 }}>
      <Tooltip {...args} />
    </div>
  ),
} satisfies Meta<typeof Tooltip>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Hovering the trigger shows the hint. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", { name: "Copy" })
    );
    const hint = await screen.findByText("Copy address");
    await waitFor(() => expect(hint).toBeVisible());
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** Keyboard focus shows it; Escape hides it and focus stays on the trigger. */
export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "Copy" });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    const hint = await screen.findByText("Copy address");
    await waitFor(() => expect(hint).toBeVisible());

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText("Copy address")).not.toBeInTheDocument()
    );
    await expect(trigger).toHaveFocus();
  },
};

/** Each side places the hint beside the trigger. */
export const Sides: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        gap: 96,
        justifyContent: "center",
        paddingTop: 96,
      }}
    >
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side} {...args} side={side} label={`On the ${side}`}>
          <Button>{side}</Button>
        </Tooltip>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", { name: "bottom" })
    );
    const hint = await screen.findByText("On the bottom");
    await waitFor(() => expect(hint).toBeVisible());
  },
};

/**
 * It stays inside the Widget's frame: asked for the right side by a trigger
 * at the frame's right edge, the hint flips to the left rather than passing
 * the edge, though the page has room beyond it.
 */
export const StaysInFrame: Story = {
  args: { side: "right", label: "Copy the full address" },
  render: (args) => (
    <PopupFrame>
      <Tooltip {...args} />
    </PopupFrame>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole("button", { name: "Copy" })
    );
    const hint = await screen.findByText("Copy the full address");
    await waitFor(() => expect(hint).toBeVisible());
    const frame = within(canvasElement).getByTestId("frame");
    await waitFor(() =>
      expect(
        isWithin(hint.getBoundingClientRect(), frame.getBoundingClientRect())
      ).toBe(true)
    );
  },
};
