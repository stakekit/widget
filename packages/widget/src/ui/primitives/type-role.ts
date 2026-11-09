/** Type roles that title something; they must name their element. */
export type HeadingRole = "display" | "title" | "heading";
export type BodyRole = "metric" | "body" | "label" | "caption" | "overline";
/** A type role: size, line height and weight together. */
export type TypeRole = HeadingRole | BodyRole;
