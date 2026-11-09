import { RegistryProvider } from "@effect/atom-react";
import { act, type ComponentProps } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { KycGateCard } from "../../../src/features/yield-summary/ui/components/kyc-gate-card";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const i18n = createWidgetI18nInstance();

const renderCard = (props: ComponentProps<typeof KycGateCard>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <RegistryProvider initialValues={[applicationRuntimeInitInitialValue()]}>
        <KycGateCard {...props} />
      </RegistryProvider>
    </I18nextProvider>
  );

const byTestId = (testId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

describe("KYC gate card", () => {
  it("opens iframe modal for iframe-allowed verification and refreshes status on close", async () => {
    const onCheckStatus = vi.fn();
    await renderCard({
      gate: {
        state: "start_kyc",
        kycUrl: "https://issuer.example/verify",
        iframeAllowed: true,
      },
      onCheckStatus,
      providerName: "Superstate",
    });

    expect(byTestId("kyc-gate-card-start_kyc")).not.toBeNull();

    await act(async () => byTestId("kyc-gate-verify")?.click());

    await vi.waitFor(() =>
      expect(byTestId("kyc-verification-modal")).not.toBeNull()
    );
    expect(byTestId("kyc-verification-iframe")?.getAttribute("src")).toBe(
      "https://issuer.example/verify"
    );

    await act(async () => byTestId("kyc-verification-close")?.click());

    expect(onCheckStatus).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(
        document.querySelectorAll('[data-testid^="kyc-gate-card"]')
      ).toHaveLength(1)
    );
  });

  it.each([
    {
      gate: { state: "rejected", kycUrl: "https://issuer.example/verify" },
      text: "Verification not approved",
    },
    {
      gate: { state: "unknown", retryable: true },
      text: "Verification status unavailable",
    },
  ] as const)("shows the $gate.state state", async ({ gate, text }) => {
    await renderCard({ gate, providerName: "Superstate" });

    const card = byTestId(`kyc-gate-card-${gate.state}`);
    expect(card?.textContent).toContain(text);
  });
});
