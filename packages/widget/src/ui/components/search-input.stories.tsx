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

const options = ["ETH", "USDC", "DAI"];

/** Over a listbox of results, the arrow keys and Enter stay in the field. */
const SearchCombobox = ({
  onKey,
  onValueChange,
}: {
  readonly onKey: (key: string) => void;
  readonly onValueChange: (value: string) => void;
}) => {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(-1);
  return (
    <div style={{ width: 320 }}>
      <SearchInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
        label="Search tokens"
        clearLabel="Clear search"
        listbox={{
          id: "results",
          expanded: true,
          ...(active === -1 ? {} : { activeOptionId: `result-${active}` }),
          onKey: (key) => {
            onKey(key);
            if (key === "ArrowDown") {
              setActive(Math.min(active + 1, options.length - 1));
            }
            if (key === "ArrowUp") setActive(Math.max(active - 1, 0));
          },
        }}
      />
      <div id="results" role="listbox" aria-label="Results">
        {options.map((option, index) => (
          <div
            key={option}
            id={`result-${index}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === active}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );
};

const onKey = fn();

export const Combobox: Story = {
  render: (args) => (
    <SearchCombobox onKey={onKey} onValueChange={args.onValueChange} />
  ),
  play: async ({ args, canvasElement }) => {
    onKey.mockClear();
    const combobox = within(canvasElement).getByRole("combobox", {
      name: "Search tokens",
    });
    await expect(combobox).toHaveAttribute("aria-controls", "results");
    await expect(combobox).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(combobox);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(combobox).toHaveAttribute("aria-activedescendant", "result-1");
    await expect(onKey.mock.calls).toEqual([
      ["ArrowDown"],
      ["ArrowDown"],
      ["Enter"],
    ]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(combobox).toHaveValue("");
  },
};

/** While an IME composes, the arrow keys and Enter stay with it. */
export const ComboboxComposing: Story = {
  render: (args) => (
    <SearchCombobox onKey={onKey} onValueChange={args.onValueChange} />
  ),
  play: async ({ canvasElement }) => {
    onKey.mockClear();
    const combobox = within(canvasElement).getByRole("combobox", {
      name: "Search tokens",
    });
    await userEvent.click(combobox);
    for (const key of ["ArrowDown", "Enter"]) {
      combobox.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        })
      );
    }
    await expect(onKey).not.toHaveBeenCalled();
    await expect(combobox).not.toHaveAttribute("aria-activedescendant");
  },
};
