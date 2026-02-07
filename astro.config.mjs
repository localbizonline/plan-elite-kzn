import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { site } from './src/site.config.ts';

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin/') && !page.includes('/thank-you/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
  vite: { plugins: [tailwindcss()] },
});
