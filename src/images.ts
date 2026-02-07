// ============================================================================
// IMAGE REGISTRY — Convention-based folder discovery
// ============================================================================
// Images are discovered via import.meta.glob() from folder conventions.
// Folder path = placement. Drop any file in a folder, glob picks first match.
//
// Folder structure:
//   src/assets/images/
//   ├── home-hero/              ← Homepage hero (first file)
//   ├── inner-hero/             ← Inner page hero (About, Contact, Reviews, Services)
//   ├── service-areas/          ← ServiceAreas section background
//   ├── gallery/                ← Homepage gallery (all files, sorted by name)
//   ├── services/{slug}/card/   ← Service card thumbnail
//   ├── services/{slug}/hero/   ← Service page hero
//   ├── services/{slug}/content/← Service content section
//   ├── services/{slug}/gallery/← OPTIONAL per-service gallery
//   ├── headshot/               ← Owner headshot
//   └── logo/                   ← Business logo
// ============================================================================

// Eager glob — returns Record<relative-path, { default: ImageMetadata }>
const allImages = import.meta.glob<{ default: ImageMetadata }>(
  './assets/images/**/*.{jpg,jpeg,png,webp,svg,gif}',
  { eager: true }
);

// Normalize keys: strip './assets/images/' prefix
// Result: { 'home-hero/sunset.jpg': ImageMetadata, ... }
const imageMap: Record<string, ImageMetadata> = {};
for (const [path, mod] of Object.entries(allImages)) {
  const key = path.replace('./assets/images/', '');
  imageMap[key] = mod.default;
}

/**
 * Get the first image from a placement folder.
 * Example: getPlacementImage('home-hero') finds first file in home-hero/
 */
export function getPlacementImage(folder: string): ImageMetadata | null {
  const prefix = folder.endsWith('/') ? folder : folder + '/';
  const match = Object.keys(imageMap)
    .filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
    .sort()[0];
  return match ? imageMap[match] : null;
}

/**
 * Get all images from a folder, sorted by filename.
 * Used for galleries where multiple images are needed.
 */
export function getFolderImages(folder: string): ImageMetadata[] {
  const prefix = folder.endsWith('/') ? folder : folder + '/';
  return Object.keys(imageMap)
    .filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
    .sort()
    .map(k => imageMap[k]);
}

// ---------------------------------------------------------------------------
// Convenience functions
// ---------------------------------------------------------------------------

export function getHomeHero(): ImageMetadata | null {
  return getPlacementImage('home-hero');
}

export function getInnerHero(): ImageMetadata | null {
  return getPlacementImage('inner-hero');
}

export function getServiceAreasBackground(): ImageMetadata | null {
  return getPlacementImage('service-areas')
    || getInnerHero()
    || getHomeHero();
}

export function getLogo(): ImageMetadata | null {
  return getPlacementImage('logo');
}

export function getHeadshot(): ImageMetadata | null {
  return getPlacementImage('headshot');
}

/** Homepage gallery — all images in gallery/, sorted by filename */
export function getGalleryImages(): ImageMetadata[] {
  return getFolderImages('gallery');
}

/**
 * Service image by slug and placement.
 * Example: getServiceImage('plumbing-repairs', 'card')
 */
export function getServiceImage(
  slug: string,
  placement: 'card' | 'hero' | 'content'
): ImageMetadata | null {
  return getPlacementImage(`services/${slug}/${placement}`);
}

/**
 * Service gallery — per-service if images exist, otherwise homepage gallery.
 */
export function getServiceGalleryImages(slug: string): ImageMetadata[] {
  const serviceGallery = getFolderImages(`services/${slug}/gallery`);
  if (serviceGallery.length > 0) return serviceGallery;
  return getGalleryImages();
}

// ---------------------------------------------------------------------------
// Backward compatibility exports (used by some components during migration)
// ---------------------------------------------------------------------------

export const logoImage: ImageMetadata | null = getLogo();
export const headshotImage: ImageMetadata | null = getHeadshot();
