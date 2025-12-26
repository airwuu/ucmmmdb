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

// Food Truck Schedule table - caches parsed schedule data
export const foodTruckSchedule = sqliteTable('food_truck_schedule', {
    id: text('id').primaryKey(),
    week_start: text('week_start').notNull(), // ISO Date YYYY-MM-DD of the week start (Sunday)
    day: text('day').notNull(), // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
    truck_name: text('truck_name').notNull(),
    start_time: text('start_time'), // '11:00' or 'Night Service'
    end_time: text('end_time'),     // '14:00'
    location: text('location').default('Campus'),
    cuisine: text('cuisine'),       // 'Mexican Fusion', 'Shaved Ice', etc.
    notes: text('notes'),           // 'ocr-table', 'manual', etc.
    image_url: text('image_url'),   // Source image URL for audit/debug
    created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`)
});

// Food Truck Week Images table - caches the weekly schedule image URLs
export const foodTruckWeekImages = sqliteTable('food_truck_week_images', {
    id: text('id').primaryKey(),
    week_start: text('week_start').notNull().unique(), // ISO Date YYYY-MM-DD
    week_end: text('week_end').notNull(),              // ISO Date YYYY-MM-DD (inclusive)
    image_url: text('image_url').notNull(),
    label: text('label'),                              // Human readable: 'Aug 25 – Aug 31'
    scraped_at: integer('scraped_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`)
});