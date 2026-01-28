import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ENV } from "./_core/env";
import * as schema from "../drizzle/schema";

// 使用 Supabase Postgres（需要 ssl）
let _client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!ENV.databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    _client = postgres(ENV.databaseUrl, {
      ssl: "require",
      prepare: false,
      max: 5,
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

// （可選）在程式結束時關閉連線
export async function closeDb() {
  if (_client) {
    await _client.end({ timeout: 5 });
    _client = null;
    _db = null;
  }
}
