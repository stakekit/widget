import { useCallback } from "react";
import { type NavigateOptions, type To, useNavigate } from "react-router";
import { useSettings } from "../../providers/settings";

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
