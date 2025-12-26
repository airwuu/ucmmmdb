import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import { foodTruckSchedule, foodTruckWeekImages } from '../../schemas/drizzle';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const SOURCE_URL = 'https://dining.ucmerced.edu/retail-services/fork-road';

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

export interface FoodTruckEntry {
    id: string;
    week_start: string;
    day: string;
    truck_name: string;
    start_time: string | null;
    end_time: string | null;
    location: string | null;
    cuisine: string | null;
    notes: string | null;
    image_url: string | null;
    created_at: Date | null;
}

export interface WeekImage {
    start: string;
    end: string;
    url: string;
    label: string;
}

export interface GetScheduleOptions {
    forceRefresh?: boolean;
}

export class FoodTruckService {
    constructor(private db: DrizzleD1Database<any>) { }

    /**
     * Retrieves the schedule for a specific week.
     * If not found in DB or stale, attempts to scrape/parse the source.
     */
    async getScheduleForWeek(date: string, options: GetScheduleOptions = {}) {
        const startOfWeek = dayjs(date).startOf('week').format('YYYY-MM-DD');
        const now = Math.floor(Date.now() / 1000);

        // 1. Check DB Cache (unless force refresh)
        if (!options.forceRefresh) {
            const cached = await this.db.select()
                .from(foodTruckSchedule)
                .where(eq(foodTruckSchedule.week_start, startOfWeek))
                .all();

            if (cached.length > 0) {
                // Check if cache is stale (older than TTL)
                const createdAt = cached[0].created_at;
                const cacheAge = createdAt ? now - Math.floor(createdAt.getTime() / 1000) : Infinity;

                if (cacheAge < CACHE_TTL_SECONDS) {
                    return { source: 'cache', data: cached, week_start: startOfWeek };
                }
                console.log(`Cache stale for week ${startOfWeek}, refreshing...`);
            }
        }

        // 2. Fetch from Source if missing or stale
        return this.fetchAndCacheFromSource(startOfWeek);
    }

    /**
     * Retrieves cached week images for the frontend.
     */
    async getWeekImages(): Promise<WeekImage[]> {
        const cached = await this.db.select()
            .from(foodTruckWeekImages)
            .all();

        return cached.map(row => ({
            start: row.week_start,
            end: row.week_end,
            url: row.image_url,
            label: row.label || ''
        }));
    }

    /**
     * Scrapes the UC Merced site for the schedule image/data
     */
    private async fetchAndCacheFromSource(weekStart: string) {
        console.log(`Fetching external food truck data for week ${weekStart}`);

        try {
            const response = await fetch(SOURCE_URL);
            if (!response.ok) throw new Error(`Failed to fetch UCM website: ${response.status}`);

            // Use HTMLRewriter (Cloudflare Native) to find schedule images
            const foundImages: { src: string; alt: string }[] = [];

            await new HTMLRewriter()
                .on('article img, .content img, .field-media-image img, img', {
                    element(element) {
                        const src = element.getAttribute('src');
                        const alt = element.getAttribute('alt') || '';

                        // Look for UCM Drupal image patterns or schedule-related images
                        if (src && (
                            src.includes('/sites/g/files/') && src.includes('/page/images/') ||
                            alt.toLowerCase().includes('schedule') ||
                            alt.toLowerCase().includes('food truck')
                        )) {
                            const fullUrl = src.startsWith('http') ? src : `https://dining.ucmerced.edu${src}`;
                            foundImages.push({ src: fullUrl, alt });
                        }
                    }
                })
                .transform(response)
                .text(); // Consume stream to trigger rewriter

            if (foundImages.length === 0) {
                return { source: 'scrape_failed', error: 'No schedule image found', data: [], week_start: weekStart };
            }

            // Parse image URLs to extract date ranges and cache them
            await this.cacheWeekImages(foundImages);

            // Find the image for the requested week
            const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
            const matchingImage = foundImages.find(img => {
                // Try to extract dates from the filename (e.g., "8-25-8-31.png")
                const dateMatch = img.src.match(/(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\.png$/i);
                if (dateMatch) {
                    // This is a simplified check - in production you'd parse the full dates
                    return true;
                }
                return true; // Fallback: return first image
            });

            const foundImageUrl = matchingImage?.src || foundImages[0]?.src;

            // 3. OCR / Parsing Step
            // NOTE: Heavy OCR (Tesseract) is difficult in Workers. 
            // Ideally, you call an external OCR API here (Google Vision, etc.)
            const parsedData = await this.parseScheduleImage(foundImageUrl, weekStart);

            // 4. Clear old cache and store new data
            if (parsedData.length > 0) {
                // Delete old entries for this week
                await this.db.delete(foodTruckSchedule)
                    .where(eq(foodTruckSchedule.week_start, weekStart))
                    .execute();

                const inserts = parsedData.map(entry => ({
                    id: uuidv4(),
                    week_start: weekStart,
                    day: entry.day,
                    truck_name: entry.truck,
                    start_time: entry.start || null,
                    end_time: entry.end || null,
                    location: 'Campus',
                    cuisine: entry.cuisine || null,
                    notes: 'server-parsed',
                    image_url: foundImageUrl
                }));

                await this.db.insert(foodTruckSchedule).values(inserts).execute();
            }

            return {
                source: 'fresh_fetch',
                image_url: foundImageUrl,
                data: parsedData,
                images_found: foundImages.length,
                week_start: weekStart
            };

        } catch (e) {
            console.error('Error fetching food trucks:', e);
            return { source: 'error', error: String(e), data: [], week_start: weekStart };
        }
    }

    /**
     * Caches the found week images to the database
     */
    private async cacheWeekImages(images: { src: string; alt: string }[]) {
        for (const img of images) {
            // Try to extract date range from filename (e.g., "8-25-8-31.png")
            const dateMatch = img.src.match(/(\d{1,2})-(\d{1,2})-(\d{1,2})-(\d{1,2})\.png$/i);
            if (!dateMatch) continue;

            const [, startMonth, startDay, endMonth, endDay] = dateMatch;
            const year = new Date().getFullYear();

            const weekStart = `${year}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
            const weekEnd = `${year}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
            const label = `${this.formatMonthDay(startMonth, startDay)} – ${this.formatMonthDay(endMonth, endDay)}`;

            try {
                // Upsert: try insert, ignore if exists (unique constraint on week_start)
                await this.db.insert(foodTruckWeekImages)
                    .values({
                        id: uuidv4(),
                        week_start: weekStart,
                        week_end: weekEnd,
                        image_url: img.src,
                        label: label
                    })
                    .onConflictDoUpdate({
                        target: foodTruckWeekImages.week_start,
                        set: {
                            image_url: img.src,
                            label: label
                        }
                    })
                    .execute();
            } catch (e) {
                // Ignore duplicate key errors
                console.log(`Image for week ${weekStart} already cached or error:`, e);
            }
        }
    }

    private formatMonthDay(month: string, day: string): string {
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[parseInt(month, 10)] || month} ${parseInt(day, 10)}`;
    }

    /**
     * Placeholder for the OCR/parsing logic.
     * In a production environment, this would call:
     * - Google Cloud Vision API
     * - Azure Computer Vision
     * - Cloudflare Workers AI (vision models)
     * - A dedicated microservice with Tesseract
     */
    private async parseScheduleImage(imageUrl: string, weekStart: string): Promise<{
        day: string;
        truck: string;
        start?: string;
        end?: string;
        cuisine?: string;
    }[]> {
        // Return empty array to signify "We found the image, but server couldn't parse it yet"
        // The frontend can fallback to client-side OCR or display the image directly
        console.log(`OCR placeholder: would parse image ${imageUrl} for week ${weekStart}`);

        return [];

        // Example of what you would return if you hooked up an OCR API:
        // return [
        //   { day: 'mon', truck: 'Taco Truck', start: '11:00', end: '14:00', cuisine: 'Mexican' },
        //   { day: 'wed', truck: 'Kona Ice', start: '11:00', end: '15:00', cuisine: 'Shaved Ice' }
        // ];
    }

    /**
     * Force refresh the cache for the current and next week.
     * Called by cron job or manual refresh endpoint.
     */
    async refreshCache() {
        const today = dayjs();
        const currentWeek = today.startOf('week').format('YYYY-MM-DD');
        const nextWeek = today.add(7, 'day').startOf('week').format('YYYY-MM-DD');

        console.log(`Refreshing cache for weeks: ${currentWeek}, ${nextWeek}`);

        const results = await Promise.allSettled([
            this.getScheduleForWeek(currentWeek, { forceRefresh: true }),
            this.getScheduleForWeek(nextWeek, { forceRefresh: true })
        ]);

        return {
            currentWeek: results[0].status === 'fulfilled' ? results[0].value : { error: String(results[0]) },
            nextWeek: results[1].status === 'fulfilled' ? results[1].value : { error: String(results[1]) }
        };
    }

    /**
     * Accept OCR results from client-side processing and store in database.
     * This enables crowdsourced cache population - first user runs OCR, 
     * subsequent users get cached data instantly.
     */
    async submitClientOcrData(weekStart: string, entries: {
        day: string;
        truck: string;
        start?: string;
        end?: string;
        cuisine?: string;
        notes?: string;
    }[], imageUrl?: string): Promise<{ success: boolean; inserted: number; error?: string }> {

        if (!entries || entries.length === 0) {
            return { success: false, inserted: 0, error: 'No entries provided' };
        }

        // Normalize week start to Sunday
        const normalizedWeekStart = dayjs(weekStart).startOf('week').format('YYYY-MM-DD');

        try {
            // Check if data already exists for this week
            const existing = await this.db.select()
                .from(foodTruckSchedule)
                .where(eq(foodTruckSchedule.week_start, normalizedWeekStart))
                .all();

            // If cache exists and is fresh, don't overwrite with client data
            if (existing.length > 0) {
                const createdAt = existing[0].created_at;
                const cacheAge = createdAt
                    ? Math.floor(Date.now() / 1000) - Math.floor(createdAt.getTime() / 1000)
                    : Infinity;

                if (cacheAge < CACHE_TTL_SECONDS) {
                    return {
                        success: true,
                        inserted: 0,
                        error: 'Cache already populated and fresh, skipping client submission'
                    };
                }

                // Cache is stale, delete old entries before inserting new ones
                await this.db.delete(foodTruckSchedule)
                    .where(eq(foodTruckSchedule.week_start, normalizedWeekStart))
                    .execute();
            }

            // Insert client-provided entries one at a time
            // D1 has known issues with batch inserts where not all records are inserted
            let insertedCount = 0;
            for (const entry of entries) {
                try {
                    await this.db.insert(foodTruckSchedule).values({
                        id: uuidv4(),
                        week_start: normalizedWeekStart,
                        day: entry.day.toLowerCase().slice(0, 3), // Normalize to 'mon', 'tue', etc.
                        truck_name: entry.truck,
                        start_time: entry.start || null,
                        end_time: entry.end || null,
                        location: 'Campus',
                        cuisine: entry.cuisine || null,
                        notes: entry.notes || 'client-ocr',
                        image_url: imageUrl || null
                    }).execute();
                    insertedCount++;
                } catch (insertErr) {
                    console.error(`Failed to insert entry for ${entry.truck}:`, insertErr);
                }
            }

            console.log(`Client OCR data submitted: ${insertedCount} entries for week ${normalizedWeekStart}`);

            return { success: true, inserted: insertedCount };

        } catch (e) {
            console.error('Error submitting client OCR data:', e);
            return { success: false, inserted: 0, error: String(e) };
        }
    }
}

