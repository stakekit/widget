import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Select, type SelectOption } from "./select";

type Network = "ethereum" | "solana" | "cosmos";

const networks: ReadonlyArray<SelectOption<Network>> = [
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "cosmos", label: "Cosmos Hub" },
];

const StatefulSelect = ({
  initial,
  onValueChange,
  ...rest
}: Omit<Parameters<typeof Select<Network>>[0], "value" | "onValueChange"> & {
  readonly initial: Network | null;
  readonly onValueChange: (value: Network) => void;
}) => {
  const [value, setValue] = useState<Network | null>(initial);
  return (
    <div style={{ width: 240 }}>
      <Select
        {...rest}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: "Components/Select",
  component: StatefulSelect,
  args: {
    options: networks,
    label: "Network",
    placeholder: "Choose a network",
    initial: null,
    onValueChange: fn(),
  },
} satisfies Meta<typeof StatefulSelect>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const Selected: Story = { args: { initial: "solana" } };

export const SelectedDark: Story = {
  ...Selected,
  globals: { colorScheme: "dark" },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 12 }}>
      {(["sm", "md", "lg"] as const).map((size) => (
        <StatefulSelect
          key={size}
          {...args}
          size={size}
          label={`Network ${size}`}
        />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: { initial: "ethereum", disabled: true },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", {
      name: "Network",
    });
    await userEvent.click(trigger, { pointerEventsCheck: 0 });
    await expect(screen.queryByRole("listbox")).toBeNull();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

/** A click opens the list; choosing an option shows it in the trigger. */
export const PointerSelection: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", {
      name: "Network",
    });
    await userEvent.click(trigger);

    const list = await screen.findByRole("listbox", { name: "Network" });
    await userEvent.click(within(list).getByRole("option", { name: "Solana" }));

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger).toHaveTextContent("Solana");
    await expect(args.onValueChange).toHaveBeenCalledWith("solana");
  },
};

/**
 * The list keeps its scrollbar's gutter whether or not it overflows, so its
 * options neither narrow nor shift when a long list scrolls.
 */
export const StableGutter: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("combobox", { name: "Network" })
    );
    const list = await screen.findByRole("listbox", { name: "Network" });
    await expect(getComputedStyle(list).scrollbarGutter).toBe("stable");
  },
};

/**
 * The keyboard opens the list, arrows move through it and Enter chooses;
 * Escape closes it without choosing. Focus returns to the trigger.
 */
export const KeyboardSelection: Story = {
  args: { initial: "ethereum" },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", {
      name: "Network",
    });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("listbox", { name: "Network" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveTextContent("Ethereum");

    await userEvent.keyboard("{Enter}");
    const list = await screen.findByRole("listbox", { name: "Network" });
    await waitFor(() =>
      expect(
        within(list).getByRole("option", { name: "Ethereum" })
      ).toHaveFocus()
    );
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveTextContent("Cosmos Hub");
    await expect(args.onValueChange).toHaveBeenCalledWith("cosmos");
  },
};
