import { useSettings } from "@sk-widget/providers/settings";
import { useCallback } from "react";
import { type NavigateOptions, type To, useNavigate } from "react-router";

export const useNavigateWithScrollToTop = () => {
  const navigate = useNavigate();

  const { disableAutoScrollToTop } = useSettings();

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
