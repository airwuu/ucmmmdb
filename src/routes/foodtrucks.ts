import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { FoodTruckService } from '../services/foodTruckService';

interface CloudflareBindings {
    DB: D1Database;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /foodtrucks
 * Returns the food truck schedule for a given week.
 * Query params:
 *   - date: ISO date string (defaults to today)
 *   - refresh: 'true' to force cache refresh
 */
app.get('/', async (c) => {
    const db = drizzle(c.env.DB);
    const service = new FoodTruckService(db);

    const date = c.req.query('date') || new Date().toISOString();
    const forceRefresh = c.req.query('refresh') === 'true';

    const result = await service.getScheduleForWeek(date, { forceRefresh });

    // Set cache headers for edge caching (1 hour cache, 24 hour stale-while-revalidate)
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

    return c.json(result);
});

/**
 * GET /foodtrucks/images
 * Returns cached week images for the frontend.
 * This matches the frontend's /api/foodtrucks/images expectation.
 */
app.get('/images', async (c) => {
    const db = drizzle(c.env.DB);
    const service = new FoodTruckService(db);

    const weeks = await service.getWeekImages();

    // Cache for 1 hour
    c.header('Cache-Control', 'public, max-age=3600');

    return c.json({ weeks });
});

/**
 * POST /foodtrucks/refresh
 * Force refresh the cache for current and next week.
 * Used by cron triggers or admin actions.
 */
app.post('/refresh', async (c) => {
    const db = drizzle(c.env.DB);
    const service = new FoodTruckService(db);

    const result = await service.refreshCache();

    return c.json({
        status: 'Refresh completed',
        ...result
    });
});

/**
 * GET /foodtrucks/health
 * Health check endpoint for monitoring.
 */
app.get('/health', async (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /foodtrucks/schedule
 * Submit client-side OCR parsed schedule data.
 * This enables crowdsourced caching - first user runs OCR on client,
 * submits results, and subsequent users get cached data instantly.
 * 
 * Request body:
 * {
 *   week_start: string,      // ISO date (will be normalized to week start)
 *   image_url?: string,      // Source image URL for reference
 *   entries: [{
 *     day: string,           // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
 *     truck: string,         // Truck name
 *     start?: string,        // Start time '11:00' or 'Night Service'
 *     end?: string,          // End time '14:00'
 *     cuisine?: string,      // 'Mexican Fusion', etc.
 *     notes?: string         // Additional notes
 *   }]
 * }
 */
app.post('/schedule', async (c) => {
    const db = drizzle(c.env.DB);
    const service = new FoodTruckService(db);

    try {
        const body = await c.req.json();
        const { week_start, entries, image_url } = body;

        if (!week_start || !entries) {
            return c.json({ success: false, error: 'Missing required fields: week_start, entries' }, 400);
        }

        const result = await service.submitClientOcrData(week_start, entries, image_url);

        return c.json(result);
    } catch (e) {
        return c.json({ success: false, error: `Invalid request: ${e}` }, 400);
    }
});

export default app;
