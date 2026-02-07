import { z } from 'zod';

/** Schema for client-config.json — validates Airtable data before use. */
export const ClientConfig = z.object({
  // Identity (at least one name field required)
  companyName: z.string().min(1).optional(),
  'Company name': z.string().min(1).optional(),

  // Contact
  phone: z.string().optional(),
  'Phone number sent to leads': z.string().optional(),
  whatsapp: z.string().optional(),
  'WhatsApp number': z.string().optional(),
  email: z.string().email().optional(),
  Email: z.string().email().optional(),

  // Owner
  ownerFirstName: z.string().optional(),
  'Business owner name': z.string().optional(),
  ownerLastName: z.string().optional(),
  'Business owner surname': z.string().optional(),

  // Business details
  niche: z.string().optional(),
  'Niche your business covers': z.string().optional(),
  yearStarted: z.union([z.string(), z.number()]).optional(),
  'Year Started': z.union([z.string(), z.number()]).optional(),
  website: z.string().url().optional(),
  Website: z.string().url().optional(),

  // Location
  primaryCity: z.string().optional(),
  'City Based In': z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    postalCode: z.string().optional(),
    coords: z.object({
      lat: z.number(),
      lng: z.number(),
    }).optional(),
  }).optional(),

  // Services
  services: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),
  Services: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),

  // Service areas
  serviceAreas: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),
  'What areas does your company service?': z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),

  // Reviews / external
  'Google Maps URL': z.string().optional(),
  mapsEmbed: z.string().optional(),
  recordId: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  helloPeterUrl: z.string().optional(),
  'Hello Peter URL': z.string().optional(),

  // Content
  aboutText: z.string().optional(),
  'About Prompt OUTPUT': z.string().optional(),
  'Partner About': z.string().optional(),
  'Services Rewrite OUTPUT': z.string().optional(),
  differentiators: z.union([z.array(z.string()), z.string()]).optional(),
  'Choose features that match your business': z.union([z.array(z.string()), z.string()]).optional(),
}).passthrough().refine(
  (data) => data.companyName || data['Company name'],
  { message: 'At least one of companyName or "Company name" is required' }
);

/**
 * Validate client config data. Returns { success, data, errors }.
 * Does NOT throw — caller decides whether to fail or warn.
 */
export function validateClientConfig(data) {
  const result = ClientConfig.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }
  const errors = result.error.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`
  );
  return { success: false, data, errors };
}
