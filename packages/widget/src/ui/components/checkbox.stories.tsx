import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";
import { ExternalLink } from "./external-link";

const StatefulCheckbox = ({
  initial,
  onCheckedChange,
  disabled = false,
}: {
  readonly initial: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) => {
  const [checked, setChecked] = useState(initial);
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        onCheckedChange(next);
      }}
      label="I understand the risks"
      disabled={disabled}
    />
  );
};

const meta = {
  title: "Components/Checkbox",
  component: StatefulCheckbox,
  args: { initial: false, onCheckedChange: fn() },
} satisfies Meta<typeof StatefulCheckbox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { initial: true } };

export const CheckedDark: Story = {
  args: { initial: true },
  globals: { colorScheme: "dark" },
};

/** A label can carry a link, such as the terms to agree to. */
export const WithLink: Story = {
  render: () => (
    <Checkbox
      checked={false}
      onCheckedChange={() => {}}
      label={
        <>
          {"I agree to the "}
          <ExternalLink
            href="https://example.com"
            newTabLabel="opens in a new tab"
          >
            terms
          </ExternalLink>
        </>
      }
    />
  ),
};

/** Tab reaches the checkbox; Space toggles it and the role's state follows. */
export const KeyboardToggle: Story = {
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole("checkbox", {
      name: "I understand the risks",
    });

    await userEvent.tab();
    await expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(control).toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(
      within(canvasElement).getByText("I understand the risks")
    );
    await expect(control).not.toBeChecked();
  },
};

/** A disabled checkbox is announced as such and ignores input. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole("checkbox");

    await expect(control).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(control, { pointerEventsCheck: 0 });
    await expect(control).not.toBeChecked();
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
