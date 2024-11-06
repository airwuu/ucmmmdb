import { sql } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

// export const users = sqliteTable('users', {
//   id: text('id').primaryKey(),
//   name: text('name'),
//   created: integer("created", { mode: "timestamp_ms" }).default(sql`(STRFTIME('%s', 'now') * 1000)`)
// }); 

// Item table
// export const item = sqliteTable('item', {
//     item_id: text('item_id').primaryKey(),
    
//   });
  
// Menu table
export const menu = sqliteTable('menu', {
    row_id: integer('id').primaryKey({ autoIncrement: true }),
    week: text("week").default(sql`CURRENT_DATE`),
    location: text('location').notNull(),
    day: text('day').notNull(),
    meal: text('meal').notNull(),
    station: text('station').notNull(),
    item_id: text('item_id').notNull(),
    name: text('name').notNull(),
    missing_reports: integer('missing_reports').notNull().default(0)
});