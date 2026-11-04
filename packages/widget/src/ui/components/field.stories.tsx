import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { AmountInput } from "./amount-input";
import { Field } from "./field";
import { SearchInput } from "./search-input";

const AmountField = ({
  error,
  disabled = false,
}: {
  readonly error?: string;
  readonly disabled?: boolean;
}) => {
  const [value, setValue] = useState("1.5");
  return (
    <div style={{ width: 280 }}>
      <Field
        label="Amount to stake"
        description="Up to 12.4 ETH"
        {...(error === undefined ? {} : { error })}
        disabled={disabled}
      >
        {/* Invalid and disabled are set on the Field only: it passes them on. */}
        <AmountInput
          value={value}
          onValueChange={setValue}
          separators={{ decimal: ".", group: "," }}
        />
      </Field>
    </div>
  );
};

const meta = {
  title: "Components/Field",
  component: AmountField,
} satisfies Meta<typeof AmountField>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The label names the input and the description describes it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Amount to stake",
    });
    await expect(input).toHaveAccessibleDescription("Up to 12.4 ETH");
  },
};

export const DefaultDark: Story = { globals: { colorScheme: "dark" } };

/** An error replaces the description and marks the input invalid. */
export const WithError: Story = {
  args: { error: "More than your balance" },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: "Amount to stake",
    });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("More than your balance");
  },
};

/** A disabled field disables its input. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("textbox", { name: "Amount to stake" })
    ).toBeDisabled();
  },
};

/** Any input takes the field's label. */
export const Search: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Field label="Validator">
        <SearchInput value="" onValueChange={() => {}} clearLabel="Clear" />
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("searchbox", { name: "Validator" })
    ).toBeInTheDocument();
  },
};
