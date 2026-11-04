# Amounts carry the token of their source field

Every amount the widget shows is labelled with the token of the API field it
came from, the same way for every yield: a position balance's value in its
Value Token, its Shares beside it only when the two tokens differ, and an exit
in its Exit Unit. No yield kind overrides this rule.

The Value Token is the token the API prices a balance in, so the shown token
always agrees with the USD value next to it, and every screen showing the same
balance shows the same token. A yield whose shares users think of first, such
as vault shares or a wrapped token, still reads in its Value Token, with those
as its Shares.

## Considered Options

- **Per-yield display overrides** (a yield kind choosing the token its value is
  shown in). Rejected: overrides let screens disagree about the same balance,
  and they label a value with a token the API does not price.
- **A separate display-denomination field from the API.** Rejected: the API
  keeps `token` as the pricing asset for every yield, and another field would
  only move the overrides to the server.
