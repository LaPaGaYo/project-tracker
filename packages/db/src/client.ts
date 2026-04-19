import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema.ts";

export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/the_platform";

export const sql = postgres(databaseUrl, {
  prepare: false
});

export const db = drizzle(sql, {
  schema
});
