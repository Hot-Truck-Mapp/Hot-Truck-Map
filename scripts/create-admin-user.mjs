#!/usr/bin/env node
/**
 * Creates (or resets the password of) the Hot Truck Map admin account.
 *
 *   node scripts/create-admin-user.mjs
 *
 * Prompts for the password rather than taking it as an argument, so it never
 * lands in your shell history, in this repo, or in a log. Reads the Supabase
 * URL and service role key from .env.local.
 *
 * The email must be on the admin allow-list (see lib/admin.ts) — otherwise
 * the account will exist but /admin will still refuse it.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const CTRL_C = "\u0003";
const BACKSPACE = "\u007f";

function loadEnv(path = ".env.local") {
  const env = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`Could not read ${path} — run this from the project root.`);
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

/** Reads a line without echoing it to the terminal. */
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char) => {
      if (char === "\n" || char === "\r") {
        stdin.setRawMode?.(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (char === CTRL_C) {
        stdin.setRawMode?.(wasRaw ?? false);
        process.stdout.write("\n");
        process.exit(1);
      } else if (char === BACKSPACE || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const adminEmails = (env.ADMIN_EMAILS ?? "info@hottruckmap.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${url}/auth/v1${path}`, { ...init, headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.msg ?? json.error_description ?? json.error ?? text);
  return json;
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const data = await api(`/admin/users?page=${page}&per_page=200`);
    const users = data.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

const main = async () => {
  const defaultEmail = adminEmails[0];
  const typed = await ask(`Admin email [${defaultEmail}]: `);
  const email = (typed || defaultEmail).toLowerCase();

  if (!adminEmails.includes(email)) {
    console.error(
      `\n${email} is not on the admin allow-list (${adminEmails.join(", ")}).\n` +
      `Add it to ADMIN_EMAILS or change the default in lib/admin.ts first — ` +
      `otherwise the account will exist but /admin will still deny it.`
    );
    process.exit(1);
  }

  const password = await askHidden("Password (hidden): ");
  const confirm = await askHidden("Confirm password: ");
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Supabase requires at least 8 characters.");
    process.exit(1);
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    await api(`/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    console.log(`\nPassword reset for existing account ${email}`);
  } else {
    // email_confirm skips the verification email — this is the owner creating
    // their own account with the service role, so there is nothing to verify.
    const created = await api("/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    console.log(`\nCreated admin account ${email} (id ${created.id})`);
  }

  console.log("Sign in at /login, then open /admin.");
};

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
