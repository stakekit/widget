import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AmountInput } from "./amount-input";
import type { AmountSeparators } from "./amount-input-text";

const english: AmountSeparators = { decimal: ".", group: "," };
const german: AmountSeparators = { decimal: ",", group: "." };
const french: AmountSeparators = { decimal: ",", group: "\u202F" };

const StatefulAmountInput = ({
  initial,
  onValueChange,
  separators,
  switchTo,
  invalid = false,
  disabled = false,
  shrink = true,
}: {
  readonly initial: string;
  readonly onValueChange: (value: string) => void;
  readonly separators: AmountSeparators;
  /** Offers a button that changes the language's separators to these. */
  readonly switchTo?: AmountSeparators;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly shrink?: boolean;
}) => {
  const [value, setValue] = useState(initial);
  const [switched, setSwitched] = useState(false);
  return (
    <div style={{ display: "flex", width: 240 }}>
      <AmountInput
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
        separators={switched && switchTo ? switchTo : separators}
        label="Amount"
        invalid={invalid}
        disabled={disabled}
        shrink={shrink}
      />
      {switchTo && (
        <button
          type="button"
          // Keeps focus in the input, as a language change from elsewhere would.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setSwitched(true)}
        >
          Switch language
        </button>
      )}
    </div>
  );
};

const meta = {
  title: "Components/AmountInput",
  component: StatefulAmountInput,
  args: { initial: "", onValueChange: fn(), separators: english },
} satisfies Meta<typeof StatefulAmountInput>;
export default meta;

type Story = StoryObj<typeof meta>;

const amountInput = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole("textbox", { name: "Amount" });

export const Empty: Story = {};

/** Unfocused, the amount is grouped in the language's separators. */
export const Grouped: Story = {
  args: { initial: "1234567.89" },
  play: async ({ canvasElement }) => {
    await expect(amountInput(canvasElement)).toHaveValue("1,234,567.89");
  },
};

export const GroupedDark: Story = {
  args: { initial: "1234567.89" },
  globals: { colorScheme: "dark" },
};

export const Invalid: Story = {
  args: { initial: "250", invalid: true },
  play: async ({ canvasElement }) => {
    await expect(amountInput(canvasElement)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  },
};

/**
 * More digits than a JavaScript `number` holds round-trip exactly, both ways:
 * the amount that leaves is the text typed, digit for digit, and the text
 * rebuilt from that amount is the same digits again.
 */
export const ExactRoundTrip: Story = {
  play: async ({ args, canvasElement }) => {
    const typed = "123456789012345678901234567890.123456789012345678901234567";
    const input = amountInput(canvasElement);

    await userEvent.click(input);
    await userEvent.keyboard(typed);

    await expect(args.onValueChange).toHaveBeenLastCalledWith(typed);
    await expect(String(Number(typed))).not.toBe(typed);

    await userEvent.tab();
    await expect(input).not.toHaveFocus();
    await expect(input).toHaveValue(
      "123,456,789,012,345,678,901,234,567,890.123456789012345678901234567"
    );
    await userEvent.tab({ shift: true });
    await expect(input).toHaveFocus();
    await expect(input).toHaveValue(typed);
  },
};

/** An amount handed in with more than 17 digits shows exactly. */
export const ExactInitial: Story = {
  args: { initial: "98765432109876543210.0123456789" },
  play: async ({ canvasElement }) => {
    const input = amountInput(canvasElement);

    await expect(input).toHaveValue("98,765,432,109,876,543,210.0123456789");
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await expect(input).toHaveValue("98765432109876543210.0123456789");
  },
};

/**
 * Input follows the language's separators: a pasted grouped amount is read
 * out, other characters are refused, and the amount leaves as a plain decimal
 * string. Focused, the amount shows ungrouped; unfocused, grouped.
 */
export const LocaleSeparators: Story = {
  args: { separators: german },
  play: async ({ args, canvasElement }) => {
    const input = amountInput(canvasElement);

    await userEvent.click(input);
    await userEvent.paste("1.234,5");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("1234.5");

    await userEvent.keyboard("x");
    await expect(input).toHaveValue("1.234,5");
    await userEvent.paste("1.2");
    await expect(input).toHaveValue("1.234,5");

    await userEvent.tab();
    await expect(input).toHaveValue("1.234,5");
    await userEvent.tab({ shift: true });
    await expect(input).toHaveValue("1234,5");
  },
};

/** A language change while focused shows the amount in the new separators. */
export const SeparatorsChangeWhileFocused: Story = {
  args: { switchTo: german },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = amountInput(canvasElement);

    await userEvent.click(input);
    await userEvent.keyboard("1234.5");
    await userEvent.click(
      canvas.getByRole("button", { name: "Switch language" })
    );

    await expect(input).toHaveFocus();
    await expect(input).toHaveValue("1234,5");
    await userEvent.keyboard("6");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("1234.56");
  },
};

/** A space group separator accepts the spaces people paste for it. */
export const SpaceGroups: Story = {
  args: { separators: french },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(amountInput(canvasElement));
    await userEvent.paste("12 345,06");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("12345.06");
  },
};

/** Clearing the field reports no amount. */
export const Clear: Story = {
  args: { initial: "42" },
  play: async ({ args, canvasElement }) => {
    const input = amountInput(canvasElement);
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.keyboard("{Backspace}{Backspace}");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("");
  },
};

/** The type steps down as the amount fills the input. */
export const Shrinks: Story = {
  play: async ({ canvasElement }) => {
    const input = amountInput(canvasElement);
    const size = () => getComputedStyle(input).fontSize;

    await expect(size()).toBe("32px");
    await userEvent.click(input);
    await userEvent.keyboard("12345678901234");
    await waitFor(() => expect(size()).not.toBe("32px"));
    await userEvent.keyboard("567890123456");
    await waitFor(() => expect(size()).toBe("20px"));
  },
};

/** With shrinking off, the type holds at the `display` size. */
export const NoShrink: Story = {
  args: { shrink: false },
  play: async ({ canvasElement }) => {
    const input = amountInput(canvasElement);

    await userEvent.click(input);
    await userEvent.keyboard("12345678901234567890123456");
    await expect(getComputedStyle(input).fontSize).toBe("32px");
  },
};

/** A disabled input takes no typing. */
export const Disabled: Story = {
  args: { initial: "10", disabled: true },
  play: async ({ args, canvasElement }) => {
    const input = amountInput(canvasElement);
    await expect(input).toBeDisabled();
    await userEvent.type(input, "5", { pointerEventsCheck: 0 });
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
