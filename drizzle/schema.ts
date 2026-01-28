import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  timestamp,
  varchar,
  numeric,
  date,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
// ============================================
// Enums
// ============================================
export const roleEnum = pgEnum("role", ["user", "admin", "store_manager"]);

// ============================================
// 使用者表 (Users)
// ============================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: roleEnum("role").default("user").notNull(),
    storeId: integer("storeId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (t) => ({
    openIdUnique: uniqueIndex("users_openid_unique").on(t.openId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
// ============================================
// 分店表 (Stores)
// ============================================
export const stores = pgTable(
  "stores",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 32 }),
    lineGroupId: varchar("lineGroupId", { length: 64 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({
    codeUnique: uniqueIndex("stores_code_unique").on(t.code),
  })
);

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;
