import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { tokenLogo } from "../storybook/images";
import { Illustration } from "./illustration";

const meta = {
  title: "Components/Illustration",
  component: Illustration,
  args: { src: tokenLogo },
} satisfies Meta<typeof Illustration>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Unlabelled, the picture is decorative: hidden from assistive technology. */
export const Decorative: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("img")).toBeNull();
  },
};

/** Each size draws a square at its width. */
export const Medium: Story = {
  args: { size: "md" },
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector("img");
    await expect(image?.getBoundingClientRect().width).toBe(240);
    await expect(image?.getBoundingClientRect().height).toBe(240);
  },
};

export const Large: Story = {
  args: { size: "lg" },
  play: async ({ canvasElement }) => {
    const image = canvasElement.querySelector("img");
    await expect(image?.getBoundingClientRect().width).toBe(320);
  },
};

/** A label names the picture when it carries information. */
export const Labelled: Story = {
  args: { label: "Powered by Yield.xyz" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Powered by Yield.xyz" })
    ).toBeInTheDocument();
  },
};
