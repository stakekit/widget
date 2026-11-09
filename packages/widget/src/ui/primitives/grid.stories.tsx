import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Card } from "../components/card";
import { ContainerFrame, narrowAndWide } from "../storybook/container-frame";
import { Grid } from "./grid";
import { Stack } from "./stack";
import { Text } from "./text";

const cells = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <Card key={index} padding={12}>
      <Text>{`Cell ${index + 1}`}</Text>
    </Card>
  ));

const meta = {
  title: "Primitives/Grid",
  component: Grid,
  args: { gap: 8, children: cells(4) },
} satisfies Meta<typeof Grid>;
export default meta;

type Story = StoryObj<typeof meta>;

/** One to four equal columns. */
export const Columns: Story = {
  render: (args) => (
    <Stack gap={24}>
      {([1, 2, 3, 4] as const).map((columns) => (
        <Grid key={columns} {...args} columns={columns} />
      ))}
    </Stack>
  ),
};

/** As many metric columns as the width allows. */
export const Metrics: Story = {
  args: { columns: "metrics", children: cells(5) },
};

/** The split view's aside and main pane. */
export const Split: Story = { args: { columns: "split", children: cells(2) } };

/**
 * A centre cell at its content's width between two equal flanks: the centre
 * stays centred in the grid however wide one flank's content is.
 */
export const Flanked: Story = {
  args: {
    columns: "flanked",
    align: "center",
    children: [
      <span key="start" />,
      <Card key="centre" padding={12}>
        <Text>Centre</Text>
      </Card>,
      <Card key="end" padding={12}>
        <Text>A wide end cell</Text>
      </Card>,
    ],
  },
  render: (args) => (
    <ContainerFrame width={480}>
      <Grid {...args} />
    </ContainerFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const centre = canvas.getByText("Centre").getBoundingClientRect();
    const grid = canvas
      .getByText("Centre")
      .closest('[style*="container-type"]')
      ?.getBoundingClientRect();

    await expect(grid?.width).toBe(480);
    await expect(
      Math.abs(centre.left + centre.width / 2 - ((grid?.left ?? 0) + 240))
    ).toBeLessThanOrEqual(1);
  },
};

/** One column below the `md` container size, two from it up. */
export const Responsive: Story = {
  args: {
    columns: { base: 1, md: 2 },
    role: "group",
    "aria-label": "Cells",
  },
  render: (args) => (
    <Grid gap={16}>
      <ContainerFrame width={380}>
        <Grid {...args} />
      </ContainerFrame>
      <ContainerFrame width={600}>
        <Grid {...args} />
      </ContainerFrame>
    </Grid>
  ),
  play: async ({ canvasElement }) => {
    const [narrow, wide] = narrowAndWide(
      within(canvasElement).getAllByRole("group", { name: "Cells" })
    );
    const columnCount = (element: HTMLElement) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length;
    await expect(columnCount(narrow)).toBe(1);
    await expect(columnCount(wide)).toBe(2);
  },
};
