import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { StandIn } from "./stand-in";

/** A page whose content shows once "Settle" is pressed. */
const Page = ({ initialShow }: { readonly initialShow: boolean }) => {
  const [show, setShow] = useState(initialShow);
  return (
    <Stack gap={16}>
      <Button variant="secondary" onClick={() => setShow(false)}>
        Settle
      </Button>
      <StandIn
        show={show}
        standIn={<Skeleton shape="rect" height="lg" />}
        testIds={{ standIn: "stand-in", content: "content" }}
      >
        <Card>
          <Text variant="heading" as="h2">
            Earn
          </Text>
          <Button variant="primary">Stake</Button>
        </Card>
      </StandIn>
    </Stack>
  );
};

const meta = {
  title: "Patterns/StandIn",
  component: Page,
  args: { initialShow: true },
} satisfies Meta<typeof Page>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The content renders hidden and inert under the stand-in, then shows. */
export const Settling: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("stand-in")).toBeInTheDocument();
    await expect(canvas.queryByRole("heading", { name: "Earn" })).toBeNull();
    await expect(canvas.getByTestId("content")).toHaveAttribute("inert");

    await userEvent.click(canvas.getByRole("button", { name: "Settle" }));

    await expect(canvas.queryByTestId("stand-in")).toBeNull();
    await expect(canvas.getByRole("heading", { name: "Earn" })).toBeVisible();
    await expect(canvas.getByTestId("content")).not.toHaveAttribute("inert");
  },
};

export const Settled: Story = {
  args: { initialShow: false },
  globals: { colorScheme: "dark" },
};
