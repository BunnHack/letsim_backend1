import { Hono } from "https://esm.sh/hono@3.10.2";
import { serveStatic } from "https://esm.sh/hono@3.10.2/adapter/deno/serve-static.ts";

const app = new Hono();

// API Key moved to server-side to prevent exposure and CORS issues
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImE2ZTgzMzljLWU4NWYtNDFmMy1iODkyLWEzYTUyYWQ0ZTQ3YyIsImV4cCI6MTc2NTQ2NjM4OH0.np46KmkTvVx_pVITcnCW6aYApgYSGc7wMjabAbW_b4s';
const TARGET_API = 'https://zai.is/api/v1/chat/completions';

// Proxy endpoint for chat completions
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json();

    const response = await fetch(TARGET_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return c.json(data, response.status as any);
  } catch (error) {
    console.error('Proxy Error:', error);
    return c.json({ error: 'Failed to communicate with AI service' }, 500);
  }
});

// Serve static files
app.use('/*', serveStatic({ root: './' }));

Deno.serve(app.fetch);
