#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./auth.js";
import { ENV } from "./config.js";
import { fetchSendungen, fetchSendungDetail } from "./api.js";
import {
  extractPictureUrl,
  formatEstimatedDelivery,
  formatSendungList,
  isUpcoming
} from "./format.js";
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
  .description("List upcoming deliveries")
  .option("--all", "include delivered/expired items")
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
      const filtered = opts.all ? sendungen : sendungen.filter(isUpcoming);

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

program.parseAsync(process.argv);
