import crypto from "node:crypto";
import { fetch as undiciFetch } from "undici";
import type { Response } from "undici";
import fetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { CONFIG } from "./config.js";

interface LoginSettings {
  api: string;
  csrf: string;
  transId: string;
  hosts: {
    tenant: string;
    policy: string;
    static: string;
  };
}

export interface LoginResult {
  accessToken: string;
  expiresAt: number;
  obtainedAt: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function randomString(): string {
  return crypto.randomBytes(16).toString("hex");
}

function buildAuthorizeUrlInteractive(username?: string): string {
  const url = new URL(
    `https://${CONFIG.authorityHost}/${CONFIG.tenantId}/${CONFIG.policyLower}/oauth2/v2.0/authorize`
  );
  url.searchParams.set("client_id", CONFIG.clientId);
  url.searchParams.set("redirect_uri", CONFIG.redirectUriInteractive);
  url.searchParams.set("response_type", "code id_token");
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("nonce", randomString());
  url.searchParams.set("state", randomString());
  url.searchParams.set("lang", "de");
  url.searchParams.set("x-client-SKU", "ID_NET461");
  url.searchParams.set("x-client-ver", "5.7.0.0");
  if (username) {
    url.searchParams.set("login_hint", username);
  }
  return url.toString();
}

function buildAuthorizeUrlToken(username?: string): string {
  const url = new URL(
    `https://${CONFIG.authorityHost}/${CONFIG.tenantId}/${CONFIG.policyLower}/oauth2/v2.0/authorize`
  );
  url.searchParams.set("response_type", "id_token token");
  url.searchParams.set("scope", `${CONFIG.sendungenScope} openid profile`);
  url.searchParams.set("client_id", CONFIG.clientId);
  url.searchParams.set("redirect_uri", CONFIG.redirectUriToken);
  url.searchParams.set("state", randomString());
  url.searchParams.set("nonce", randomString());
  url.searchParams.set("client_info", "1");
  url.searchParams.set("x-client-SKU", "MSAL.JS");
  url.searchParams.set("x-client-Ver", "1.4.17");
  url.searchParams.set("prompt", "none");
  url.searchParams.set("response_mode", "fragment");
  if (username) {
    url.searchParams.set("login_hint", username);
  }
  return url.toString();
}

function parseSettings(html: string): LoginSettings {
  const match = html.match(/var\s+SETTINGS\s*=\s*(\{[\s\S]*?\});/);
  if (!match) {
    throw new Error("Unable to find SETTINGS block in login page.");
  }
  const settings = JSON.parse(match[1]) as LoginSettings;
  if (!settings?.csrf || !settings?.transId || !settings?.hosts?.policy) {
    throw new Error("Login page SETTINGS missing expected fields.");
  }
  return settings;
}

function parseFragment(fragment: string): Record<string, string> {
  const params = new URLSearchParams(fragment);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

async function extractTokenFromResponse(res: Response): Promise<LoginResult> {
  const location = res.headers.get("location") || "";
  let fragment = "";
  if (location.includes("#")) {
    fragment = location.split("#")[1] ?? "";
  }

  if (!fragment) {
    const body = await res.text();
    const match = body.match(/#access_token=([^&"']+)/);
    if (match) {
      fragment = body.slice(body.indexOf("#") + 1);
    } else {
      throw new Error("Unable to extract access token from response.");
    }
  }

  const params = parseFragment(fragment);
  if (!params.access_token || !params.expires_in) {
    throw new Error("Access token missing in response.");
  }

  const obtainedAt = Date.now();
  const expiresIn = Number(params.expires_in) * 1000;
  return {
    accessToken: params.access_token,
    obtainedAt,
    expiresAt: obtainedAt + expiresIn
  };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const jar = new CookieJar();
  const fetch = fetchCookie(undiciFetch, jar);

  const loginPageUrl = buildAuthorizeUrlInteractive(username);
  const loginPageRes = await fetch(loginPageUrl, {
    headers: { "user-agent": USER_AGENT }
  });
  if (!loginPageRes.ok) {
    throw new Error(`Login page request failed (${loginPageRes.status}).`);
  }
  const loginPageHtml = await loginPageRes.text();
  const settings = parseSettings(loginPageHtml);

  const tenantPath = settings.hosts?.tenant || `/${CONFIG.tenantId}/${CONFIG.policy}`;
  const policy = settings.hosts?.policy || CONFIG.policy;

  const selfAssertedUrl = new URL(
    `https://${CONFIG.authorityHost}${tenantPath}/SelfAsserted`
  );
  selfAssertedUrl.searchParams.set("tx", settings.transId);
  selfAssertedUrl.searchParams.set("p", policy);

  const form = new URLSearchParams({
    request_type: "RESPONSE",
    signInName: username,
    password
  });

  const selfAssertedRes = await fetch(selfAssertedUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-GB,en;q=0.9",
      "user-agent": USER_AGENT,
      "x-requested-with": "XMLHttpRequest",
      "x-csrf-token": settings.csrf,
      origin: `https://${CONFIG.authorityHost}`,
      referer: loginPageUrl
    },
    body: form.toString()
  });
  if (!selfAssertedRes.ok) {
    throw new Error(`SelfAsserted failed (${selfAssertedRes.status}).`);
  }

  const confirmUrl = new URL(
    `https://${CONFIG.authorityHost}${tenantPath}/api/${settings.api}/confirmed`
  );
  confirmUrl.searchParams.set("rememberMe", "true");
  confirmUrl.searchParams.set("csrf_token", settings.csrf);
  confirmUrl.searchParams.set("tx", settings.transId);
  confirmUrl.searchParams.set("p", policy);

  const confirmRes = await fetch(confirmUrl.toString(), {
    headers: { "user-agent": USER_AGENT }
  });
  if (!confirmRes.ok) {
    throw new Error(`Login confirmation failed (${confirmRes.status}).`);
  }

  const tokenUrl = buildAuthorizeUrlToken(username);
  const tokenRes = await fetch(tokenUrl, {
    redirect: "manual",
    headers: { "user-agent": USER_AGENT }
  });
  if (tokenRes.status >= 400) {
    throw new Error(`Token request failed (${tokenRes.status}).`);
  }

  return await extractTokenFromResponse(tokenRes);
}
