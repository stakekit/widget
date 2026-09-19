import { assignInlineVars } from "@vanilla-extract/dynamic";
import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { vars } from "../../src/shared/styles/theme/contract.css";
import { lightTheme } from "../../src/shared/styles/theme/themes";
import { AmountTokenSection } from "../../src/shared/ui/components/amount-token-section";
import { DetailRow } from "../../src/shared/ui/components/details-section";
import { PositionMetricCards } from "../../src/shared/ui/components/position-details";
import {
  ContentLoaderCircle,
  ContentLoaderLine,
  ContentLoaderSquare,
} from "../../src/shared/ui/primitives/content-loader";
import { CaretDownIcon } from "../../src/shared/ui/primitives/icons/caret-down";

it("follows the surrounding typography when the host changes text size", async () => {
  const app = await render(
    <div style={{ width: 240, fontSize: 16 }}>
      <ContentLoaderLine />
    </div>
  );
  const skeleton = app.container.querySelector(".react-loading-skeleton")!;

  expect(skeleton.getBoundingClientRect().height).toBe(16);
  expect(skeleton.getBoundingClientRect().width).toBe(240);

  await app.rerender(
    <div style={{ width: 180, fontSize: 24 }}>
      <ContentLoaderLine />
    </div>
  );

  expect(skeleton.getBoundingClientRect().height).toBe(24);
  expect(skeleton.getBoundingClientRect().width).toBe(180);
});

it("fills panel and avatar slots without adding a text line below them", async () => {
  const app = await render(
    <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
      <div style={{ width: 240, height: 80 }}>
        <ContentLoaderSquare />
      </div>
      <div style={{ width: 40, height: 40 }}>
        <ContentLoaderCircle />
      </div>
    </div>
  );
  const [panel, avatar] = app.container.querySelectorAll(
    ".react-loading-skeleton"
  );

  expect(panel!.getBoundingClientRect().width).toBe(240);
  expect(panel!.getBoundingClientRect().height).toBe(80);
  expect(avatar!.getBoundingClientRect().width).toBe(40);
  expect(avatar!.getBoundingClientRect().height).toBe(40);
  expect(panel!.parentElement!.getBoundingClientRect().height).toBe(80);

  await app.rerender(
    <div style={{ display: "flex", alignItems: "start", gap: 16 }}>
      <div style={{ width: 180, height: 120 }}>
        <ContentLoaderSquare />
      </div>
      <div style={{ width: 56, height: 56 }}>
        <ContentLoaderCircle />
      </div>
    </div>
  );

  expect(panel!.getBoundingClientRect().width).toBe(180);
  expect(panel!.getBoundingClientRect().height).toBe(120);
  expect(avatar!.getBoundingClientRect().width).toBe(56);
  expect(avatar!.getBoundingClientRect().height).toBe(56);
});

it("keeps known metric and detail row geometry when values arrive", async () => {
  const theme = assignInlineVars(vars, {
    ...lightTheme,
    font: { body: "Georgia, serif" },
    fontSize: { ...lightTheme.fontSize, md: "20px", lg: "24px" },
  });
  const Presentation = ({ loading }: { loading: boolean }) => (
    <div data-rk="stakekit" style={{ ...theme, width: 400 }}>
      <div data-testid="metric">
        <PositionMetricCards
          cards={[
            {
              id: "debt",
              label: "Debt",
              loading,
              value: loading ? null : "$100",
            },
          ]}
        />
      </div>
      <div data-testid="detail">
        <DetailRow
          label="Network"
          loading={loading}
          value={loading ? null : "Ethereum"}
        />
      </div>
    </div>
  );
  const app = await render(<Presentation loading />);
  const metric = app.getByTestId("metric").element();
  const detail = app.getByTestId("detail").element();
  const metricHeight = metric.getBoundingClientRect().height;
  const detailHeight = detail.getBoundingClientRect().height;

  await expect.element(app.getByText("Debt")).toBeVisible();
  await expect.element(app.getByText("Network")).toBeVisible();

  await app.rerender(<Presentation loading={false} />);

  await expect.element(app.getByText("$100")).toBeVisible();
  await expect.element(app.getByText("Ethereum")).toBeVisible();
  expect(metric.getBoundingClientRect().height).toBeCloseTo(metricHeight, 0);
  expect(detail.getBoundingClientRect().height).toBeCloseTo(detailHeight, 0);
});
it("renders single loaders for amount, carets, and right balance section", async () => {
  const theme = assignInlineVars(vars, lightTheme);
  const app = await render(
    <div data-rk="stakekit" style={{ ...theme, width: 400 }}>
      <AmountTokenSection loading accessory={<CaretDownIcon loading />} />
    </div>
  );

  // Amount input does not show "0", renders a skeleton loader line instead
  expect(app.container.textContent).not.toContain("0");
  expect(app.container.querySelector('input[name="stake-amount"]')).toBeNull();

  // Caret renders a 12x12 skeleton loader
  const caretSkeleton = app.container.querySelector(
    '[style*="width: 12px"] .react-loading-skeleton'
  );
  expect(caretSkeleton).not.toBeNull();
  expect(caretSkeleton!.getBoundingClientRect().width).toBe(12);
  expect(caretSkeleton!.getBoundingClientRect().height).toBe(12);

  // Balance row contains price loader on the left and a single loader line on the right (no Max button)
  const balanceRow = app.container.querySelector(
    '[data-rk="stake-token-section-balance"]'
  )!;
  expect(balanceRow).not.toBeNull();
  const rightSection = balanceRow.children[1]!;
  expect(rightSection.querySelectorAll(".react-loading-skeleton")).toHaveLength(
    1
  );
  expect(
    balanceRow.querySelector('[data-rk="stake-token-section-max-button"]')
  ).toBeNull();
});
