import { useWidgetConfig } from "../../app/config";
import { Box } from "../../shared/ui/primitives/box";
import { Button } from "../../shared/ui/primitives/button";

export type PageCta = {
  disabled: boolean;
  hide?: boolean;
  isLoading: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
} | null;

export const PageCtaButton = ({ cta }: { cta: PageCta }) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  if (!cta || cta.hide) return null;

  return (
    <Box marginTop="auto" paddingTop={dashboardVariant ? undefined : "8"}>
      <Button
        data-rk={`footer-button-${cta.variant ?? "primary"}`}
        disabled={cta.disabled}
        isLoading={cta.isLoading}
        onClick={cta.onClick}
        variant={{
          color:
            cta.variant ??
            (cta.disabled || cta.isLoading ? "disabled" : "primary"),
          animation: "press",
          size: dashboardVariant ? "compact" : "regular",
        }}
      >
        {cta.label}
      </Button>
    </Box>
  );
};
