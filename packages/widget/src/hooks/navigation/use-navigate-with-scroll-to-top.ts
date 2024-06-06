import { useCallback } from "react";
import { type NavigateOptions, type To, useNavigate } from "react-router-dom";

export const useNavigateWithScrollToTop = () => {
  const navigate = useNavigate();

  return useCallback<(to: To, options?: NavigateOptions) => void>(
    (to, options) => {
      window.scrollTo(0, 0);
      return navigate(to, options);
    },
    [navigate]
  );
};
