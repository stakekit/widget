import { Box } from "../../components/atoms/box";
import { Button } from "../../components/atoms/button";
import { useSettings } from "../../providers/settings";

export type PageCta = {
  disabled: boolean;
  hide?: boolean;
  isLoading: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
} | null;

export const PageCtaButton = ({ cta }: { cta: PageCta }) => {
  const { dashboardVariant } = useSettings();

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
