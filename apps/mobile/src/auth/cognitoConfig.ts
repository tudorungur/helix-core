// Real dev Cognito User Pool (infra/environments/dev, applied 2026-07-15 — see SPEC.md §2/§8).
// Public app client, no secret (SRP auth) — safe to embed in the app bundle.
export const cognitoConfig = {
  region: "eu-west-1",
  userPoolId: "eu-west-1_sFk0nAlGn",
  userPoolClientId: "5ekp6ft982jsi8l08s1spfkbnf",
};
