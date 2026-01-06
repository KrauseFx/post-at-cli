import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface Session {
  accessToken: string;
  expiresAt: number;
  obtainedAt: number;
  username?: string;
}

const SESSION_DIR = path.join(os.homedir(), ".cache", "post-at-cli");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");

export function getSessionPath(): string {
  return SESSION_FILE;
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await fs.readFile(SESSION_FILE, "utf8");
    const data = JSON.parse(raw) as Session;
    if (!data?.accessToken || !data?.expiresAt) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  await fs.writeFile(SESSION_FILE, JSON.stringify(session, null, 2), "utf8");
}

export function isSessionValid(session: Session, skewMs = 60_000): boolean {
  return session.expiresAt - Date.now() > skewMs;
}
