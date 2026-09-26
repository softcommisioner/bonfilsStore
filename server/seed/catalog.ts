import type { Business, Category, Product, UserRole } from '../../src/types';
import type { UserRecord } from '../db';

const NOW = Date.parse('2026-01-05T09:00:00.000Z');
const day = 24 * 60 * 60 * 1000;

function iso(offsetDays: number): string {
  return new Date(NOW + offsetDays * day).toISOString();
}

export const seedCategories: Category[] = [
  { id: 'CAT-01', name: 'Laptops & Computers', slug: 'laptops-computers', image: '/images/categories/laptops-computers.svg', description: 'Business laptops, workstations, desktops and computer accessories.', sortOrder: 1, isActive: true, createdAt: iso(0) },
  { id: 'CAT-02', name: 'CCTV & Security', slug: 'cctv-security', image: '/images/categories/cctv-security.svg', description: 'CCTV cameras, DVR/NVR kits, alarms and access control.', sortOrder: 2, isActive: true, createdAt: iso(0) },
  { id: 'CAT-03', name: 'Motorcycles & Accessories', slug: 'motorcycles-accessories', image: '/images/categories/motorcycles-accessories.svg', description: 'Motorcycles, electric scooters, spare parts and riding gear.', sortOrder: 3, isActive: true, createdAt: iso(0) },
  { id: 'CAT-04', name: 'Beauty & Cosmetics', slug: 'beauty-cosmetics', image: '/images/categories/beauty-cosmetics.svg', description: 'Skincare, hair care, grooming tools and salon equipment.', sortOrder: 4, isActive: true, createdAt: iso(0) },
  { id: 'CAT-05', name: 'Electronics', slug: 'electronics', image: '/images/categories/electronics.svg', description: 'Audio, drones, cameras, wearables and everyday gadgets.', sortOrder: 5, isActive: true, createdAt: iso(0) },
  { id: 'CAT-06', name: 'Phones & Tablets', slug: 'phones-tablets', image: '/images/categories/phones-tablets.svg', description: 'Smartphones, tablets, chargers, cases and screen protection.', sortOrder: 6, isActive: true, createdAt: iso(0) },
  { id: 'CAT-07', name: 'Smart Home & IoT', slug: 'smart-home-iot', image: '/images/categories/smart-home-iot.svg', description: 'Smart bulbs, locks, plugs, sensors and home automation hubs.', sortOrder: 7, isActive: true, createdAt: iso(0) },
  { id: 'CAT-08', name: 'Networking', slug: 'networking', image: '/images/categories/networking.svg', description: 'Routers, switches, extenders, cables and structured cabling.', sortOrder: 8, isActive: true, createdAt: iso(0) },
  { id: 'CAT-09', name: 'Solar & Electrical', slug: 'solar-electrical', image: '/images/categories/solar-electrical.svg', description: 'Solar panels, inverters, batteries, generators and power banks.', sortOrder: 9, isActive: true, createdAt: iso(0) },
  { id: 'CAT-10', name: 'Home & Kitchen', slug: 'home-kitchen', image: '/images/categories/home-kitchen.svg', description: 'Home appliances, kitchen equipment and household furniture.', sortOrder: 10, isActive: true, createdAt: iso(0) },
  { id: 'CAT-11', name: 'Fashion', slug: 'fashion', image: '/images/categories/fashion.svg', description: 'Men and women clothing, shoes, bags, watches and sunglasses.', sortOrder: 11, isActive: true, createdAt: iso(0) },
  { id: 'CAT-12', name: 'Tools & Hardware', slug: 'tools-hardware', image: '/images/categories/tools-hardware.svg', description: 'Power tools, hand tools, hardware, paints and building supplies.', sortOrder: 12, isActive: true, createdAt: iso(0) },
];

const CATEGORY_IMAGE: Record<string, string> = Object.fromEntries(
  seedCategories.map(category => [category.name, category.image as string]),
);

/**
 * Category restructure (18 -> 12). The storefront now exposes exactly the
 * twelve approved categories. Renames are applied to the stored category row
 * and to every product that referenced the old name, so no product is lost.
 */
export const CATEGORY_RENAMES: Record<string, string> = {
  'Security & Surveillance': 'CCTV & Security',
  'Motorcycles & Transport': 'Motorcycles & Accessories',
  'Beauty & Personal Care': 'Beauty & Cosmetics',
  'Consumer Electronics': 'Electronics',
  'Phones & Accessories': 'Phones & Tablets',
  'Networking Essentials': 'Networking',
  'Solar & Power': 'Solar & Electrical',
  'Home & Kitchen': 'Home & Kitchen',
  'Fashion & Watches': 'Fashion',
  'Tools & Hardware': 'Tools & Hardware',
};

/**
 * Categories dropped from the storefront navigation. They are deactivated
 * rather than deleted so the rows (and any product still pointing at them)
 * stay recoverable from the admin console.
 */
export const RETIRED_CATEGORIES: string[] = [
  'TV & Audio',
  'Gaming & Consoles',
  'Baby & Kids',
  'Sports & Outdoors',
  'Automotive',
  'Shipping & Freight',
];

/** Old category artwork slugs -> the slug that replaced them. */
export const LEGACY_CATEGORY_IMAGE_SLUGS: Record<string, string> = {
  'security-surveillance': 'cctv-security',
  'motorcycles-transport': 'motorcycles-accessories',
  'beauty-personal-care': 'beauty-cosmetics',
  'consumer-electronics': 'electronics',
  'phones-accessories': 'phones-tablets',
  'home-appliances': 'home-kitchen',
  'networking-essentials': 'networking',
  'solar-power-energy': 'solar-electrical',
  'fashion-watches': 'fashion',
  'tools-industrial-hardware': 'tools-hardware',
};

/** Rewrites `/images/categories/<old-slug>.svg` to the current slug. */
export function remapCategoryImageUrls(images: string[] | undefined): string[] | undefined {
  if (!Array.isArray(images) || images.length === 0) return images;
  let changed = false;
  const next = images.map(url => {
    const match = /^\/images\/categories\/([a-z0-9-]+)\.svg$/i.exec(url);
    const replacement = match ? LEGACY_CATEGORY_IMAGE_SLUGS[match[1]] : undefined;
    if (!replacement) return url;
    changed = true;
    return `/images/categories/${replacement}.svg`;
  });
  return changed ? next : images;
}

interface ProductSeed {
  id: string;
  businessId: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  originalPrice?: number;
  stock: number;
  images?: string[];
  rating?: number;
  reviewsCount?: number;
  salesCount?: number;
  shippingOrigin?: string;
  shippingTimeDays?: string;
  specifications?: Record<string, string>;
  isFeatured?: boolean;
  isActive?: boolean;
  createdOffsetDays?: number;
}

const RAW_PRODUCTS: ProductSeed[] = [
  // ---------------------------------------------------------------- laptops
  {
    id: 'PRD-100', businessId: 'BIZ-001', category: 'Laptops & Computers', brand: 'ThinkBook',
    title: 'ThinkBook 14 Plus 2-in-1 Laptop 16GB / 512GB SSD',
    description: 'Business-grade 14-inch 2-in-1 convertible with an AMD Ryzen 7 processor, 16GB of memory and a 512GB NVMe drive. The 360-degree hinge lets you work as a laptop or tablet, and the 71Wh battery covers a full working day.',
    price: 745, originalPrice: 899, stock: 24, rating: 4.8, reviewsCount: 41, salesCount: 96,
    shippingOrigin: 'Shenzhen / Kigali Stock', shippingTimeDays: '2 - 3 Days', isFeatured: true,
    specifications: {
      Processor: 'AMD Ryzen 7 5825U (8 cores / 16 threads)',
      Memory: '16GB DDR4 3200MHz (upgradeable to 32GB)',
      Storage: '512GB NVMe PCIe SSD',
      Display: '14" Full HD IPS 1920x1080 touchscreen, 300 nits',
      Battery: '71Wh, up to 12 hours mixed use',
      Weight: '1.65 kg',
    },
  },
  {
    id: 'PRD-101', businessId: 'BIZ-003', category: 'Laptops & Computers', brand: 'HPC-Office',
    title: 'HPC-Office 15.6" Quad-Core Business Laptop 8GB / 256GB',
    description: 'Reliable everyday business laptop for office work, online classes and accounting. A matte anti-glare screen, numeric keypad and full-size keyboard make it comfortable for long sessions.',
    price: 389, originalPrice: 445, stock: 40, rating: 4.5, reviewsCount: 63, salesCount: 152,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '1 - 2 Days',
    specifications: {
      Processor: 'Intel Celeron N95 Quad-Core',
      Memory: '8GB DDR4',
      Storage: '256GB SSD',
      Display: '15.6" HD anti-glare, 1366x768',
      Ports: '2x USB 3.0, HDMI, SD card reader, 3.5mm jack',
    },
  },
  {
    id: 'PRD-102', businessId: 'BIZ-004', category: 'Laptops & Computers', brand: 'Voltra',
    title: 'Voltra Gaming Laptop 15.6" RTX Graphics 16GB / 1TB SSD',
    description: 'Performance gaming laptop with a dedicated graphics card, 16GB of memory and a 1TB NVMe drive. Tuned for 1080p gaming, video editing and 3D work.',
    price: 1120, originalPrice: 1290, stock: 8, rating: 4.6, reviewsCount: 27, salesCount: 41,
    shippingOrigin: 'Shenzhen Direct Import', shippingTimeDays: '5 - 7 Days',
    specifications: {
      Processor: 'Intel Core i7-12700H (14 cores)',
      Graphics: 'Dedicated 6GB GDDR6 gaming GPU',
      Memory: '16GB DDR5',
      Storage: '1TB NVMe SSD',
      Display: '15.6" Full HD 144Hz IPS',
      Cooling: 'Dual fan, 3 heat pipes',
    },
  },
  {
    id: 'PRD-103', businessId: 'BIZ-001', category: 'Laptops & Computers', brand: 'Kioxia',
    title: 'Kioxia 1TB NVMe M.2 SSD + Installer Kit',
    description: 'Fast 1TB solid state drive for upgrading an existing laptop or desktop, supplied with a thermal pad and a precision screwdriver kit.',
    price: 62, stock: 120, rating: 4.7, reviewsCount: 88, salesCount: 210,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Capacity: '1TB', Interface: 'PCIe 4.0 x4 M.2 2280', Speed: 'Read 3500MB/s / Write 3000MB/s', Endurance: '600TBW' },
  },
  // ------------------------------------------------------------------- cctv
  {
    id: 'PRD-104', businessId: 'BIZ-002', category: 'CCTV & Security', brand: 'VisionPro',
    title: 'VisionPro 8-Channel 4K CCTV Kit with 8 Dome Cameras',
    description: 'Complete security installation for a home, shop or office: eight weatherproof dome cameras, an 8-channel 4K DVR with pre-installed 1TB drive, and all mounting accessories including PoE switches and cabling.',
    price: 520, originalPrice: 690, stock: 12, rating: 4.8, reviewsCount: 34, salesCount: 58,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days', isFeatured: true,
    specifications: {
      Cameras: '8x 4K dome, IP67 weatherproof, 20m IR night vision',
      Recorder: '8-channel 4K DVR with H.265+ compression',
      Storage: '1TB surveillance HDD pre-installed',
      Network: 'PoE switch included, remote mobile app access',
      Extras: 'Mounting brackets, cable catenary, power adapters',
    },
  },
  {
    id: 'PRD-105', businessId: 'BIZ-002', category: 'CCTV & Security', brand: 'GateEye',
    title: 'GateEye Wireless Video Doorbell with 1080p Camera',
    description: 'Battery powered video doorbell with a 1080p camera, two-way talk, motion alerts and a chime unit. Stores footage on a microSD card or optional cloud plan.',
    price: 54, originalPrice: 72, stock: 60, rating: 4.5, reviewsCount: 47, salesCount: 130,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Camera: '1080p, 150-degree view', Power: '5200mAh rechargeable, 4 months standby', Storage: 'MicroSD up to 128GB or cloud', Connectivity: '2.4GHz Wi-Fi, app notifications' },
  },
  {
    id: 'PRD-106', businessId: 'BIZ-004', category: 'CCTV & Security', brand: 'IronLock',
    title: 'IronLock Fingerprint Smart Door Lock with Access Log',
    description: 'Commercial grade smart lock supporting fingerprint, PIN card, mechanical key and app access. Stores up to 200 access records and works with a temporary guest code.',
    price: 168, originalPrice: 205, stock: 26, rating: 4.6, reviewsCount: 21, salesCount: 57,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Unlock: 'Fingerprint, PIN, IC card, app, mechanical key', Power: '8x AA batteries, low battery alert', Body: 'Zinc alloy, stainless steel bolt', Records: '200 access entries, app audit trail' },
  },
  // ------------------------------------------------------------- motorcycles
  {
    id: 'PRD-107', businessId: 'BIZ-004', category: 'Motorcycles & Accessories', brand: 'Kaze 125',
    title: 'Kaze 125cc Air-Cooled Single-Cylinder Motorcycle (CBS)',
    description: 'Durable 125cc commuter motorcycle designed for daily use in Kigali traffic. Air-cooled single cylinder, front and rear disc brakes with combined ABS, and a fuel tank range of roughly 300 km.',
    price: 1090, stock: 6, rating: 4.7, reviewsCount: 18, salesCount: 23,
    shippingOrigin: 'Consolidated China Import / Kigali Showroom', shippingTimeDays: '10 - 14 Days', isFeatured: true,
    specifications: { Engine: '125cc air-cooled single cylinder', Transmission: '5-speed manual', Brakes: 'Front disc + rear CBS', Fuel: '9.5L tank, ~300 km range', Weight: '115 kg' },
  },
  {
    id: 'PRD-108', businessId: 'BIZ-004', category: 'Motorcycles & Accessories', brand: 'Voltra E-Scooter',
    title: 'Voltra 48V Lithium Electric Scooter with Removable Battery',
    description: 'Zero-emission electric scooter with a removable 48V lithium battery, 120 km of range per charge and a removable seat. Includes a smart lock and reverse beeper.',
    price: 690, originalPrice: 760, stock: 9, rating: 4.6, reviewsCount: 12, salesCount: 19,
    shippingOrigin: 'Consolidated China Import / Kigali Showroom', shippingTimeDays: '10 - 14 Days',
    specifications: { Battery: '48V 20Ah removable lithium, swappable spare included', Range: 'Up to 120 km per charge', TopSpeed: '45 km/h', Brakes: 'Front disc + rear drum', Load: 'Up to 150 kg' },
  },
  {
    id: 'PRD-109', businessId: 'BIZ-002', category: 'Motorcycles & Accessories', brand: 'RoadGrip',
    title: 'RoadGrip Full-Face Motorcycle Helmet with Visor',
    description: 'Full-face helmet with an anti-scratch visor, removable washable liner, dual D-ring strap and ventilation channels. ECE 22.06 certified shell.',
    price: 68, originalPrice: 84, stock: 55, rating: 4.4, reviewsCount: 39, salesCount: 96,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 - 2 Days',
    specifications: { Shell: 'ABS + EPS, ECE 22.06', Visor: 'Anti-scratch, UV protected, tool-free swap', Liner: 'Removable washable mesh and padding', Sizes: 'M (55-56cm), L (57-58cm), XL (59-60cm)' },
  },
  // ----------------------------------------------------------------- beauty
  {
    id: 'PRD-110', businessId: 'BIZ-002', category: 'Beauty & Cosmetics', brand: 'GlowLab',
    title: 'GlowLab Vitamin C Brightening Serum 30ml',
    description: 'Daily brightening serum with 15% vitamin C, ferulic acid and hyaluronic acid. Lightweight fast-absorbing texture suitable for all skin types. Dermatologically tested and paraben free.',
    price: 24, originalPrice: 31, stock: 140, rating: 4.7, reviewsCount: 76, salesCount: 210,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days', isFeatured: true,
    specifications: { Volume: '30ml', KeyIngredients: '15% L-Ascorbic Acid, Ferulic Acid, Hyaluronic Acid', Use: 'Morning, before sunscreen', ShelfLife: '12 months unopened' },
  },
  {
    id: 'PRD-111', businessId: 'BIZ-002', category: 'Beauty & Cosmetics', brand: 'SilkWave',
    title: 'SilkWave 1800W Ionic Hair Dryer',
    description: 'Professional hair dryer with ionic anti-static technology, three heat settings, two speed settings and a cool shot button. Includes diffuser and concentrator nozzles.',
    price: 42, originalPrice: 55, stock: 48, rating: 4.6, reviewsCount: 44, salesCount: 118,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Power: '1800W', Technology: 'Ionic anti-static, 2 speed / 3 heat', Cord: '2m with cable tidy', Accessories: 'Diffuser, concentrator nozzle' },
  },
  {
    id: 'PRD-112', businessId: 'BIZ-002', category: 'Beauty & Cosmetics', brand: 'PureGlow',
    title: 'PureGlow Herbal Hair Growth Oil 100ml',
    description: 'Herbal scalp and hair oil with amla, bhringraj and brahmi extracts. Helps reduce breakage and supports healthy growth. Suitable for all hair types.',
    price: 17, stock: 165, rating: 4.5, reviewsCount: 92, salesCount: 264,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Volume: '100ml', Ingredients: 'Amla, Bhringraj, Brahmi, Coconut Oil', Use: 'Massage into scalp twice weekly', Packaging: 'Dark glass dropper bottle' },
  },
  // -------------------------------------------------------- electronics
  {
    id: 'PRD-113', businessId: 'BIZ-003', category: 'Electronics', brand: 'AeroMax',
    title: 'AeroMax Mini 4K Action Camera with Waterproof Case',
    description: 'Palm-sized action camera with a 4K sensor, front display and a 10m waterproof case. Includes a helmet mount, bike mount, 2 batteries and a dual charger.',
    price: 98, originalPrice: 128, stock: 32, rating: 4.6, reviewsCount: 58, salesCount: 141,
    shippingOrigin: 'Shenzhen / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Video: '4K30 / 1080p60 with stabilization', Display: '2-inch rear + 1.4-inch front', Battery: '2x 1100mAh included', Waterproof: '10m case included', Accessories: 'Helmet mount, bike mount, dual charger' },
  },
  {
    id: 'PRD-114', businessId: 'BIZ-003', category: 'Electronics', brand: 'SoundPeak',
    title: 'SoundPeak Bluetooth Party Speaker 200W with Trolley',
    description: 'Powered 200W party speaker with deep bass, karaoke microphone input, FM radio, USB/TF playback and TWS pairing. Battery powered with a telescopic trolley handle.',
    price: 185, originalPrice: 225, stock: 18, rating: 4.5, reviewsCount: 51, salesCount: 87,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Power: '200W RMS, 400W peak', Battery: '12V 9Ah, up to 8 hours', Inputs: 'Bluetooth 5.0, USB, TF, FM, AUX, MIC', Extras: 'Wireless microphone, LED ring, trolley handle' },
  },
  {
    id: 'PRD-115', businessId: 'BIZ-003', category: 'Electronics', brand: 'NovaFit',
    title: 'NovaFit Smartwatch AMOLED with Call and Health Tracking',
    description: 'AMOLED smartwatch with Bluetooth calling, message notifications, heart rate and SpO2 tracking, sleep monitoring and 100+ sport modes. Rated 5ATM for daily wear.',
    price: 59, originalPrice: 78, stock: 74, rating: 4.4, reviewsCount: 128, salesCount: 320,
    shippingOrigin: 'Shenzhen / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Display: '1.43" AMOLED 466x466', Battery: 'Up to 10 days typical use', Sensors: 'Heart rate, SpO2, accelerometer', WaterResistance: '5ATM', Compatibility: 'Android 6.0+ / iOS 11+' },
  },
  // ------------------------------------------------------------------- home
  {
    id: 'PRD-116', businessId: 'BIZ-004', category: 'Home & Kitchen', brand: 'HomeChef',
    title: 'HomeChef 5L Digital Air Fryer with 8 Presets',
    description: 'Digital air fryer with a 5L basket, eight cooking presets, dishwasher safe parts and a shake reminder. Ideal for chips, chicken wings, vegetables and reheating.',
    price: 78, originalPrice: 96, stock: 44, rating: 4.7, reviewsCount: 71, salesCount: 168,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days', isFeatured: true,
    specifications: { Capacity: '5L', Power: '1500W', Presets: '8 one-touch programs', Controls: 'Digital touch panel with timer', Cleaning: 'Dishwasher safe basket and tray' },
  },
  {
    id: 'PRD-117', businessId: 'BIZ-004', category: 'Home & Kitchen', brand: 'HomeChef',
    title: 'HomeChef 1.8L Cordless Electric Kettle',
    description: 'Double walled stainless steel electric kettle with a cool touch handle, boil-dry protection and a 360-degree base. 1.8L capacity suits a family of four.',
    price: 29, originalPrice: 36, stock: 96, rating: 4.6, reviewsCount: 84, salesCount: 231,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Capacity: '1.8L', Power: '1800W', Body: 'Double walled stainless steel', Safety: 'Auto shut-off, boil-dry protection' },
  },
  {
    id: 'PRD-118', businessId: 'BIZ-004', category: 'Home & Kitchen', brand: 'SteelLine',
    title: 'SteelLine 6-Piece Stainless Steel Pot Set',
    description: 'Six piece stainless steel cookware set with tri-ply base, tempered glass lids and stay-cool handles. Induction, gas and electric compatible.',
    price: 132, originalPrice: 158, stock: 22, rating: 4.8, reviewsCount: 33, salesCount: 66,
    shippingOrigin: 'Yiwu / Kigali Central Warehouse', shippingTimeDays: '2 - 3 Days',
    specifications: { Contents: '3 pots (20/24/28cm), 2 pans, 1 casserole', Base: 'Tri-ply stainless steel', Compatibility: 'Induction, gas, electric, ceramic', Handles: 'Riveted stay-cool stainless' },
  },
  // ---------------------------------------------------------------- iot/home automation
  {
    id: 'PRD-119', businessId: 'BIZ-001', category: 'Smart Home & IoT', brand: 'Bonfils Smart',
    title: 'Bonfils Smart Home Starter Kit (Hub + 2 Bulbs + 2 Plugs)',
    description: 'Everything needed to start automating a home: a Zigbee hub, two dimmable RGB bulbs and two energy monitoring smart plugs. Works with the Bonfils app, Alexa and Google Home.',
    price: 112, originalPrice: 139, stock: 30, rating: 4.7, reviewsCount: 56, salesCount: 118,
    shippingOrigin: 'Shenzhen / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Hub: 'Zigbee 3.0, Wi-Fi, works offline', Bulbs: '2x E27 RGB + dimmable, 16M colours', Plugs: '2x with energy monitoring, 16A', Automation: 'Scenes, schedules, app, Alexa, Google Home' },
  },
  {
    id: 'PRD-120', businessId: 'BIZ-001', category: 'Smart Home & IoT', brand: 'Bonfils Smart',
    title: 'Bonfils Smart Wi-Fi Door and Window Sensor',
    description: 'Compact door and window sensor that alerts your phone instantly when opened. Low battery consumption with a two-year battery life and optional hub pairing.',
    price: 19, stock: 130, rating: 4.5, reviewsCount: 42, salesCount: 97,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Connectivity: 'Wi-Fi or Zigbee (hub optional)', Power: '2x AAA, up to 2 years', Alerts: 'Instant push notification, history log', Mounting: 'Adhesive tape or screws included' },
  },
  {
    id: 'PRD-121', businessId: 'BIZ-001', category: 'Smart Home & IoT', brand: 'Bonfils Smart',
    title: 'Bonfils Smart 1080p Indoor Wi-Fi Camera with Pet Tracking',
    description: 'Indoor camera with 1080p full HD video, 355-degree rotation, two-way talk, night vision and AI pet detection that distinguishes people from animals.',
    price: 46, originalPrice: 58, stock: 52, rating: 4.6, reviewsCount: 37, salesCount: 84,
    shippingOrigin: 'Shenzhen / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { Video: '1080p, 355-degree pan, 15-degree tilt', Night: 'Infrared, up to 10m', Audio: 'Two-way talk, built-in mic and speaker', AI: 'Human and pet detection, motion zones', Storage: 'MicroSD up to 128GB or cloud' },
  },
  // ------------------------------------------------------------- networking
  {
    id: 'PRD-122', businessId: 'BIZ-002', category: 'Networking', brand: 'NetCore',
    title: 'NetCore Gigabit Wi-Fi 6 Router with 4 Antennas',
    description: 'Dual band Wi-Fi 6 router with a gigabit WAN port, four external antennas and MU-MIMO for dense homes and small offices. Easy app-based management.',
    price: 88, originalPrice: 110, stock: 36, rating: 4.6, reviewsCount: 49, salesCount: 132,
    shippingOrigin: 'Guangzhou / Kigali Stock', shippingTimeDays: '2 - 3 Days',
    specifications: { WiFi: 'Wi-Fi 6 dual band, AX1800 (1200Mbps + 300Mbps)', Ports: '1x Gigabit WAN, 3x Gigabit LAN, 1x USB', Features: 'MU-MIMO, OFDMA, WPA3, parental controls' },
  },
  {
    id: 'PRD-123', businessId: 'BIZ-002', category: 'Networking', brand: 'NetCore',
    title: 'NetCore 8-Port Gigabit Unmanaged Switch',
    description: 'Plug-and-play 8-port gigabit switch with fanless silent operation, ideal for expanding a home or office wired network.',
    price: 34, stock: 80, rating: 4.5, reviewsCount: 27, salesCount: 74,
    shippingOrigin: 'Kigali Local Warehouse', shippingTimeDays: '1 Day',
    specifications: { Ports: '8x Gigabit RJ45', Enclosure: 'Metal, fanless silent', Power: 'External 5V adapter, energy efficient' },
  },
  {
    id: 'PRD-124', businessId: 'BIZ-002', category: 'Networking', brand: 'NetCore',
    title: 'NetCore Cat6 Ethernet Cable 305m Bulk Roll',
    description: '305 metre bulk roll of solid copper Cat6 cable for structured cabling, camera runs and office networks. Supports up to 10Gbps at 55m.',
    price: 96, originalPrice: 118, stock: 25, rating: 4.7, reviewsCount: 18, salesCount: 43,
    shippingOrigin: 'Yiwu / Kigali Central Warehouse', shippingTimeDays: '2 - 3 Days',
    specifications: { Length: '305m bulk roll', Category: 'Cat6 UTP solid copper', Bandwidth: 'Up to 10Gbps at 55m', Jacket: 'PVC, 23AWG' },
  },
  // ------------------------------------------------------------------ solar
  {
    id: 'PRD-125', businessId: 'BIZ-001', category: 'Solar & Electrical', brand: 'Bonfils Energy',
    title: 'Bonfils 450W Monocrystalline Solar Panel (Tier 1 Cells)',
    description: 'Half-cut monocrystalline panel with 25-year performance warranty. Anti-PID and PID resistant, black frame and tempered glass, ideal for home and small business off-grid systems.',
    price: 215, originalPrice: 265, stock: 40, rating: 4.8, reviewsCount: 44, salesCount: 92,
    shippingOrigin: 'Yiwu / Kigali Central Warehouse', shippingTimeDays: '2 - 3 Days', isFeatured: true,
    specifications: { Power: '450W', Cells: '144 half-cut mono PERC, tier 1', Efficiency: '21.3% module efficiency', Warranty: '25 years performance, 12 years product', Frame: 'Black anodised aluminium, tempered glass' },
  },
  {
    id: 'PRD-126', businessId: 'BIZ-001', category: 'Solar & Electrical', brand: 'Bonfils Energy',
    title: 'Bonfils 5KVA Hybrid Solar Inverter with MPPT Charger',
    description: 'Hybrid inverter with built-in MPPT solar charge controller, dual AC output and Wi-Fi monitoring. Compatible with lithium and lead-acid batteries.',
    price: 380, originalPrice: 460, stock: 35, rating: 4.9, reviewsCount: 88, salesCount: 220,
    shippingOrigin: 'Guangzhou Direct Hub', shippingTimeDays: '2 - 3 Days',
    images: ['/images/products/power-generator.jpg'],
    specifications: { Capacity: '5000VA / 5000W', SolarInput: '500VDC max MPPT voltage', Battery: 'LiFePO4 and lead-acid compatible', Monitoring: 'Wi-Fi app with consumption history', Warranty: '2 years official Bonfils warranty' },
  },
  {
    id: 'PRD-127', businessId: 'BIZ-001', category: 'Solar & Electrical', brand: 'Bonfils Energy',
    title: 'Bonfils 5.12kWh LiFePO4 Battery Bank with BMS',
    description: 'Rack or wall mounted lithium iron phosphate battery module with a built-in battery management system. Over 6000 cycles and 80% capacity after 10 years.',
    price: 1240, originalPrice: 1390, stock: 7, rating: 4.8, reviewsCount: 29, salesCount: 36,
    shippingOrigin: 'Guangzhou Direct Hub', shippingTimeDays: '5 - 7 Days',
    specifications: { Capacity: '5.12kWh LiFePO4', Voltage: '51.2V', Cycles: 'Over 6000 cycles to 80%', Protection: 'Integrated BMS with CAN and RS485', Install: 'Wall mount or 19-inch rack' },
  },
  {
    id: 'PRD-128', businessId: 'BIZ-004', category: 'Solar & Electrical', brand: 'PowerGen China Pro',
    title: 'Super-Silent 3500W Digital Inverter Power Generator',
    description: 'Pure sine wave clean energy generator engineered for residential, commercial backup, and sensitive electronics. Ultra-quiet 58dB operational sound level.',
    price: 490, originalPrice: 590, stock: 14, rating: 4.9, reviewsCount: 42, salesCount: 78,
    shippingOrigin: 'Yiwu / Kigali Central Warehouse', shippingTimeDays: '1 - 2 Days',
    images: ['/images/products/power-generator.jpg'],
    specifications: {
      'Rated Output': '3200W (Max 3500W Peak Surge)',
      'Waveform': 'Pure Sine Wave (<2.5% THD)',
      'Fuel Tank': '8.5L with Eco-Throttle Economy Mode',
      'Noise Level': '58 dBA at 7 meters distance',
      'Starting': 'Electric Key Start + Recoil Backup',
    },
  },
  // ---------------------------------------------------------------- shipping
  {
    id: 'PRD-129', businessId: 'BIZ-001', category: 'Shipping & Freight', brand: 'Bonfils Logistics',
    title: 'Bonfils International Freight Air Shipping Credit ($100)',
    description: 'Direct procurement credit for consolidated air cargo from Guangzhou / Yiwu to Kigali. Guaranteed 7-10 business days delivery with full customs handling.',
    price: 95, originalPrice: 100, stock: 999, rating: 5.0, reviewsCount: 310, salesCount: 1450,
    shippingOrigin: 'China to Rwanda Express', shippingTimeDays: 'Instant Digital Voucher',
    images: ['/images/products/logistics-freight.jpg'],
    specifications: {
      'Service': 'Air Freight per Kilogram Offset',
      'Origin Hub': 'Guangzhou Baiyun / Yiwu Cargo Terminal',
      'Destination': 'Kigali International Airport Cargo Terminal',
      'Customs': 'Inclusive of Rwanda Customs Clearance',
    },
  },
  {
    id: 'PRD-130', businessId: 'BIZ-001', category: 'Shipping & Freight', brand: 'Bonfils Logistics',
    title: 'Bonfils China Warehouse Pickup & Consolidation Service',
    description: 'Send parcels to our Guangzhou or Yiwu warehouse address, consolidate them into one shipment and receive a single Kigali delivery. First 5kg free with every order.',
    price: 45, originalPrice: 60, stock: 999, rating: 4.9, reviewsCount: 156, salesCount: 640,
    shippingOrigin: 'Guangzhou / Yiwu Warehouse', shippingTimeDays: '7 - 12 Days',
    specifications: { Included: 'Free pickup within Guangzhou/Yiwu, 30 days storage', Consolidation: 'Up to 100kg per shipment', Delivery: 'Air 7-10 days, sea 30-45 days', Insurance: 'Optional cargo insurance from 1% of value' },
  },
];

function buildProduct(seed: ProductSeed): Product {
  const seller: Record<string, string> = {
    'BIZ-001': 'Bonfils Official Store',
    'BIZ-002': 'URUKUNDO SHOP',
    'BIZ-003': 'KEVIN ELECTRONICS',
    'BIZ-004': 'ABC IMPORTS',
  };
  const createdAt = iso(seed.createdOffsetDays ?? 0);
  return {
    id: seed.id,
    businessId: seed.businessId,
    sellerName: seller[seed.businessId] || 'Bonfils Official Store',
    isOfficial: seed.businessId === 'BIZ-001',
    title: seed.title,
    description: seed.description,
    category: seed.category,
    brand: seed.brand,
    price: seed.price,
    originalPrice: seed.originalPrice,
    stock: seed.stock,
    images: seed.images && seed.images.length ? seed.images : [CATEGORY_IMAGE[seed.category]],
    rating: seed.rating ?? 4.6,
    reviewsCount: seed.reviewsCount ?? 0,
    salesCount: seed.salesCount ?? 0,
    shippingOrigin: seed.shippingOrigin || 'Kigali Local Warehouse',
    shippingTimeDays: seed.shippingTimeDays || '1 - 2 Days',
    specifications: seed.specifications || {},
    isFeatured: seed.isFeatured ?? false,
    isActive: seed.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
  };
}

export const seedProducts: Product[] = RAW_PRODUCTS.map(buildProduct);

export const seedBusinesses: Business[] = [
  {
    id: 'BIZ-001', ownerId: '', name: 'Bonfils Official Store', type: 'official',
    description: 'Direct procurement and guaranteed original products from Bonfils International Logistics & China Sourcing Hub.',
    phone: '+250788100200', email: 'official@bonfilsstore.com', country: 'Rwanda', city: 'Kigali',
    rating: 4.9, reviewsCount: 342, totalProducts: 0, totalSales: 1250, isVerified: true, status: 'active',
    shippingTerms: 'Same day dispatch for Kigali; 24-48 hours nationwide. 100% Genuine Guaranteed.', createdAt: iso(0),
  },
  {
    id: 'BIZ-002', ownerId: '', name: 'URUKUNDO SHOP', type: 'external',
    description: 'Quality smart electronics, cameras, home security devices, and modern gadgets imported from verified tier-1 factories.',
    phone: '+250788555666', email: 'seller@bonfilsstore.com', country: 'Rwanda', city: 'Kigali',
    rating: 4.8, reviewsCount: 184, totalProducts: 0, totalSales: 630, isVerified: true, status: 'active',
    shippingTerms: 'Free delivery within Kigali for orders over $50.', createdAt: iso(0),
  },
  {
    id: 'BIZ-003', ownerId: '', name: 'KEVIN ELECTRONICS', type: 'external',
    description: 'Audio systems, drones, wireless equipment, and studio electronics with comprehensive warranty.',
    phone: '+250789222333', email: 'kevin.elec@bonfilsstore.com', country: 'Rwanda', city: 'Kigali',
    rating: 4.7, reviewsCount: 96, totalProducts: 0, totalSales: 310, isVerified: true, status: 'active',
    shippingTerms: 'Express delivery nationwide. Full 1-year replacement warranty.', createdAt: iso(0),
  },
  {
    id: 'BIZ-004', ownerId: '', name: 'ABC IMPORTS', type: 'external',
    description: 'Industrial generators, solar equipment, construction power tools, and direct container imports.',
    phone: '+250785444555', email: 'abc.imports@bonfilsstore.com', country: 'Rwanda', city: 'Kigali',
    rating: 4.9, reviewsCount: 78, totalProducts: 0, totalSales: 195, isVerified: true, status: 'active',
    shippingTerms: 'Heavy freight warehouse pickup or specialized flatbed delivery available.', createdAt: iso(0),
  },
];

export interface DemoUserSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: UserRole[];
  accountType: 'customer' | 'seller' | 'both';
  businessId?: string;
  password: string;
}

export const demoUsers: DemoUserSeed[] = [
  { id: 'USR-STAFF-001', name: 'Jean Claude (Sourcing Team)', email: 'staff@bonfilsstore.com', phone: '+250788300400', roles: ['staff'], accountType: 'customer', password: 'Staff@12345' },
  { id: 'USR-SELLER-001', name: 'Kevin Mugisha', email: 'seller@bonfilsstore.com', phone: '+250788555666', roles: ['customer', 'seller'], accountType: 'both', businessId: 'BIZ-002', password: 'Seller@12345' },
  { id: 'USR-BUYER-001', name: 'Aline Uwase', email: 'buyer@bonfilsstore.com', phone: '+250788777888', roles: ['customer'], accountType: 'customer', password: 'Buyer@12345' },
];

export function buildDemoUser(seed: DemoUserSeed, hash: string, salt: string): UserRecord {
  return {
    id: seed.id,
    name: seed.name,
    email: seed.email,
    phone: seed.phone,
    country: 'Rwanda',
    city: 'Kigali',
    roles: seed.roles,
    accountType: seed.accountType,
    isVerified: true,
    status: 'active',
    businessId: seed.businessId,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: iso(0),
  };
}
