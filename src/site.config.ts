// ============================================================================
// SITE CONFIGURATION
// ============================================================================
// This is the ONLY file you need to edit to customize the template.
// All components read from this config — no hardcoded client data anywhere.
// ============================================================================

export interface SiteConfig {
  // Identity
  name: string;
  tagline: string;
  description: string;
  foundingYear: string;
  founder: string;
  url: string;

  // Schema.org
  schemaType: string;
  priceRange: string;

  // Contact
  phone: string;
  phoneRaw: string;
  whatsapp: string;
  whatsappMessage: string;
  email: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    coords: { lat: number; lng: number };
    mapsEmbed: string;
  };

  // Design
  theme: {
    primary: string;
    primaryLight: string;
    accent: string;
    accentLight: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    displayFont: string;  // Bold heading font (from font-registry.json)
    bodyFont: string;     // Readable body text font (from font-registry.json)
    accentFont?: string;  // Optional 3rd font for badges, stats, pull quotes (from font-registry.json)
  };

  // Navigation
  nav: Array<{ label: string; href: string }>;

  // Trust badges shown on homepage and service pages
  badges: Array<{ icon: string; label: string }>;

  // Services
  services: Array<{
    title: string;
    slug: string;
    description: string;
    shortDescription: string;
    features: string[];
    faqs: Array<{ question: string; answer: string }>;
    // Service subpage content
    heroSubtitle: string;
    longDescription: string;
    whatWeCover: Array<{ title: string; description: string }>;
    whyChooseUs: Array<{ bold: string; text: string }>;
  }>;

  // Homepage
  homepage: {
    title: string;
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    heroBadges?: string[];
    whyChooseTitle: string;
    whyChooseSubtitle: string;
    whyChooseCards: Array<{
      icon: string;
      iconSvg?: string; // Path to standalone SVG file (e.g., "/icons/experienced.svg"). Takes priority over icon path data.
      title: string;
      description: string;
    }>;
    faqs: Array<{ question: string; answer: string }>;
    // Service areas displayed on homepage (max 5 major suburbs/areas)
    serviceAreas?: Array<{
      name: string; // e.g. "Northern Suburbs", "Somerset West"
      suburbs?: string; // Optional comma-separated list of suburbs within
    }>;
    serviceAreasTitle?: string; // e.g. "Areas We Serve in Cape Town"
    serviceAreasSubtitle?: string; // e.g. "Professional plumbing across the Cape Peninsula"
    // Gallery / Recent Jobs section
    galleryTitle?: string; // e.g. "Our Recent Work"
    gallerySubtitle?: string; // e.g. "See the quality of our workmanship across Cape Town"
  };

  // About page
  about: {
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    heading: string;
    paragraphs: string[];
    badge: string;
    stats: Array<{ value: string; label: string }>;
  };

  // Contact page
  contact: {
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
    hours: {
      standard: { label: string; days: string; hours: string };
      emergency: { label: string; days: string; hours: string };
    };
    faqs: Array<{ question: string; answer: string }>;
  };

  // Reviews
  reviews: {
    metaTitle: string;
    metaDescription: string;
    averageRating: number;
    totalReviews: number;
    sourceSummary: string;
    googleMapsUrl?: string;
    items: Array<{
      name: string;
      text: string;
      rating: number;
      date?: string;
      service?: string;
      source?: string;
    }>;
  };

  // Services overview page
  servicesPage: {
    metaTitle: string;
    metaDescription: string;
    heroTitle: string;
    heroSubtitle: string;
  };

  // Pre-footer CTA banner (populated by design enhancer)
  ctaBanner?: {
    variant: 'full-bleed-accent' | 'split-image' | 'stats-bar' | 'testimonial-cta' | 'emergency-urgent' | 'map-cta';
    headline?: string;
    subtitle?: string;
  };

  // Legal
  legal: {
    registrations: string[];
    servicesList: string[];
  };
}

// ============================================================================
// PLAN ELITE KZN — Site Configuration
// ============================================================================
// Populated with client data. All components read from this config.
// ============================================================================

export const site: SiteConfig = {
  // Identity
  name: "Plan Elite KZN",
  tagline: "Dream Elite. Plan Elite. Build Elite.",
  description: "Architecture, construction, and interior design under one roof. Plan Elite KZN delivers premium property development across Durban and KwaZulu-Natal. NHBRC and SACAP registered.",
  foundingYear: "2016",
  founder: "Riaan Van Rooyen",
  url: "https://plan-elite-kzn.netlify.app",

  // Schema.org
  schemaType: "ProfessionalService",
  priceRange: "$$$",

  // Contact
  phone: "081 000 9096",
  phoneRaw: "0810009096",
  whatsapp: "27810009096",
  whatsappMessage: "Hi Plan Elite, I'd like to discuss a building or renovation project. Can you assist?",
  email: "riaan@elitecompanygroup.com",
  address: {
    street: "58 Inanda Rd, Waterfall",
    city: "Durban",
    region: "KwaZulu-Natal",
    postalCode: "3610",
    country: "ZA",
    coords: { lat: -29.8117, lng: 30.8467 },
    mapsEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3461.2!2d30.8467!3d-29.8117",
  },

  // Design
  theme: {
    primary: "#0E1235",
    primaryLight: "#1A1F4E",
    accent: "#C5943A",
    accentLight: "#D4AD5E",
    background: "#F5F3EF",
    surface: "#FFFFFF",
    text: "#0E1235",
    muted: "#5A5E7A",
    displayFont: "Montserrat",
    bodyFont: "Merriweather",
    // accentFont is optional — set during uniqueness enhancement (Phase 7.5)
  },

  // Navigation
  nav: [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services/" },
    { label: "About Us", href: "/about-us/" },
    { label: "Reviews", href: "/reviews/" },
    { label: "Contact", href: "/contact/" },
  ],

  // Trust badges
  badges: [
    { icon: '<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', label: "NHBRC Registered" },
    { icon: '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m9-14v4m0 0l-2-2m2 2l2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', label: "SACAP Accredited" },
    { icon: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', label: "10+ Years Experience" },
    { icon: '<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', label: "4.8\u2605 Google Rated" },
  ],

  // Services
  services: [
    {
      title: "Building & Construction in Durban, Umhlanga & Hillcrest",
      slug: "building-construction",
      description: "New builds, houses, granny flats, garages, additions, extensions, retaining walls, roofing, and painting across Durban and KZN. NHBRC registered and fully compliant.",
      shortDescription: "Complete new builds, additions, roofing, and painting — from foundation to final coat.",
      features: ["New Building (Houses, Granny Flats, Garages)", "Additions and Extensions", "Retaining Walls", "Roofing", "Painting"],
      faqs: [
        { question: "Are you registered with the NHBRC?", answer: "Yes. Plan Elite is fully registered with the National Home Builders Registration Council, which means every residential build we undertake is backed by the NHBRC warranty and meets all compliance requirements." },
        { question: "Can you handle the full build from plans to completion?", answer: "Absolutely. We manage the entire process — from architectural drawings and council approvals through to construction and final handover. Our in-house architects and engineers work alongside our construction team so nothing falls through the cracks." },
        { question: "How long does a typical new house build take?", answer: "A standard residential build generally takes between 4 and 8 months depending on the size, complexity, and any custom finishes. We provide a detailed timeline during the planning phase so you know exactly what to expect." },
        { question: "Do you build granny flats and garages as well?", answer: "Yes. Granny flats, garages, and outbuildings are a significant part of our portfolio. We handle all the drawings, approvals, and construction so the finished structure matches your main property seamlessly." },
      ],
      heroSubtitle: "Turnkey residential and commercial construction across Durban — NHBRC registered, architect-led, built to last.",
      longDescription: "<p>Plan Elite delivers end-to-end building and construction services across the greater Durban area. Whether you're building a new family home in Hillcrest, adding a granny flat in Pinetown, or extending your property in Umhlanga, our NHBRC-registered team manages every phase from plan approval to final handover.</p><ul><li>New residential builds \u2014 from single dwellings to multi-unit developments</li><li>Granny flats and garages with full plan submission</li><li>Home additions and seamless extensions</li><li>Retaining walls, boundary walls, and structural work</li><li>Complete roofing installation and repairs</li><li>Professional interior and exterior painting</li></ul><p>Every project is backed by SACAP-compliant architectural drawings, dedicated project management, and the quality assurance that comes with a decade of construction experience in KwaZulu-Natal.</p>",
      whatWeCover: [
        { title: "New Builds", description: "Houses, granny flats, and garages designed and constructed from the ground up with full architectural plans and NHBRC enrolment." },
        { title: "Additions & Extensions", description: "Seamless room additions, second-storey extensions, and property expansions that integrate with your existing structure." },
        { title: "Roofing & Painting", description: "Complete roof installations, re-roofing, waterproofing, and professional interior and exterior painting to finish the job." },
        { title: "Retaining Walls", description: "Engineered retaining walls for sloped properties, boundary solutions, and landscaping support — designed for Durban\'s terrain." },
      ],
      whyChooseUs: [
        { bold: "Architect-led builds", text: "— our in-house architects and engineers ensure every structure is designed correctly before a single brick is laid" },
        { bold: "NHBRC & CIDB registered", text: "— full regulatory compliance on every residential and commercial project" },
        { bold: "One team from plans to handover", text: "— no subcontractor juggling; our 13-member team manages the entire build lifecycle" },
      ],
    },
    {
      title: "Nutec & Wendy Houses in Durban, Pinetown & Ballito",
      slug: "nutec-wendy-houses",
      description: "Custom nutec houses from 1 to 4 bedrooms, wendy houses, guard huts, classrooms, workshops, offices, and storage sheds built and delivered across Durban and KZN.",
      shortDescription: "Durable nutec and wendy houses — from compact garden rooms to full 4-bedroom homes.",
      features: ["Nutec Houses (1-4 Bedroom)", "Wendy/Wood Houses", "Guard Huts", "Classrooms", "Workshops & Offices", "Sheds & Storage"],
      faqs: [
        { question: "What is the difference between nutec and wendy houses?", answer: "Nutec houses use fibre cement panels that are weather-resistant, termite-proof, and longer-lasting. Wendy houses are built from timber and are typically more affordable for basic storage or garden use. We build both and will recommend the best option for your needs and budget." },
        { question: "Can a nutec house be used as a main dwelling?", answer: "Yes. Our 2, 3, and 4-bedroom nutec houses are designed for full-time living with proper insulation, electrical wiring, and plumbing. They are a cost-effective alternative to brick-and-mortar construction." },
        { question: "How long does installation take?", answer: "Most nutec structures are completed within 2 to 4 weeks depending on size and complexity. Larger multi-bedroom units may take slightly longer, particularly if plumbing and electrical work are included." },
        { question: "Do you supply guard huts and site offices?", answer: "Yes. We build prefabricated guard huts, site offices, classrooms, and workshop structures for commercial and institutional clients across KZN." },
      ],
      heroSubtitle: "From garden sheds to full-size family homes — quality nutec and wendy house construction across Durban.",
      longDescription: "<p>Plan Elite builds high-quality nutec and wendy houses that provide practical, cost-effective living and working spaces. Whether you need a backyard granny flat, a rental unit, a security guard hut, or a full-sized family home, our nutec structures are engineered for durability in KwaZulu-Natal's subtropical climate.</p><ul><li>1 to 4 bedroom nutec houses for permanent living</li><li>Wendy houses and wood structures for gardens and yards</li><li>Guard huts and security kiosks</li><li>Portable classrooms and cr\u00e8che buildings</li><li>Home offices, workshops, and studios</li><li>Storage sheds and utility buildings</li></ul><p>All structures are built with fibre cement (nutec) boards that are termite-proof, fire-resistant, and low-maintenance. We handle everything from foundation preparation through to electrical and plumbing fit-out, delivering a complete, move-in-ready structure.</p>",
      whatWeCover: [
        { title: "Nutec Houses", description: "1 to 4-bedroom nutec houses for main dwelling or rental units, built with fibre cement panels and finished to a high standard." },
        { title: "Wendy & Wood Houses", description: "Timber-framed wendy houses ideal for garden rooms, extra bedrooms, or storage solutions." },
        { title: "Guard Huts & Classrooms", description: "Prefabricated structures for security companies, schools, and businesses — delivered and installed on-site." },
        { title: "Workshops, Offices & Sheds", description: "Practical workspace and storage structures for residential and commercial properties." },
      ],
      whyChooseUs: [
        { bold: "Built for Durban\'s climate", text: "— our nutec panels resist moisture, termites, and coastal salt air" },
        { bold: "Turnkey delivery", text: "— from design through to installation with electrical and plumbing if required" },
        { bold: "Versatile configurations", text: "— we build for families, businesses, schools, and developers" },
      ],
    },
    {
      title: "Paving & Landscaping in Durban, Umhlanga & Hillcrest",
      slug: "paving-landscaping",
      description: "Driveway paving, pool surrounds, commercial paving, and complete landscaping with instant grass supply and installation across Durban and KZN.",
      shortDescription: "Professional paving and landscaping — driveways, patios, gardens, and instant grass.",
      features: ["Driveway Paving", "Commercial Paving", "Pool & Patio Paving", "Walkway & Garden Paving", "Residential Landscaping", "Commercial & Estate Landscaping", "Instant Grass Supply & Installation"],
      faqs: [
        { question: "What types of paving do you offer?", answer: "We work with interlocking pavers, cobblestones, concrete slabs, and natural stone. The best option depends on your application — driveways require heavy-duty pavers while patios and pool surrounds allow for more decorative choices. We help you select the right material during consultation." },
        { question: "Do you supply and install instant grass?", answer: "Yes. We supply and install kikuyu, LM (Berea), and buffalo grass depending on your property\'s sun exposure and usage requirements. We prepare the soil, lay the turf, and advise on aftercare." },
        { question: "Can you handle large commercial landscaping projects?", answer: "Absolutely. We have completed landscaping for residential estates, commercial complexes, and retail precincts. Our team handles everything from hardscaping and irrigation to planting and instant turf installation." },
      ],
      heroSubtitle: "Transform your property with expert paving and professional landscaping across Durban.",
      longDescription: "<p>Plan Elite's paving and landscaping division transforms outdoor spaces across Durban. From a sleek new driveway in Umhlanga to a complete garden redesign in Hillcrest, we combine structural expertise with an eye for landscape design to deliver outdoor areas that are both functional and striking.</p><ul><li>Driveway paving \u2014 cobblestone, brick, concrete pavers, and exposed aggregate</li><li>Pool and patio surround paving for seamless entertaining areas</li><li>Garden walkways, paths, and stepping stones</li><li>Commercial paving for parking areas and retail precincts</li><li>Full residential and estate landscaping</li><li>Instant grass supply and professional installation</li></ul><p>Every paving project starts with proper preparation \u2014 excavation, compaction, and drainage planning \u2014 to ensure a long-lasting, level finish that handles Durban's heavy summer rains.</p>",
      whatWeCover: [
        { title: "Driveway & Commercial Paving", description: "Interlocking, cobblestone, and concrete paving for driveways, parking areas, and commercial premises." },
        { title: "Pool & Patio Paving", description: "Non-slip paving for pool surrounds, patios, and entertainment areas using decorative stone and paver options." },
        { title: "Landscaping & Instant Grass", description: "Full residential and commercial landscaping including garden design, planting, soil preparation, and instant turf installation." },
      ],
      whyChooseUs: [
        { bold: "End-to-end outdoor solutions", text: "— we handle paving, planting, irrigation, and turf in a single project" },
        { bold: "Quality materials", text: "— we source premium pavers and turf suited to Durban\'s subtropical conditions" },
      ],
    },
    {
      title: "Tiling & Flooring in Durban, Pinetown & Umhlanga",
      slug: "tiling-flooring",
      description: "Residential and commercial tiling, kitchen and bathroom tiling, new tile installation, and epoxy flooring across Durban. Precision finishing from Plan Elite KZN.",
      shortDescription: "Expert tiling and epoxy flooring for homes, kitchens, bathrooms, and commercial spaces.",
      features: ["New Tile Installation", "Residential House Tiling", "Kitchen Tiling", "Bathroom Tiling", "Commercial & Retail Tiling", "Epoxy Flooring"],
      faqs: [
        { question: "Do you supply the tiles or do I need to buy my own?", answer: "We can work either way. Many clients prefer to select their own tiles, and we are happy to advise on quantities and suitability. We can also source tiles on your behalf from trusted Durban suppliers." },
        { question: "What is epoxy flooring and where is it used?", answer: "Epoxy flooring is a seamless, high-durability coating applied over concrete. It is ideal for garages, workshops, showrooms, and commercial spaces where a hard-wearing, easy-to-clean surface is needed. We apply industrial-grade epoxy systems that last." },
        { question: "Can you tile over existing floors?", answer: "In many cases, yes. We assess the condition of your existing floor and advise whether tiling over is viable or whether removal is necessary for the best result. Proper preparation is key to a lasting finish." },
      ],
      heroSubtitle: "Precision tiling and modern epoxy flooring for Durban homes and commercial properties.",
      longDescription: "<p>Plan Elite's tiling and flooring team delivers precision tile work and seamless epoxy coatings for residential and commercial properties. Whether you're renovating a bathroom in Durban North, retiling a kitchen in Pinetown, or coating a warehouse floor in Umhlanga, we bring the expertise and attention to detail that premium finishes demand.</p><ul><li>Floor and wall tiling for new builds and renovations</li><li>Kitchen tiling \u2014 floors, splashbacks, and feature walls</li><li>Bathroom tiling with full waterproofing</li><li>Commercial tiling for retail, office, and hospitality spaces</li><li>Epoxy flooring for garages, workshops, and industrial floors</li><li>Large-format and porcelain tile installation</li></ul><p>All tiling is completed with proper substrate preparation, waterproofing where required, and precision grouting for a clean, lasting finish.</p>",
      whatWeCover: [
        { title: "Residential Tiling", description: "Full-house, kitchen, and bathroom tiling with precision cutting and waterproof finishing." },
        { title: "Commercial Tiling", description: "Large-scale tiling for retail spaces, offices, and commercial buildings with durable, high-traffic materials." },
        { title: "Epoxy Flooring", description: "Seamless epoxy floor coatings for garages, workshops, showrooms, and industrial environments." },
      ],
      whyChooseUs: [
        { bold: "Precision craftsmanship", text: "— our tilers work to exact tolerances with clean grout lines and level finishes" },
        { bold: "All floor types covered", text: "— from delicate mosaic work to heavy-duty epoxy coatings, we handle it all" },
      ],
    },
    {
      title: "Awnings & Lapas in Durban, Hillcrest & Ballito",
      slug: "awnings-lapas",
      description: "Fixed, retractable, and louvre awnings plus custom lapas, re-thatching, and upgrades across Durban. Outdoor living solutions from Plan Elite KZN.",
      shortDescription: "Custom awnings and thatched lapas — shade, shelter, and outdoor entertainment solutions.",
      features: ["Fixed Awnings (Solid & Fabric)", "Louvre Awnings", "Retractable Awnings", "Folding Arm Awnings", "New Lapa Construction", "Lapa Repairs & Re-thatching", "Lapa Upgrades"],
      faqs: [
        { question: "What type of awning is best for Durban weather?", answer: "For Durban\'s combination of strong sun and coastal rain, we generally recommend solid fixed awnings or louvre systems for permanent installations. Retractable fabric awnings work well for entertainment areas where flexibility is preferred. We assess your property and usage before recommending." },
        { question: "How long does a lapa last before it needs re-thatching?", answer: "A well-built lapa typically lasts 8 to 15 years before the thatch needs replacing, depending on exposure to weather and maintenance. We build new lapas and also handle re-thatching and structural repairs on existing ones." },
        { question: "Can you build a lapa with a built-in braai area?", answer: "Yes. Many of our lapa projects include integrated braai areas, bar counters, and seating. We handle the structural design, thatching, and all masonry work as a single project." },
      ],
      heroSubtitle: "Elegant awnings and traditional lapas for Durban outdoor living — built to withstand the coast.",
      longDescription: "<p>Plan Elite designs and installs premium awnings and thatched lapas that extend your usable outdoor space. Durban's subtropical climate is perfect for outdoor living, and the right shade structure transforms a patio, pool area, or garden into a year-round entertaining space.</p><ul><li>Fixed awnings \u2014 solid and fabric options for permanent shade</li><li>Louvre awning systems with adjustable blades for light and airflow control</li><li>Retractable fabric awnings for flexible coverage</li><li>Folding-arm awnings for balconies and shopfronts</li><li>New thatched lapa construction with optional braai areas</li><li>Lapa repair, re-thatching, and structural upgrades</li></ul><p>Whether you want a sleek modern awning over your patio or a traditional thatched lapa in your garden, we handle the design, construction, and finishing to create a space that suits your lifestyle and complements your property.</p>",
      whatWeCover: [
        { title: "Awning Installations", description: "Fixed, louvre, retractable, and folding arm awnings in fabric and solid options for patios, storefronts, and entertainment areas." },
        { title: "New Lapa Construction", description: "Custom-designed thatched lapas with optional braai areas, bar counters, and integrated seating for outdoor entertainment." },
        { title: "Lapa Repairs & Re-thatching", description: "Structural repairs, re-thatching, and upgrades to existing lapas — extending the life of your outdoor structure." },
      ],
      whyChooseUs: [
        { bold: "Coastal-grade construction", text: "— our structures are engineered for Durban\'s humidity, wind, and salt air exposure" },
        { bold: "Complete outdoor solutions", text: "— we combine awnings, lapas, paving, and landscaping into one cohesive project" },
      ],
    },
    {
      title: "Cladding & Walling in Durban, Umhlanga & Pinetown",
      slug: "cladding-walling",
      description: "Precast walling, stone cladding, brick cladding, wood cladding, vinyl cladding, and fiber cement cladding across Durban. Transform your property exterior with Plan Elite KZN.",
      shortDescription: "Premium cladding and walling solutions — precast walls, stone, brick, wood, and fibre cement.",
      features: ["Precast Walling (New & Extensions)", "Wood Cladding", "Dash Cladding", "Brick Cladding", "Vinyl Cladding", "Stone Cladding", "Pebble Cladding", "Fiber Cement Cladding"],
      faqs: [
        { question: "What is the most durable cladding option for coastal Durban?", answer: "Fibre cement and stone cladding are the most durable choices for coastal properties. Both resist moisture, salt air, and UV exposure. We assess your property and budget before recommending the best material for your situation." },
        { question: "Can you extend an existing precast wall?", answer: "Yes. We regularly extend and raise precast boundary walls. We match the existing panel style where possible and handle all structural reinforcement required for the extension." },
        { question: "How does cladding improve my property?", answer: "Cladding transforms the exterior appearance of a building, increases weather protection, improves insulation, and can significantly raise property value. It is one of the most cost-effective ways to modernise an older structure." },
        { question: "Do you offer stone and brick cladding?", answer: "Yes. We install natural stone, manufactured stone, and brick slip cladding. Each option offers a different aesthetic — from rustic natural stone to clean modern brick lines. We help you choose during the design consultation." },
      ],
      heroSubtitle: "Transform your property with premium cladding and professional walling solutions across Durban.",
      longDescription: "<p>Plan Elite's cladding and walling division transforms building exteriors and boundary walls across Durban. Whether you're upgrading a tired facade in Umhlanga, installing a new precast boundary wall in Pinetown, or adding stone cladding to a feature wall in Hillcrest, we deliver finishes that elevate your property's appearance and value.</p><ul><li>Precast walling \u2014 new installations and extensions for boundary security</li><li>Natural stone and pebble cladding for feature walls and facades</li><li>Brick and dash cladding for textured, architectural finishes</li><li>Wood cladding for warm, natural aesthetics</li><li>Vinyl and fibre cement cladding for low-maintenance durability</li><li>Complete facade upgrades and exterior makeovers</li></ul><p>Every cladding project is tailored to your property's architectural style and Durban's coastal conditions, using materials that resist moisture, salt air, and UV exposure for a finish that looks premium for years to come.</p>",
      whatWeCover: [
        { title: "Precast Walling", description: "New precast boundary walls and extensions — including panel matching, pillar reinforcement, and gate integration." },
        { title: "Stone & Brick Cladding", description: "Natural stone, manufactured stone, brick slip, and pebble cladding for feature walls, facades, and full exterior transformations." },
        { title: "Wood, Vinyl & Fibre Cement", description: "Lightweight cladding options for modern, contemporary, and coastal property styles — durable and low-maintenance." },
        { title: "Dash Cladding", description: "Traditional dash plaster finishes for boundary walls and building exteriors with a textured, durable surface." },
      ],
      whyChooseUs: [
        { bold: "Material expertise", text: "— we work with every major cladding type and advise on the best option for your property and climate" },
        { bold: "Aesthetic transformation", text: "— our cladding installations dramatically improve kerb appeal and property value" },
        { bold: "Structural integrity first", text: "— all walling includes proper foundations, reinforcement, and waterproofing where required" },
      ],
    },
  ],

  // Homepage
  homepage: {
    title: "Home",
    metaTitle: "Plan Elite KZN | Durban Builders & Construction | NHBRC Registered",
    metaDescription: "Plan Elite KZN \u2014 NHBRC-registered builders and SACAP-accredited architects in Durban. New builds, renovations, nutec houses, paving, tiling, awnings, and cladding. 10 years of premium construction. Call 081 000 9096.",
    heroTitle: "Plan Elite KZN \u2014 Durban\u2019s Premier Building & Construction Specialists",
    heroSubtitle: "Dream Elite \u2014 Plan Elite \u2014 Build Elite. From architectural plans to final handover, we deliver premium new builds, renovations, and property upgrades across the greater Durban area.",
    heroBadges: ["NHBRC Registered", "SACAP Accredited", "10 Years Experience", "4.8\u2605 Google Rated"],
    whyChooseTitle: "Why Durban Trusts Plan Elite",
    whyChooseSubtitle: "Architecture, construction, and finishing \u2014 all under one roof. Here's what sets us apart.",
    whyChooseCards: [
      {
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        title: "NHBRC & SACAP Registered",
        description: "Fully registered with the National Home Builders Registration Council and the South African Council for the Architectural Profession. Your project is compliant from day one.",
      },
      {
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1",
        title: "Full-Service Under One Roof",
        description: "Architecture, engineering, construction, and interior design from a single team. No coordinating between multiple contractors \u2014 one company, one point of contact.",
      },
      {
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
        title: "A Decade of Excellence",
        description: "Established in 2016, Plan Elite has delivered over 45 projects across KwaZulu-Natal. A proven track record in residential, commercial, and industrial construction.",
      },
      {
        icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
        title: "4.8-Star Google Rating",
        description: "Rated 4.8 out of 5 on Google with 20+ verified reviews. Our clients consistently praise our professionalism, quality workmanship, and clear communication.",
      },
      {
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
        title: "Professional 13-Person Team",
        description: "A dedicated team of architects, engineers, project managers, and tradespeople. Every discipline you need for a successful build, working together from the outset.",
      },
    ],
    faqs: [
      { question: "What areas does Plan Elite serve in KwaZulu-Natal?", answer: "We serve the entire greater Durban area including Pinetown, Hillcrest, Bluff, Umhlanga, Ballito, Durban North, and the KZN South Coast. Our KZN Construction Manager oversees all projects in the region." },
      { question: "Do you handle the building plans and council approvals?", answer: "Yes. Plan Elite manages the full process from SACAP-compliant architectural drawings through to municipal plan submission and approval. You don't need to hire a separate architect or town planner." },
      { question: "How do I get a quote for my project?", answer: "Contact us on 081 000 9096 or send a WhatsApp message. We'll arrange a site visit, discuss your requirements, and provide a detailed, no-obligation quotation within a few business days." },
      { question: "Can you handle both the design and the construction?", answer: "Absolutely. That's our core strength. Plan Elite is both a SACAP-accredited architectural firm and an NHBRC-registered builder. We take your project from concept sketches and 3D renders through to construction and final handover \u2014 no gaps between design intent and built reality." },
      { question: "Are your builders NHBRC registered?", answer: "Yes. Plan Elite is fully registered with the National Home Builders Registration Council. This means every new residential build we undertake is enrolled with the NHBRC and covered by the mandatory 5-year structural warranty." },
      { question: "What types of projects do you take on?", answer: "We handle a wide range \u2014 from new residential homes and granny flats to commercial buildings, nutec houses, paving, tiling, awnings, lapas, and exterior cladding. Whether it's a complete new build or a specific finishing trade, we have the expertise and team to deliver." },
    ],
    serviceAreasTitle: "Areas We Serve Across Durban",
    serviceAreasSubtitle: "Premium building and construction services across the greater Durban area and KwaZulu-Natal.",
    serviceAreas: [
      { name: "Durban Central & Surrounds", suburbs: "Durban CBD, Berea, Morningside, Glenwood, Musgrave" },
      { name: "Pinetown & Hillcrest", suburbs: "Pinetown, Hillcrest, Kloof, Gillitts, Waterfall" },
      { name: "Durban North & Umhlanga", suburbs: "Durban North, Umhlanga, La Lucia, Mount Edgecombe, Umdloti" },
      { name: "Ballito & North Coast", suburbs: "Ballito, Salt Rock, Zimbali, Shaka's Rock, Umhlali" },
      { name: "Bluff & South Coast", suburbs: "Bluff, Amanzimtoti, Warner Beach, Scottburgh, Margate" },
    ],
    galleryTitle: "Our Recent Projects",
    gallerySubtitle: "A selection of completed builds and renovations across Durban and KwaZulu-Natal.",
    valueStrip: [
      { label: "Free Consultation", value: "No Obligation", icon: "📋" },
      { label: "NHBRC Registered", value: "Full Warranty", icon: "🛡️" },
      { label: "Turnkey Projects", value: "Plans to Keys", icon: "🏗️" },
    ],
  },

  // About page
  about: {
    metaTitle: "About Plan Elite KZN | Durban Builders Since 2016",
    metaDescription: "Learn about Plan Elite KZN \u2014 NHBRC-registered builders and SACAP-accredited architects serving Durban since 2016. Meet our 13-person team of architects, engineers, and construction professionals.",
    heroTitle: "About Plan Elite KZN",
    heroSubtitle: "Architecture, construction, and design excellence since 2016",
    heading: "Our Story",
    paragraphs: [
      "Plan Elite was founded in 2016 with a clear vision: to bring architecture, construction, and interior design together under one roof. Too many building projects suffer from miscommunication between architects, engineers, and contractors. We set out to eliminate those gaps by offering the full journey \u2014 from the first conceptual sketch to the final coat of paint.",
      "Today, our team of 13 professionals includes architects, engineers, draughtsmen, project managers, and dedicated construction managers across KwaZulu-Natal. Led by Director and Head of Construction Riaan Van Rooyen, we deliver residential new builds, commercial developments, renovations, and specialist finishing work including paving, tiling, awnings, lapas, and exterior cladding.",
      "Every Plan Elite project is backed by our NHBRC registration and SACAP accreditation \u2014 the two most important industry credentials in South African building and architecture. With over 45 completed projects and a 4.8-star Google rating, our reputation is built on quality workmanship, clear communication, and delivering on our promises.",
    ],
    badge: "Est. 2016",
    stats: [
      { value: "10+", label: "Years in Business" },
      { value: "45+", label: "Projects Completed" },
      { value: "13", label: "Team Members" },
      { value: "4.8\u2605", label: "Google Rating" },
    ],
  },

  // Contact page
  contact: {
    metaTitle: "Contact Plan Elite KZN | Get a Building Quote in Durban",
    metaDescription: "Contact Plan Elite KZN for a free building or renovation quote in Durban. Call 081 000 9096, WhatsApp us, or visit our office at 58 Inanda Rd, Waterfall. NHBRC registered.",
    heroTitle: "Get In Touch",
    heroSubtitle: "Ready to start your project? Contact Plan Elite for a free, no-obligation consultation and quote.",
    hours: {
      standard: { label: "Business Hours", days: "Monday \u2013 Saturday", hours: "07:30 \u2013 17:00" },
      emergency: { label: "Sunday", days: "Sunday", hours: "Closed" },
    },
    faqs: [
      { question: "What is the fastest way to reach Plan Elite?", answer: "The quickest way is to call us directly on 081 000 9096 or send a WhatsApp message. We respond to all enquiries within the same business day." },
      { question: "Do you offer free quotes?", answer: "Yes. We provide free, no-obligation quotes for all projects. We'll arrange a site visit to assess your requirements and provide a detailed written quotation." },
      { question: "Where is your office located?", answer: "Our office is at 58 Inanda Rd, Waterfall, Durban, 3610. We're open Monday to Saturday, 07:30 to 17:00. You're welcome to visit by appointment." },
      { question: "Can I see examples of your previous work?", answer: "Absolutely. We can share a portfolio of completed projects relevant to your type of build. Visit our Reviews page or follow us on Facebook and Instagram to see our latest work." },
    ],
  },

  // Reviews
  reviews: {
    metaTitle: "Customer Reviews | Plan Elite KZN Durban Builders",
    metaDescription: "Read verified customer reviews for Plan Elite KZN. Rated 4.8/5 on Google with 20+ reviews. NHBRC-registered builders and SACAP-accredited architects in Durban.",
    averageRating: 4.8,
    totalReviews: 22,
    sourceSummary: "Rated 4.8/5 from 22 reviews across Google and Facebook",
    googleMapsUrl: "https://www.google.com/maps/place/?q=place_id:ChIJEduZ09PE70oR4xjw8suDXUw",
    items: [
      {
        name: "Christopher Jackson",
        text: "These guys take engineering and architecture to another level! Definitely recommend them!",
        rating: 5,
        date: "2024-03-16",
        source: "facebook",
      },
    ],
  },

  // Services overview page
  servicesPage: {
    metaTitle: "Our Services | Plan Elite KZN Durban Builders & Construction",
    metaDescription: "Explore Plan Elite KZN's full range of building and construction services in Durban \u2014 new builds, nutec houses, paving, tiling, awnings, lapas, cladding, and more. NHBRC registered. Call 081 000 9096.",
    heroTitle: "Our Services",
    heroSubtitle: "From architectural plans to polished finishes \u2014 Plan Elite delivers the complete building and construction solution across Durban.",
  },

  // Legal
  // Pre-footer CTA banner
  ctaBanner: {
    variant: 'stats-bar' as const,
    headline: "Ready to Build Your Dream Property in Durban?",
    subtitle: "Contact Plan Elite KZN for a free consultation with our architects and project managers.",
  },

  legal: {
    registrations: [
      "NHBRC Registered (National Home Builders Registration Council)",
      "SACAP Accredited (South African Council for the Architectural Profession)",
      "CIDB Registered (Construction Industry Development Board)",
    ],
    servicesList: [
      "Building & Construction",
      "Nutec & Wendy Houses",
      "Paving & Landscaping",
      "Tiling & Flooring",
      "Awnings & Lapas",
      "Cladding & Walling",
    ],
  },
};
