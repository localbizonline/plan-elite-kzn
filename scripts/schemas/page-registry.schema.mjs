import { z } from 'zod';

const PageEntry = z.object({
  path: z.string()
    .startsWith('/')
    .endsWith('/')
    .or(z.literal('/')), // homepage is just "/"
  title: z.string().min(1),
  type: z.enum(['static', 'service', 'location']),
});

/** Schema for page-registry.json (custom builder) */
export const PageRegistry = z.object({
  pages: z.array(PageEntry).refine(
    (pages) => pages.some((p) => p.path === '/'),
    { message: 'Homepage (path: "/") is required' }
  ),
  navigation: z.object({
    main: z.array(z.object({
      name: z.string().min(1),
      path: z.string().startsWith('/'),
    })),
  }),
});
