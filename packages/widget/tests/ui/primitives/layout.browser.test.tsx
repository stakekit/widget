import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Box, Grid, Stack } from "../../../src/ui/index";
import { render } from "../../utils/test-utils";

// A size container, as the Widget root and each SplitView pane are.
const Frame = ({
  width,
  children,
}: {
  readonly width: number;
  readonly children: ReactNode;
}) => <div style={{ containerType: "inline-size", width }}>{children}</div>;

const columnCount = (element: Element) =>
  getComputedStyle(element).gridTemplateColumns.split(" ").length;

const cells = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <span key={index}>{`Cell ${index + 1}`}</span>
  ));

describe("Grid", () => {
  it.each([
    { width: 380, columns: 1 },
    { width: 600, columns: 1 },
    { width: 1000, columns: 2 },
  ])(
    "takes $columns column(s) in a $width px container from { base: 1, split: 2 }",
    async ({ width, columns }) => {
      const screen = await render(
        <Frame width={width}>
          <Grid columns={{ base: 1, split: 2 }} testId="grid">
            {cells(2)}
          </Grid>
        </Frame>
      );

      expect(columnCount(screen.getByTestId("grid").element())).toBe(columns);
    }
  );

  it("keeps a nested grid's own columns at every container size", async () => {
    const screen = await render(
      <Frame width={1000}>
        <Grid columns={{ base: 1, split: 2 }}>
          <Grid columns={3} testId="plain">
            {cells(3)}
          </Grid>
          <Grid columns={{ base: 4 }} testId="responsive">
            {cells(4)}
          </Grid>
        </Grid>
      </Frame>
    );

    expect(columnCount(screen.getByTestId("plain").element())).toBe(3);
    expect(columnCount(screen.getByTestId("responsive").element())).toBe(4);
  });
});

describe("Stack", () => {
  it("applies its own values, not its parent's, when nested", async () => {
    const screen = await render(
      <>
        <Stack direction="row" gap={16} align="center" justify="between">
          <Stack testId="nested">{cells(2)}</Stack>
        </Stack>
        <div
          data-testid="reference"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            alignItems: "stretch",
            justifyContent: "flex-start",
          }}
        />
      </>
    );
    const layout = (testId: string) => {
      const style = getComputedStyle(screen.getByTestId(testId).element());
      return {
        flexDirection: style.flexDirection,
        gap: style.rowGap,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
      };
    };

    expect(layout("nested")).toEqual(layout("reference"));
  });

  it("takes a single value per layout prop", () => {
    // @ts-expect-error Only a Grid's columns vary with the container's width.
    const responsive = <Stack direction={{ base: "column", md: "row" }} />;
    expect(responsive).toBeDefined();
  });
});

describe("Box", () => {
  it("lets an axis's padding win over padding", async () => {
    const screen = await render(
      <Box padding={8} paddingInline={24} testId="box">
        {cells(1)}
      </Box>
    );
    const style = getComputedStyle(screen.getByTestId("box").element());

    expect([style.paddingTop, style.paddingLeft]).toEqual(["8px", "24px"]);
  });
});
