import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { scryptSync } from "crypto";
import { createClient } from "@libsql/client";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment.");
}

const client = createClient({ url, authToken });

const testUsers = [
  { id: "usr_test_01", fullName: "Ada Nwosu", email: "ada.test@valleyview.edu", role: "student" },
  { id: "usr_test_02", fullName: "Tunde Bello", email: "tunde.test@valleyview.edu", role: "student" },
  { id: "usr_test_03", fullName: "Maya Okafor", email: "maya.test@valleyview.edu", role: "student" },
  { id: "usr_test_04", fullName: "Ifeanyi Obi", email: "ifeanyi.test@valleyview.edu", role: "student" },
  { id: "usr_test_05", fullName: "Grace Mensah", email: "grace.test@valleyview.edu", role: "student" },
  { id: "usr_test_06", fullName: "Admin Tester", email: "admin.test@valleyview.edu", role: "admin" },
];

const lostItems = [
  ["itm_test_lost_01", "Black HP Laptop", "Electronics", "Engineering Block"],
  ["itm_test_lost_02", "Blue Jansport Backpack", "Bags", "Library"],
  ["itm_test_lost_03", "Student ID Card - Samuel", "Documents", "Cafeteria"],
  ["itm_test_lost_04", "Silver Wrist Watch", "Others", "Main Gate"],
  ["itm_test_lost_05", "White AirPods Case", "Electronics", "Auditorium"],
  ["itm_test_lost_06", "Black Hoodie", "Clothing", "Basketball Court"],
  ["itm_test_lost_07", "Calculator FX-991ES", "Electronics", "Lecture Hall B"],
  ["itm_test_lost_08", "Green Water Bottle", "Others", "Science Lab"],
  ["itm_test_lost_09", "Passport Photograph Envelope", "Documents", "Admin Block"],
  ["itm_test_lost_10", "USB Flash Drive 32GB", "Electronics", "Computer Lab"],
];

const foundItems = [
  ["itm_test_found_01", "Brown Leather Wallet", "Others", "Library"],
  ["itm_test_found_02", "Pink Umbrella", "Others", "Hostel Entrance"],
  ["itm_test_found_03", "Samsung Charger", "Electronics", "Lecture Hall A"],
  ["itm_test_found_04", "Red Notebook", "Documents", "Classroom 12"],
  ["itm_test_found_05", "Grey Sweater", "Clothing", "Football Field"],
  ["itm_test_found_06", "Black Power Bank", "Electronics", "Cafeteria"],
  ["itm_test_found_07", "House Keys (3 keys)", "Others", "Parking Lot"],
  ["itm_test_found_08", "Blue File Folder", "Documents", "Faculty Office"],
  ["itm_test_found_09", "Sports Bag", "Bags", "Gym"],
];

function passwordHashFor(userId) {
  const salt = `seed-${userId}`;
  const hash = scryptSync("Password123!", salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seedUsers() {
  for (const user of testUsers) {
    await client.execute({
      sql: `
        INSERT INTO profiles (id, role, email, full_name)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(id) DO UPDATE SET
          role = excluded.role,
          email = excluded.email,
          full_name = excluded.full_name
      `,
      args: [user.id, user.role, user.email, user.fullName],
    });

    await client.execute({
      sql: `
        INSERT INTO user_credentials (user_id, password_hash)
        VALUES (?1, ?2)
        ON CONFLICT(user_id) DO UPDATE SET
          password_hash = excluded.password_hash,
          updated_at = unixepoch()
      `,
      args: [user.id, passwordHashFor(user.id)],
    });
  }
}

async function seedItems() {
  const userIds = testUsers.filter((u) => u.role === "student").map((u) => u.id);
  let idx = 0;

  for (const [id, title, category, location] of lostItems) {
    const userId = userIds[idx % userIds.length];
    idx += 1;
    await client.execute({
      sql: `
        INSERT INTO items (id, user_id, title, description, category, location, status)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'lost')
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          location = excluded.location,
          status = 'lost'
      `,
      args: [
        id,
        userId,
        title,
        `${title} reported missing by test data seeder.`,
        category,
        location,
      ],
    });
  }

  for (const [id, title, category, location] of foundItems) {
    const userId = userIds[idx % userIds.length];
    idx += 1;
    await client.execute({
      sql: `
        INSERT INTO items (id, user_id, title, description, category, location, status)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'found')
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          location = excluded.location,
          status = 'found'
      `,
      args: [
        id,
        userId,
        title,
        `${title} reported found by test data seeder.`,
        category,
        location,
      ],
    });
  }
}

async function main() {
  await seedUsers();
  await seedItems();

  const lostCount = await client.execute("SELECT COUNT(*) AS count FROM items WHERE status = 'lost'");
  const foundCount = await client.execute("SELECT COUNT(*) AS count FROM items WHERE status = 'found'");

  const totalLost = Number(lostCount.rows[0]?.count ?? 0);
  const totalFound = Number(foundCount.rows[0]?.count ?? 0);

  console.log(`Seed complete. Lost items in DB: ${totalLost}, Found items in DB: ${totalFound}`);
  console.log("Test users can sign in with password: Password123!");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
