import { Hono } from 'hono';

interface CloudflareBindings {
    DB: D1Database;
}

const app = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /proxy/image
 * Proxies image requests to bypass CORS restrictions.
 * Only allows images from dining.ucmerced.edu
 * 
 * Query params:
 *   - url: The full URL of the image to proxy
 */
app.get('/image', async (c) => {
    const imageUrl = c.req.query('url');

    if (!imageUrl) {
        return c.json({ error: 'Missing url parameter' }, 400);
    }

    // Only allow dining site images for security
    if (!imageUrl.startsWith('https://dining.ucmerced.edu/')) {
        return c.json({ error: 'Invalid URL - only dining.ucmerced.edu images allowed' }, 403);
    }

    try {
        const imageResponse = await fetch(imageUrl, {
            headers: { 'User-Agent': 'ucmmm-bot/1.0' }
        });

        if (!imageResponse.ok) {
            return c.json({ error: 'Image fetch failed' }, 502);
        }

        // Return with CORS headers
        c.header('Content-Type', imageResponse.headers.get('Content-Type') || 'image/png');
        c.header('Access-Control-Allow-Origin', '*');
        c.header('Cache-Control', 'public, max-age=86400'); // Cache 24 hours

        return new Response(imageResponse.body, {
            headers: c.res.headers
        });
    } catch (err) {
        console.error('Image proxy error:', err);
        return c.json({ error: 'Proxy error' }, 500);
    }
});

export default app;
