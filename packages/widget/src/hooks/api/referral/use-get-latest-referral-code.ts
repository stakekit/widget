import { useEffect } from "react";
import { setStorageItem } from "../../../services/local-storage";
import { useInitQueryParams } from "../../use-init-query-params";
import { useLocalStorageValue } from "../../use-local-storage-value";

/**
 * Get the referral code from the query params or fallback to local storage
 */
export const useGetLatestReferralCode = () => {
  const initQueryParams = useInitQueryParams();

  const localStorageReferralCode = useLocalStorageValue(
    "sk-widget@1//referralCode"
  );

  /**
   * Sync the latest referral code to local storage
   */
  useEffect(() => {
    if (!initQueryParams.data?.referralCode) return;

    setStorageItem(
      "sk-widget@1//referralCode",
      initQueryParams.data.referralCode
    );
  }, [initQueryParams.data?.referralCode]);

  return useInitQueryParams({
    select: (val) => val.referralCode ?? localStorageReferralCode,
  });
};
