import type { RichError } from "../../../services/errors/rich-error";

// A Rich Error Identity is a bare token such as an error class name, so a
// message containing whitespace is server prose meant for the user.
const isIdentity = (message: string) => !/\s/.test(message);

export const unknownErrorDetail = (error: RichError): string | undefined => {
  const reason = error.details?.reason?.trim();
  if (reason) return reason;

  const message = error.message.trim();
  return message === "" || isIdentity(message) ? undefined : message;
};
