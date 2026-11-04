import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { brokenImage, networkLogo, tokenLogo } from "../storybook/images";
import { Avatar, TokenAvatar } from "./avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { label: "Lido" },
} satisfies Meta<typeof Avatar>;
export default meta;

type Story = StoryObj<typeof meta>;

const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

export const Image: Story = { args: { src: tokenLogo } };

/** Without an image, or when it fails, the label's initial shows. */
export const Fallback: Story = {
  args: { src: brokenImage },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole("img", { name: "Lido" });
    await expect(avatar).toHaveTextContent("L");
  },
};

export const FallbackDark: Story = {
  globals: { colorScheme: "dark" },
};

export const FallbackText: Story = {
  args: { label: "Ethereum", fallback: "ETH" },
};

export const Sizes: Story = {
  render: (args) => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </Stack>
  ),
};

/** A token's logo with its network badge. */
export const Token: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <TokenAvatar
          key={size}
          size={size}
          src={tokenLogo}
          name="ETH"
          networkSrc={networkLogo}
        />
      ))}
    </Stack>
  ),
};

export const TokenFallback: Story = {
  render: () => <TokenAvatar src={brokenImage} name="USDC" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "USDC" })
    ).toHaveTextContent("U");
  },
};

export const TokenDark: Story = {
  ...Token,
  globals: { colorScheme: "dark" },
};

/** An account's generated avatar: the same address always gets the same one. */
export const Account: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={8}>
      {sizes.map((size) => (
        <TokenAvatar
          key={size}
          size={size}
          account="0x9f8d3e2b7c1a4f6e5d0c8b7a6f5e4d3c2b1a0f9e"
          label="Your account"
        />
      ))}
    </Stack>
  ),
};

export const Accounts: Story = {
  render: () => (
    <Stack direction="row" gap={8} wrap>
      {Array.from({ length: 12 }, (_, index) => (
        <TokenAvatar key={index} account={`0x${index.toString(16)}`} />
      ))}
    </Stack>
  ),
};
