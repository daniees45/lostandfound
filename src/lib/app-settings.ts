import { initializeDatabase } from "@/lib/db";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const SITE_LOGO_KEY = "site_logo_url";
export const DEFAULT_SITE_LOGO_URL = "/logo.png";

const app_settings = sqliteTable("app_settings", {
  setting_key: text("setting_key").primaryKey(),
  setting_value: text("setting_value").notNull(),
  updated_at: integer("updated_at", { mode: "timestamp" }),
});

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
    const row = await db
      .select({ setting_value: app_settings.setting_value })
      .from(app_settings)
      .where(eq(app_settings.setting_key, SITE_LOGO_KEY))
      .get();
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
    await db.delete(app_settings).where(eq(app_settings.setting_key, SITE_LOGO_KEY));
    return;
  }

  await db
    .insert(app_settings)
    .values({
      setting_key: SITE_LOGO_KEY,
      setting_value: normalized,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: app_settings.setting_key,
      set: {
        setting_value: normalized,
        updated_at: new Date(),
      },
    });
}
