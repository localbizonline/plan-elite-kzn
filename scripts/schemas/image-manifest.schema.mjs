import { z } from 'zod';

const ImageEntry = z.object({
  path: z.string().min(1),
  source: z.string().min(1),
  alt: z.string().optional(),
});

/** Schema for image-manifest.json (custom builder) */
export const ImageManifest = z.object({
  images: z.object({
    logo: ImageEntry,
    favicon: ImageEntry,
    ogImage: ImageEntry,
    heroes: z.record(z.string(), ImageEntry).refine(
      (h) => Object.keys(h).length > 0,
      { message: 'At least one hero image required' }
    ),
    ownerHeadshot: ImageEntry.optional(),
    services: z.record(z.string(), ImageEntry).optional(),
    gallery: z.array(ImageEntry).optional(),
  }),
});

/** Schema for src/images.ts import validation (template builder) */
export const ImageImportEntry = z.object({
  importName: z.string(),
  importPath: z.string().min(1),
});
