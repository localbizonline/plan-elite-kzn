import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const locations = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/locations" }),
  schema: z.object({
    city: z.string(),
    slug: z.string(),
    cityGroup: z.string(),
    phone: z.string(),
    suburbs: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
  }),
});

export const collections = { locations };
