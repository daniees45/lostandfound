import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let dbClient: ReturnType<typeof drizzle> | null = null;

export function initializeDatabase() {
  if (dbClient) return dbClient;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl) {
    throw new Error(
      "TURSO_DATABASE_URL environment variable is not set. Set it to your Turso database URL."
    );
  }

  if (!tursoToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN environment variable is not set. Set it to your Turso authentication token."
    );
  }

  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  dbClient = drizzle(client, { schema });

  return dbClient;
}

export function getDatabase() {
  if (!dbClient) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first."
    );
  }
  return dbClient;
}

export async function getDatabaseOrThrow() {
  return initializeDatabase();
}

export const db = () => getDatabase();

export { schema };
