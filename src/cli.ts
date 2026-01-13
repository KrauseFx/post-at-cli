#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./auth.js";
import { ENV } from "./config.js";
import { fetchSendungen, fetchSendungDetail, setPlaceRedirection } from "./api.js";
import {
  extractPictureUrl,
  formatEstimatedDelivery,
  formatSendungList,
  isUpcoming
} from "./format.js";
import { fetchPlaceOptions } from "./sitecore.js";
import { isSessionValid, loadSession, saveSession } from "./session.js";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getCredentials(options?: { username?: string; password?: string }): {
  username: string;
  password: string;
} {
  const username = options?.username || getEnv(ENV.username);
  const password = options?.password || getEnv(ENV.password);

  if (!username || !password) {
    throw new Error(
      `Missing credentials. Set ${ENV.username} and ${ENV.password} environment variables.`
    );
  }

  return { username, password };
}

async function getAccessToken(
  options?: { username?: string; password?: string; forceLogin?: boolean }
): Promise<{ token: string; username: string }> {
  const { username, password } = getCredentials(options);
  if (!options?.forceLogin) {
    const session = await loadSession();
    if (session && isSessionValid(session) && session.username === username) {
      return { token: session.accessToken, username };
    }
  }

  const result = await login(username, password);
  await saveSession({
    accessToken: result.accessToken,
    obtainedAt: result.obtainedAt,
    expiresAt: result.expiresAt,
    username
  });
  return { token: result.accessToken, username };
}

const program = new Command();
program
  .name("post-at")
  .description("CLI for post.at deliveries")
  .version("0.1.0");

const PLACE_PRESETS: Record<string, string> = {
  "vor-der-wohnungstuer": "Vor_Wohnungstüre"
};

program
  .command("login")
  .description("Login and cache a short-lived session")
  .option("--username <email>", "login email")
  .option("--password <password>", "login password")
  .action(async (opts) => {
    try {
      const { username } = await getAccessToken({
        username: opts.username,
        password: opts.password,
        forceLogin: true
      });
      console.log(`Logged in as ${username}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program
  .command("deliveries")
  .description("List deliveries")
  .option("--all", "include delivered/expired items (deprecated: use --status all)")
  .option("--status <type>", "filter by status: pending, delivered, or all (default)", "all")
  .option("--limit <count>", "number of entries to request", "50")
  .option("--json", "output raw JSON")
  .option("--username <email>", "login email")
  .option("--password <password>", "login password")
  .action(async (opts) => {
    try {
      const { token } = await getAccessToken({
        username: opts.username,
        password: opts.password
      });
      const limit = Number(opts.limit) || 50;
      const sendungen = await fetchSendungen(token, limit);
      
      // Determine filter mode
      let statusFilter = opts.status?.toLowerCase() || "all";
      if (opts.all) {
        // Backwards compatibility: --all overrides --status
        statusFilter = "all";
      }

      // Validate status filter
      if (!["pending", "delivered", "all"].includes(statusFilter)) {
        throw new Error(`Invalid --status value: ${opts.status}. Use: pending, delivered, or all`);
      }

      // Apply filtering
      let filtered: typeof sendungen;
      if (statusFilter === "all") {
        filtered = sendungen;
      } else if (statusFilter === "delivered") {
        filtered = sendungen.filter(s => s.status && s.status.toUpperCase() === "ZU");
      } else {
        // pending: exclude delivered (ZU) status
        filtered = sendungen.filter(s => !s.status || s.status.toUpperCase() !== "ZU");
      }

      if (opts.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      console.log(formatSendungList(filtered));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program
  .command("delivery")
  .description("Get details for a single delivery")
  .argument("<sendungsnummer>", "tracking number")
  .option("--json", "output raw JSON")
  .option("--username <email>", "login email")
  .option("--password <password>", "login password")
  .action(async (sendungsnummer, opts) => {
    try {
      const { token } = await getAccessToken({
        username: opts.username,
        password: opts.password
      });
      const detail = await fetchSendungDetail(token, sendungsnummer);

      if (opts.json) {
        console.log(JSON.stringify(detail, null, 2));
        return;
      }

      const expected = formatEstimatedDelivery(detail.estimatedDelivery);
      const picture = extractPictureUrl(detail);

      console.log(`Tracking: ${detail.sendungsnummer}`);
      console.log(`Expected: ${expected}`);
      console.log(`Sender: ${detail.sender || "—"}`);
      console.log(`Status: ${detail.status || "—"}`);
      console.log(`Picture: ${picture || "—"}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

const routing = program
  .command("routing")
  .description("Manage delivery routing options");

routing
  .command("place-options")
  .description("List available delivery place options (Wunschplatz)")
  .option("--json", "output raw JSON")
  .action(async (opts) => {
    try {
      const options = await fetchPlaceOptions();
      if (options.length === 0) {
        console.log("No place options found.");
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(options, null, 2));
        return;
      }
      for (const option of options) {
        console.log(`${option.key}  ${option.label}`);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

routing
  .command("place")
  .description("Set delivery place redirection (Wunschplatz)")
  .argument("<sendungsnummer>", "tracking number")
  .option("--place <label>", "place option label (as shown on post.at)")
  .option("--key <key>", "place option key (see routing place-options)")
  .option("--description <text>", "free-text description", "")
  .option(
    "--preset <preset>",
    `shortcut for place label (${Object.keys(PLACE_PRESETS).join(", ")})`
  )
  .option("--username <email>", "login email")
  .option("--password <password>", "login password")
  .action(async (sendungsnummer, opts) => {
    try {
      const { token } = await getAccessToken({
        username: opts.username,
        password: opts.password
      });
      const presetKey = opts.preset ? PLACE_PRESETS[opts.preset] : undefined;
      let key: string | undefined = opts.key || presetKey;
      let label: string | undefined = opts.place;

      if (!key || !label) {
        const options = await fetchPlaceOptions();
        if (!key && label) {
          const match = options.find((opt) => opt.label === label);
          if (match) {
            key = match.key;
            label = match.label;
          }
        }
        if (!label && key) {
          const match = options.find((opt) => opt.key === key);
          if (match) {
            label = match.label;
          }
        }
      }

      if (!key && label) {
        key = label;
      }

      if (!key) {
        throw new Error(
          "Missing place label. Provide --place, --key, or --preset (e.g. vor-der-wohnungstuer)."
        );
      }

      const ok = await setPlaceRedirection(token, sendungsnummer, key, opts.description || "");
      if (!ok) {
        const detail = await fetchSendungDetail(token, sendungsnummer);
        const allowed = detail?.possibleRedirectionsNoDepositories?.abstellort;
        const reason = allowed
          ? "The request was rejected by the API."
          : "This shipment does not allow Wunschplatz (abstellort) at the moment.";
        throw new Error(`Redirection request was not accepted. ${reason}`);
      }
      console.log(`Set delivery place for ${sendungsnummer} to: ${label ?? key}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
