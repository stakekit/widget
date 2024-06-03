import { useEffect, useRef } from "react";

export const useFirstMountState = () => {
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
    }
  }, []);

  return isFirst.current;
};
