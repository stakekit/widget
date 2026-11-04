import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Menu } from "./menu";

const meta = {
  title: "Components/Menu",
  component: Menu,
  args: {
    label: "Account",
    trigger: <Button iconEnd="CaretDownIcon">0x12…cdef</Button>,
    items: [
      {
        id: "copy",
        label: "Copy address",
        icon: "CopyIcon",
        onSelect: fn(),
      },
      {
        id: "history",
        label: "Activity",
        icon: "HistoryIcon",
        onSelect: fn(),
        disabled: true,
      },
      {
        id: "disconnect",
        label: "Disconnect",
        icon: "DisconnectIcon",
        tone: "danger",
        onSelect: fn(),
      },
    ],
  },
  render: (args) => (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Menu {...args} />
    </div>
  ),
} satisfies Meta<typeof Menu>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A click opens the menu; choosing an action runs it and closes the menu. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "0x12…cdef" })
    );
    const menu = await screen.findByRole("menu", { name: "Account" });
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Copy address" })
    );
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(args.items[0]?.onSelect).toHaveBeenCalledTimes(1);
  },
};

export const OpenDark: Story = {
  globals: { colorScheme: "dark" },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "0x12…cdef" })
    );
    await screen.findByRole("menu", { name: "Account" });
  },
};

/**
 * Enter opens the menu on its first action; arrows move through the actions,
 * and Enter runs the highlighted one but not a disabled one. Escape closes
 * without running anything,
 * and focus returns to the trigger each time.
 */
export const Keyboard: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "0x12…cdef",
    });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const menu = await screen.findByRole("menu", { name: "Account" });
    const copy = within(menu).getByRole("menuitem", { name: "Copy address" });
    const activity = within(menu).getByRole("menuitem", { name: "Activity" });
    await waitFor(() => expect(copy).toHaveFocus());
    await expect(activity).toHaveAttribute("aria-disabled", "true");
    // The focused item draws the focus ring, not just the hover tint.
    await expect(getComputedStyle(copy).outlineStyle).toBe("solid");

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(args.items[0]?.onSelect).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    const reopened = await screen.findByRole("menu", { name: "Account" });
    const disconnect = within(reopened).getByRole("menuitem", {
      name: "Disconnect",
    });
    await waitFor(() =>
      expect(
        within(reopened).getByRole("menuitem", { name: "Copy address" })
      ).toHaveFocus()
    );
    // A disabled action stays reachable, so it can be read, but does nothing.
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(
        within(reopened).getByRole("menuitem", { name: "Activity" })
      ).toHaveFocus()
    );
    await userEvent.keyboard("{Enter}");
    await expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(disconnect).toHaveFocus());
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(args.items[2]?.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.items[1]?.onSelect).not.toHaveBeenCalled();
  },
};
