import type { APIRoute } from 'astro';
import { site } from '../site.config';

export const GET: APIRoute = () => {
  const sitemapUrl = `${site.url}/sitemap-index.xml`;

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`,
    {
      headers: {
        'Content-Type': 'text/plain',
      },
    }
  );
};
