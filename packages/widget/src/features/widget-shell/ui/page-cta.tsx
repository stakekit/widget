import { Box } from "../../../shared/ui/primitives/box";
import { Button } from "../../../shared/ui/primitives/button";
import { pageCta } from "./layout.css";

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
    <Box marginTop="auto" className={pageCta}>
      <Button
        data-rk={`footer-button-${cta.variant ?? "primary"}`}
        disabled={cta.disabled || cta.isLoading}
        isLoading={cta.isLoading}
        onClick={cta.onClick}
        variant={{
          color:
            cta.variant ??
            (cta.disabled || cta.isLoading ? "disabled" : "primary"),
          animation: "press",
          size: "layout",
        }}
      >
        {cta.label}
      </Button>
    </Box>
  );
};
