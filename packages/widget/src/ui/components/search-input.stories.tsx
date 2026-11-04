import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Field } from "./field";
import { SearchInput } from "./search-input";

const StatefulSearchInput = ({
  initial,
  onValueChange,
  disabled = false,
}: {
  readonly initial: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 320 }}>
      <SearchInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
        label="Search tokens"
        placeholder="Search"
        clearLabel="Clear search"
        disabled={disabled}
      />
    </div>
  );
};

const SearchInDisabledField = ({
  initial,
  onValueChange,
}: {
  readonly initial: string;
  readonly onValueChange: (value: string) => void;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ width: 320 }}>
      <Field label="Search tokens" disabled>
        <SearchInput
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
          clearLabel="Clear search"
        />
      </Field>
    </div>
  );
};

const meta = {
  title: "Components/SearchInput",
  component: StatefulSearchInput,
  args: { initial: "", onValueChange: fn() },
} satisfies Meta<typeof StatefulSearchInput>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { initial: "usdc" } };

export const FilledDark: Story = {
  args: { initial: "usdc" },
  globals: { colorScheme: "dark" },
};

/**
 * Typing reports the query; Escape clears it, and so does the clear button,
 * which then leaves with the query.
 */
export const TypeAndClear: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "Search tokens" });

    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.keyboard("eth");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("eth");

    await userEvent.keyboard("{Escape}");
    await expect(input).toHaveValue("");
    await expect(input).toHaveFocus();

    await userEvent.keyboard("sol");
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(input).toHaveValue("");
    await expect(input).toHaveFocus();
    await expect(
      canvas.queryByRole("button", { name: "Clear search" })
    ).toBeNull();
  },
};

/** A disabled input takes no typing. */
export const Disabled: Story = {
  args: { initial: "usdc", disabled: true },
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole("searchbox");
    await expect(input).toBeDisabled();
    await userEvent.type(input, "x", { pointerEventsCheck: 0 });
    await expect(input).toHaveValue("usdc");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

/**
 * A disabled `Field` disables the input it holds and leaves no clear button,
 * with `disabled` unset on the SearchInput itself.
 */
export const InDisabledField: Story = {
  args: { initial: "usdc" },
  render: (args) => <SearchInDisabledField {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("searchbox", { name: "Search tokens" });
    await expect(input).toBeDisabled();
    await expect(
      canvas.queryByRole("button", { name: "Clear search" })
    ).toBeNull();
    await userEvent.type(input, "{Escape}x", { pointerEventsCheck: 0 });
    await expect(input).toHaveValue("usdc");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
