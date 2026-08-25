import type { RichError } from "../../../services/errors/rich-error";

// A Rich Error Identity is a bare token such as an error class name, so a
// message containing whitespace is API prose meant for the user.
const isRichErrorIdentity = (message: string) => !/\s/.test(message);

// The API writes `reason` in English only, so it is presentable copy for an
// English Widget Instance and untranslated noise for any other language.
const englishReason = (error: RichError, language: string) =>
  language === "en" ? error.details?.reason : undefined;

const presentableMessage = (error: RichError) => {
  const { message } = error;
  return message === "" || isRichErrorIdentity(message) ? undefined : message;
};

export const richErrorDetail = ({
  error,
  language,
  errorCopyDetails,
}: {
  readonly error: RichError;
  readonly language: string;
  readonly errorCopyDetails?: string | undefined;
}): string | undefined => {
  const reason = englishReason(error, language);
  if (reason) return reason;

  return errorCopyDetails ?? presentableMessage(error);
};
