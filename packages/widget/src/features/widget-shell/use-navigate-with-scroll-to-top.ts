import { useCallback } from "react";
import { type NavigateOptions, type To, useNavigate } from "react-router";
import { useWidgetConfig } from "../../app/config";

export const useNavigateWithScrollToTop = () => {
  const navigate = useNavigate();

  const disableAutoScrollToTop = useWidgetConfig("disableAutoScrollToTop");

  return useCallback<(to: To, options?: NavigateOptions) => void>(
    (to, options) => {
      if (!disableAutoScrollToTop) {
        window.scrollTo(0, 0);
      }
      return navigate(to, options);
    },
    [navigate, disableAutoScrollToTop]
  );
};
