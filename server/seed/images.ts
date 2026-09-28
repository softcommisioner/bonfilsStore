/**
 * Catalogue imagery for the seeded demo data.
 *
 * Every entry was resolved to a real photograph and verified to return a
 * 200 image response. Sources are images.unsplash.com only, which is covered
 * by the Unsplash License and cleared for commercial use without attribution
 * (Unsplash+ / plus.unsplash.com photos were deliberately excluded).
 *
 * These stand in for supplier photography. Replace any value here - or,
 * better, upload the real photo through the admin console, which stores it
 * on Vercel Blob (or the media table) and writes the resulting URL into
 * products.images. Nothing in the UI hardcodes these URLs, so swapping them
 * needs no frontend change.
 */

export const PRODUCT_IMAGES: Record<string, string> = {
  'PRD-100': 'https://images.unsplash.com/flagged/photo-1576697010739-6373b63f3204?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-101': 'https://images.unsplash.com/photo-1576057121845-85eca73ce825?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-102': 'https://images.unsplash.com/photo-1600861195091-690c92f1d2cc?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-103': 'https://images.unsplash.com/photo-1653179767378-98bb414f9bfd?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-104': 'https://images.unsplash.com/photo-1515432085503-cabf2fbcd690?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-105': 'https://images.unsplash.com/photo-1626033324955-536b0c7777e4?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-106': 'https://images.unsplash.com/photo-1694931537878-f72883362711?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-107': 'https://images.unsplash.com/photo-1615812309036-e3aeba454bba?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-108': 'https://images.unsplash.com/photo-1614226170075-d338afcd9c53?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-109': 'https://images.unsplash.com/photo-1747174385293-8a383911c618?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-110': 'https://images.unsplash.com/photo-1710410815589-dd83514104d0?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-111': 'https://images.unsplash.com/photo-1773558057627-fed7a42b8520?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-112': 'https://images.unsplash.com/photo-1647507653704-bde7f2d6dbf0?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-113': 'https://images.unsplash.com/photo-1733325712555-b57138338aa0?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-114': 'https://images.unsplash.com/photo-1633431577706-595c31e64d50?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-115': 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-116': 'https://images.unsplash.com/photo-1657865462048-dff8684fb356?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-117': 'https://images.unsplash.com/photo-1768768772927-a44003c5e04a?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-118': 'https://images.unsplash.com/photo-1633241394397-927cc4ec0845?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-119': 'https://images.unsplash.com/photo-1532007271951-c487760934ae?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-120': 'https://images.unsplash.com/photo-1545063328-c8e3faffa16f?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-121': 'https://images.unsplash.com/photo-1731311982766-eae9b301d235?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-122': 'https://images.unsplash.com/photo-1726033589589-c4628bbba368?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-123': 'https://images.unsplash.com/photo-1653942897472-14f688bceba5?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-124': 'https://images.unsplash.com/photo-1544985562-128e7b377a21?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-125': 'https://images.unsplash.com/photo-1650866137641-4246da0f5f09?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-126': 'https://images.unsplash.com/photo-1765204974538-637e1b4d8584?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-127': 'https://images.unsplash.com/photo-1732030373864-d37573915751?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'PRD-130': 'https://images.unsplash.com/photo-1645736315000-6f788915923b?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  // Genuine local photographs already in public/images/products.
  'PRD-128': '/images/products/power-generator.jpg',
  'PRD-129': '/images/products/logistics-freight.jpg',
};

export const CATEGORY_IMAGES: Record<string, string> = {
  'Laptops & Computers': 'https://images.unsplash.com/photo-1595284843439-f963be7ed526?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'CCTV & Security': 'https://images.unsplash.com/photo-1663139237679-c9a7f99ff681?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Motorcycles & Accessories': 'https://images.unsplash.com/photo-1572746965401-cb4df8f9fa79?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Beauty & Cosmetics': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Electronics': 'https://images.unsplash.com/photo-1678852524356-08188528aed9?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Phones & Tablets': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Smart Home & IoT': 'https://images.unsplash.com/photo-1507646227500-4d389b0012be?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Networking': 'https://images.unsplash.com/photo-1639074064849-395cddbeec2d?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Solar & Electrical': 'https://images.unsplash.com/photo-1745162391671-244e8d3ccd5f?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Home & Kitchen': 'https://images.unsplash.com/photo-1503011510-c0e00592713b?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Fashion': 'https://images.unsplash.com/photo-1665501434820-50e45aeebfac?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
  'Tools & Hardware': 'https://images.unsplash.com/photo-1615974680408-a20e4a345341?w=900&h=900&fit=crop&crop=entropy&auto=format&q=80',
};
