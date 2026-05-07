import { 
  text, 
  blob,
  integer, 
  sqliteTable,
  primaryKey,
  index,
  real,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Profiles table (Users)
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    role: text("role", { enum: ["student", "admin", "pickup_point"] })
      .default("student")
      .notNull(),
    email: text("email").unique(),
    full_name: text("full_name"),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => ({
    emailIdx: index("profiles_email_idx").on(table.email),
  })
);

// Items table
export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .references(() => profiles.id)
      .notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    ai_tags: text("ai_tags", { mode: "json" }).$type<string[]>().default([]),
    location: text("location").notNull(),
    status: text("status", { 
      enum: ["lost", "found", "claimed", "returned", "held_at_pickup"] 
    }).notNull(),
    image_url: text("image_url"),
    pickup_code: text("pickup_code"),
    // For SQLite, we store embeddings as JSON or blob
    embedding: text("embedding", { mode: "json" }).$type<number[] | null>(),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => ({
    userCreatedIdx: index("items_user_created_idx").on(table.user_id, table.created_at),
    statusCreatedIdx: index("items_status_created_idx").on(table.status, table.created_at),
  })
);

// Claims table
export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    item_id: text("item_id")
      .references(() => items.id, { onDelete: "cascade" })
      .notNull(),
    claimant_id: text("claimant_id")
      .references(() => profiles.id)
      .notNull(),
    proof_description: text("proof_description"),
    status: text("status", { 
      enum: ["pending", "approved", "rejected"] 
    })
      .default("pending")
      .notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => ({
    itemStatusCreatedIdx: index("claims_item_status_created_idx").on(
      table.item_id,
      table.status,
      table.created_at
    ),
    claimantCreatedIdx: index("claims_claimant_created_idx").on(
      table.claimant_id,
      table.created_at
    ),
  })
);

// Custody logs table
export const custody_logs = sqliteTable(
  "custody_logs",
  {
    id: text("id").primaryKey(),
    item_id: text("item_id")
      .references(() => items.id, { onDelete: "cascade" })
      .notNull(),
    from_user_id: text("from_user_id").references(() => profiles.id),
    to_user_id: text("to_user_id").references(() => profiles.id),
    verification_method: text("verification_method", {
      enum: ["handover_code", "id_card", "manual_override"],
    }).notNull(),
    notes: text("notes"),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => ({
    itemCreatedIdx: index("custody_logs_item_created_idx").on(
      table.item_id,
      table.created_at
    ),
  })
);

// Notifications table
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    item_id: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["claim_submitted", "claim_approved", "claim_rejected", "item_found"],
    }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: integer("read", { mode: "boolean" }).default(false).notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(
      table.user_id,
      table.created_at
    ),
  })
);

// Pickup records table
export const pickup_records = sqliteTable(
  "pickup_records",
  {
    id: text("id").primaryKey(),
    item_id: text("item_id")
      .references(() => items.id, { onDelete: "cascade" })
      .notNull(),
    pickup_point_id: text("pickup_point_id")
      .references(() => profiles.id)
      .notNull(),
    receiver_id: text("receiver_id").references(() => profiles.id),
    pickup_code: text("pickup_code").notNull().unique(),
    status: text("status", {
      enum: ["pending", "picked_up", "failed"],
    })
      .default("pending")
      .notNull(),
    created_at: integer("created_at", { mode: "timestamp" })
      .default(sql`(unixepoch())`)
      .notNull(),
    picked_up_at: integer("picked_up_at", { mode: "timestamp" }),
  },
  (table) => ({
    itemCreatedIdx: index("pickup_records_item_created_idx").on(
      table.item_id,
      table.created_at
    ),
  })
);
