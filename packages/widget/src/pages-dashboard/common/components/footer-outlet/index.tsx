import { Box } from "../../../../components/atoms/box";
import { Button } from "../../../../components/atoms/button";
import { useIsomorphicEffect } from "../../../../hooks/use-isomorphic-effect";
import {
  type FooterButtonVal,
  useFooterButton,
  useFooterHeight,
  useSyncFooterHeight,
} from "../../../../pages/components/footer-outlet/context";

const FooterButton = ({
  disabled,
  isLoading,
  onClick,
  label,
  variant,
}: NonNullable<FooterButtonVal>) => {
  return (
    <Box
      flex={1}
      display="flex"
      justifyContent="flex-end"
      flexDirection="column"
    >
      <Button
        data-rk={`footer-button-${variant ?? "primary"}`}
        disabled={disabled}
        isLoading={isLoading}
        onClick={onClick}
        variant={{
          color: variant ?? (disabled || isLoading ? "disabled" : "primary"),
          animation: "press",
        }}
      >
        {label}
      </Button>
    </Box>
  );
};

export const FooterOutlet = () => {
  const [val] = useFooterButton();

  const [, setFooterHeight] = useFooterHeight();

  const { containerRef } = useSyncFooterHeight();

  useIsomorphicEffect(() => {
    !val && setFooterHeight(0);
  }, [setFooterHeight, val]);

  if (!val) return null;

  return (
    <Box ref={containerRef}>
      <FooterButton {...val} />
    </Box>
  );
};
