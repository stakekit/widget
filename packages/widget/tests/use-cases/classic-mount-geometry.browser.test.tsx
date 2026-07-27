import { MotionGlobalConfig } from "motion/react";
import { delay, HttpResponse, http } from "msw";
import { afterEach } from "vitest";
import { yieldApiYieldDtoFixture } from "../fixtures";
import { yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

const liveTokenSymbol = "READY";
const animationDeadlineMs = 4_000;

const nextAnimationFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe("classic mount geometry", () => {
  for (const variant of ["default", "zerion"] as const) {
    it(`keeps the ${variant} skeleton target stable while data resolves`, async ({
      worker,
    }) => {
      MotionGlobalConfig.skipAnimations = false;

      const baseYield = yieldApiYieldDtoFixture();
      const readyYield = yieldApiYieldDtoFixture({
        outputToken: {
          ...baseYield.token,
          name: "Mount-ready token",
          symbol: liveTokenSymbol,
        },
      });
      let yieldResponseSent = false;
      let mountAnimationComplete = false;
      let decodedDataWasHiddenBeforeCompletion = false;

      worker.use(
        http.get(yieldApiRoute("/v1/yields"), async () => {
          await delay(100);
          yieldResponseSent = true;

          return HttpResponse.json({
            items: [readyYield],
            total: 1,
            limit: 20,
            offset: 0,
          });
        }),
        http.get(yieldApiRoute(`/v1/yields/${readyYield.id}`), () =>
          HttpResponse.json(readyYield)
        )
      );

      const variantProps =
        variant === "zerion"
          ? {
              chainModal: () => null,
              language: "fr" as const,
              variant,
            }
          : { variant };
      const app = await renderApp({
        skProps: {
          ...variantProps,
          apiKey: import.meta.env.VITE_API_KEY,
          disableInitLayoutAnimation: false,
          onMountAnimationComplete: () => {
            mountAnimationComplete = true;
          },
        },
      });
      const widgetContainer = app.container.querySelector<HTMLElement>(
        "[data-rk='widget-container']"
      );
      const skeleton = app.container.querySelector<HTMLElement>(
        "[data-rk='earn-mount-skeleton']"
      );
      const livePresentation = app.container.querySelector<HTMLElement>(
        "[data-rk='earn-live-presentation']"
      );

      expect(widgetContainer).not.toBeNull();
      expect(skeleton).not.toBeNull();
      expect(livePresentation).not.toBeNull();
      expect(livePresentation?.hasAttribute("inert")).toBe(true);
      expect(getComputedStyle(livePresentation as HTMLElement).visibility).toBe(
        "hidden"
      );

      const startedAt = performance.now();
      const containerHeights = [
        widgetContainer?.getBoundingClientRect().height ?? 0,
      ];
      const skeletonHeights = [skeleton?.getBoundingClientRect().height ?? 0];
      let responseArrivedBeforeCompletion = false;

      while (
        !mountAnimationComplete &&
        performance.now() - startedAt < animationDeadlineMs
      ) {
        await nextAnimationFrame();

        containerHeights.push(
          widgetContainer?.getBoundingClientRect().height ?? 0
        );
        const currentSkeleton = app.container.querySelector<HTMLElement>(
          "[data-rk='earn-mount-skeleton']"
        );
        if (currentSkeleton) {
          skeletonHeights.push(currentSkeleton.getBoundingClientRect().height);
        }

        if (yieldResponseSent && !mountAnimationComplete) {
          responseArrivedBeforeCompletion = true;
        }

        if (
          livePresentation?.textContent?.includes(liveTokenSymbol) &&
          !mountAnimationComplete
        ) {
          decodedDataWasHiddenBeforeCompletion =
            livePresentation.hasAttribute("inert") &&
            getComputedStyle(livePresentation).visibility === "hidden";
        }
      }

      expect(mountAnimationComplete).toBe(true);
      expect(responseArrivedBeforeCompletion).toBe(true);
      expect(decodedDataWasHiddenBeforeCompletion).toBe(true);
      expect(containerHeights[0]).toBeLessThan(2);
      expect(Math.max(...containerHeights)).toBeGreaterThan(300);
      expect(
        containerHeights.every(
          (height, index) =>
            index === 0 || height + 1 >= (containerHeights[index - 1] ?? 0)
        )
      ).toBe(true);
      expect(
        Math.max(...skeletonHeights) - Math.min(...skeletonHeights)
      ).toBeLessThan(1);

      await expect
        .element(
          app.getByTestId("select-opportunity").getByText(liveTokenSymbol)
        )
        .toBeVisible();
      expect(livePresentation?.hasAttribute("inert")).toBe(false);
      expect(getComputedStyle(livePresentation as HTMLElement).visibility).toBe(
        "visible"
      );

      app.unmount();
    });
  }
});
