export const CONFIG = {
  clientId: "c02d3813-d4b9-40a1-9db9-09e34cb9c2e1",
  tenantId: "f098c632-5a55-45ba-9bf4-c13870157cf1",
  policy: "B2C_1A_signup_signin",
  policyLower: "b2c_1a_signup_signin",
  authorityHost: "login.post.at",
  sendungenScope: "https://login.post.at/sendungenapi-prod/Sendungen.All",
  redirectUriInteractive: "https://www.post.at/signin-oidc",
  redirectUriToken: "https://www.post.at",
  graphqlAuthenticated: "https://api.post.at/sendungen/sv/graphqlAuthenticated",
  sitecoreGraphqlEndpoint: "https://api.www.post.at/postat/xp-v10/sitecore/api/graphql/master",
  sitecoreApiKey: "{F6982A9B-F4EC-4663-9F6B-D51284D4F322}",
  sitecoreLang: "de-AT",
  sendungsumleitungenPath:
    "/sitecore/content/PostAG/PostAT/Einstellungen/App Konfigurationen/Sending Settings/Sendungsumleitungen"
} as const;

export const ENV = {
  username: "POST_AT_USERNAME",
  password: "POST_AT_PASSWORD"
} as const;
