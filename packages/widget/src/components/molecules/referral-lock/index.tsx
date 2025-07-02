import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  useReferralCode,
  useValidateReferralCode,
} from "../../../hooks/api/referral/use-referral-code";
import { MaybeDocument } from "../../../utils/maybe-document";
import { Box } from "../../atoms/box";
import { Button } from "../../atoms/button";
import { Divider } from "../../atoms/divider";
import {
  SelectModal,
  SelectModalItemContainer,
} from "../../atoms/select-modal";
import { Text } from "../../atoms/typography";
import { input, inputContainer, inputsContainer } from "./style.css";

const pinSize = 6;

export const ReferralLock = () => {
  const referralCode = useReferralCode();

  const validateReferralCode = useValidateReferralCode();

  const [userEnteredCode, setUserEnteredCode] = useState(() =>
    Array.from<string>({ length: 6 }).fill("")
  );

  const { t } = useTranslation();

  const inputsRef = useRef(
    Array.from<HTMLInputElement | null>({ length: pinSize }).fill(null)
  );

  const isOpen =
    !referralCode.data && !referralCode.isLoading && referralCode.isError;

  const disabled = useMemo(
    () => validateReferralCode.isPending || userEnteredCode.some((c) => !c),
    [userEnteredCode, validateReferralCode.isPending]
  );

  const onSubmit = () => {
    if (disabled) return;

    validateReferralCode.mutate(userEnteredCode.join(""));
  };

  const onInputChange = (value: string, index: number) => {
    const newUserEnteredCode = [...userEnteredCode];

    newUserEnteredCode[index] = value;

    flushSync(() => {
      setUserEnteredCode(newUserEnteredCode);
    });

    if (!value) return;

    inputsRef.current[index + 1]?.focus();
  };

  const onInputFocus = (index: number) =>
    setUserEnteredCode((prev) => prev.map((val, i) => (i < index ? val : "")));

  const onKeyDown = (key: string, index: number) => {
    const lower = key.toLowerCase();

    if (
      (lower !== "backspace" && lower !== "delete") ||
      userEnteredCode[index]
    ) {
      return;
    }

    inputsRef.current[index - 1]?.focus();
  };

  const onPaste = (text: string) => {
    setUserEnteredCode(text.slice(0, pinSize).split(""));
    MaybeDocument.ifJust((d) => {
      const activeElement = d.activeElement;
      if (
        activeElement &&
        "blur" in activeElement &&
        typeof activeElement.blur === "function"
      ) {
        activeElement.blur();
      }
    });
  };

  return (
    <SelectModal state={{ isOpen, setOpen: () => {} }} disableClose>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Box marginBottom="4">
          <Text variant={{ size: "large" }}>{t("referral_lock.title")}</Text>
        </Box>

        <SelectModalItemContainer>
          <Box>
            <Text textAlign="center" variant={{ type: "muted" }}>
              {t("referral_lock.body")}
            </Text>
          </Box>

          <Box my="4">
            <Divider />
          </Box>

          <Box className={inputsContainer}>
            {Array.from({ length: pinSize }).map((_, i) => (
              <Box className={inputContainer} key={i}>
                <input
                  ref={(el) => {
                    if (!el) return;

                    inputsRef.current[i] = el;
                  }}
                  // biome-ignore lint: false
                  autoFocus={i === 0}
                  value={userEnteredCode[i]}
                  onPaste={(e) => onPaste(e.clipboardData.getData("text"))}
                  onFocus={() => onInputFocus(i)}
                  onChange={(e) => onInputChange(e.target.value, i)}
                  onKeyDown={(e) => onKeyDown(e.key, i)}
                  className={input}
                  type="text"
                  maxLength={1}
                  disabled={i > 0 && !userEnteredCode[i - 1]}
                />
              </Box>
            ))}
          </Box>

          <Box marginTop="4">
            <Button
              variant={{ color: disabled ? "disabled" : "primary" }}
              disabled={disabled}
              onClick={onSubmit}
              isLoading={validateReferralCode.isPending}
            >
              {t("referral_lock.submit")}
            </Button>
          </Box>
        </SelectModalItemContainer>
      </Box>
    </SelectModal>
  );
};
