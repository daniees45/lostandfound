import { initializeDatabase } from "@/lib/db";

const SITE_LOGO_KEY = "site_logo_url";
export const DEFAULT_SITE_LOGO_URL = "/logo.png";

export async function ensureAppSettingsTable() {
  const db = initializeDatabase();
  await db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}

export async function getSiteLogoUrl() {
  try {
    await ensureAppSettingsTable();
    const db = initializeDatabase();
    const result = await db.run(
      `SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`,
      [SITE_LOGO_KEY]
    );

    const row = (result.rows?.[0] as { setting_value?: string } | undefined) ?? undefined;
    const value = row?.setting_value?.trim();
    return value || DEFAULT_SITE_LOGO_URL;
  } catch {
    return DEFAULT_SITE_LOGO_URL;
  }
}

export async function setSiteLogoUrl(url: string | null) {
  await ensureAppSettingsTable();
  const db = initializeDatabase();
  const normalized = url?.trim() ?? "";

  if (!normalized) {
    await db.run(`DELETE FROM app_settings WHERE setting_key = ?`, [SITE_LOGO_KEY]);
    return;
  }

  await db.run(
    `
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = unixepoch()
    `,
    [SITE_LOGO_KEY, normalized]
  );
}
