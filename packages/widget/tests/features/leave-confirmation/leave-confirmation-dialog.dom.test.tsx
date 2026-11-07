import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { LeaveConfirmationDialog } from "../../../src/features/leave-confirmation/views";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";

const i18n = createWidgetI18nInstance();

const renderDialog = (resumable: boolean) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LeaveConfirmationDialog
        open
        resumable={resumable}
        onLeave={() => {}}
        onStay={() => {}}
      />
    </I18nextProvider>
  );

describe("Leave Confirmation dialog", () => {
  it("says an action that continues from Activity can be finished later", async () => {
    await renderDialog(true);

    const text = document.body.textContent;
    expect(text).toContain(
      "If you leave now, you can finish the remaining steps later from Activity."
    );
    expect(text).not.toContain("start again");
  });

  it("never tells the user to start again", async () => {
    await renderDialog(false);

    const text = document.body.textContent;
    expect(text).toContain(
      "If you leave now, its remaining steps won't be completed."
    );
    expect(text).not.toContain("start again");
    expect(text).not.toContain("Activity");
  });
});
