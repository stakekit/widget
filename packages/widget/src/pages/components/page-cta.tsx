import { Box } from "../../components/atoms/box";
import { Button } from "../../components/atoms/button";

export type PageCta = {
  disabled: boolean;
  hide?: boolean;
  isLoading: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
} | null;

export const PageCtaButton = ({ cta }: { cta: PageCta }) => {
  if (!cta || cta.hide) return null;

  return (
    <Box marginTop="auto">
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
        }}
      >
        {cta.label}
      </Button>
    </Box>
  );
};
