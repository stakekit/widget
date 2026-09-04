import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { LoadingSkeleton } from "../../src/shared/ui/components/loading-skeleton";

it("reserves space while route state is loading", async () => {
  const app = await render(
    <div style={{ width: 360 }}>
      <LoadingSkeleton />
    </div>
  );
  const loading = app.container.querySelector('[aria-busy="true"]');
  const skeleton = app.container.querySelector(".react-loading-skeleton");

  expect(loading).not.toBeNull();
  expect(skeleton).not.toBeNull();
  expect(loading!.getBoundingClientRect().height).toBeGreaterThanOrEqual(320);
  expect(skeleton!.getBoundingClientRect().height).toBe(320);
  expect(skeleton!.getBoundingClientRect().width).toBe(360);
});
