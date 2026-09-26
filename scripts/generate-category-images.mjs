/**
 * Generates one lightweight SVG illustration per marketplace category into
 * public/images/categories so that every seeded category and product has a
 * production-safe image that is served from the static build output.
 *
 * Usage: node scripts/generate-category-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'public', 'images', 'categories');

const CATEGORIES = [
  { slug: 'laptops-computers', label: 'Laptops & Computers', hue: 214, glyph: 'laptop' },
  { slug: 'cctv-security', label: 'CCTV & Security', hue: 8, glyph: 'cctv' },
  { slug: 'motorcycles-accessories', label: 'Motorcycles & Accessories', hue: 24, glyph: 'bike' },
  { slug: 'beauty-cosmetics', label: 'Beauty & Cosmetics', hue: 330, glyph: 'sparkle' },
  { slug: 'electronics', label: 'Electronics', hue: 262, glyph: 'device' },
  { slug: 'phones-tablets', label: 'Phones & Tablets', hue: 286, glyph: 'phone' },
  { slug: 'smart-home-iot', label: 'Smart Home & IoT', hue: 190, glyph: 'iot' },
  { slug: 'networking', label: 'Networking', hue: 205, glyph: 'network' },
  { slug: 'solar-electrical', label: 'Solar & Electrical', hue: 45, glyph: 'solar' },
  { slug: 'home-kitchen', label: 'Home & Kitchen', hue: 158, glyph: 'home' },
  { slug: 'fashion', label: 'Fashion', hue: 350, glyph: 'watch' },
  { slug: 'tools-hardware', label: 'Tools & Hardware', hue: 18, glyph: 'tool' },
  // Retired from the storefront navigation, but still rendered for the two
  // BONFILS Logistics service products that keep this category.
  { slug: 'shipping-freight', label: 'Shipping & Freight', hue: 228, glyph: 'ship' },
];

const GLYPHS = {
  laptop: `<rect x="196" y="196" width="208" height="128" rx="12" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M168 344h264l-18 26H186z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M232 236h136M232 268h92" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>`,
  cctv: `<path d="M186 214h132l26 34-26 34H186z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <circle cx="252" cy="248" r="16" fill="none" stroke="currentColor" stroke-width="9"/>
    <path d="M344 282l52 42M396 324l-34 10" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M170 356h260" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
  bike: `<circle cx="204" cy="304" r="52" fill="none" stroke="currentColor" stroke-width="10"/>
    <circle cx="396" cy="304" r="52" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M204 304l74-96 60 96H204l44-72h132l16 72" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M262 208h56" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
  sparkle: `<path d="M300 168c14 58 34 78 92 92-58 14-78 34-92 92-14-58-34-78-92-92 58-14 78-34 92-92z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M392 296c8 32 18 42 50 50-32 8-42 18-50 50-8-32-18-42-50-50 32-8 42-18 50-50z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>`,
  device: `<rect x="180" y="166" width="120" height="188" rx="16" fill="none" stroke="currentColor" stroke-width="10"/>
    <rect x="324" y="238" width="96" height="180" rx="14" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M216 200h48M216 226h48" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>`,
  home: `<path d="M168 268l132-112 132 112" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M196 258v134h208V258" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M272 392v-70h56v70" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>`,
  iot: `<circle cx="300" cy="262" r="46" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M236 322a92 92 0 01128 0M196 362a150 150 0 01208 0" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <circle cx="300" cy="262" r="8" fill="currentColor"/>`,
  network: `<circle cx="300" cy="176" r="30" fill="none" stroke="currentColor" stroke-width="10"/>
    <circle cx="186" cy="330" r="30" fill="none" stroke="currentColor" stroke-width="10"/>
    <circle cx="414" cy="330" r="30" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M300 206v58l-114 66M300 264l114 66" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
  solar: `<circle cx="392" cy="184" r="34" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M136 288l32-64h164l32 64z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M168 288v72M232 288v72M300 288v72M200 224l-20 64M264 224l-20 64M328 224l-20 64" stroke="currentColor" stroke-width="8"/>
    <path d="M136 360h228" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
  phone: `<rect x="238" y="152" width="124" height="216" rx="20" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M282 340h36" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M262 200h76M262 232h56" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>`,
  tv: `<rect x="156" y="188" width="288" height="168" rx="14" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M256 396h88M300 356v40" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M196 232h108M196 264h64" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>`,
  gamepad: `<path d="M196 244h208a56 56 0 0155 78l-16 40a34 34 0 01-56 12l-26-30H239l-26 30a34 34 0 01-56-12l-16-40a56 56 0 0155-78z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M214 278v44M192 300h44" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <circle cx="356" cy="284" r="12" fill="currentColor"/><circle cx="392" cy="312" r="12" fill="currentColor"/>`,
  watch: `<circle cx="300" cy="262" r="76" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M300 214v52l38 24" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M266 190l-16-64h100l-16 64M266 334l-16 64h100l-16-64" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>`,
  tool: `<path d="M346 168a72 72 0 00-96 96l-108 108a26 26 0 0037 37l108-108a72 72 0 0096-96l-46 46-40-40z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>`,
  baby: `<circle cx="300" cy="228" r="66" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M246 216h18M336 216h18" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M268 262a34 34 0 0064 0" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M212 372c22-44 48-66 88-66s66 22 88 66" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
  ball: `<circle cx="300" cy="282" r="96" fill="none" stroke="currentColor" stroke-width="10"/>
    <path d="M300 186v192M204 282h192M234 216l132 132M366 216L234 348" stroke="currentColor" stroke-width="8"/>`,
  car: `<path d="M160 300l40-76h200l40 76" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M136 300h328v44H136z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <circle cx="212" cy="348" r="26" fill="none" stroke="currentColor" stroke-width="10"/>
    <circle cx="388" cy="348" r="26" fill="none" stroke="currentColor" stroke-width="10"/>`,
  ship: `<path d="M156 300h288l-42 78H198z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M212 300v-52h96v52" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
    <path d="M260 248v-72l72 24" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M132 396h336" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>`,
};

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, char => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]
  ));
}

function buildSvg(category) {
  const { hue, label, glyph } = category;
  // Keep the caption inside the 600px canvas for the longer category names.
  const fontSize = label.length > 22 ? 34 : label.length > 18 ? 38 : 42;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 72% 96%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 28) % 360} 68% 88%)"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0v40" fill="none" stroke="hsl(${hue} 40% 80%)" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect width="600" height="600" fill="url(#grid)"/>
  <circle cx="300" cy="272" r="164" fill="hsl(${hue} 70% 98%)" opacity="0.9"/>
  <g style="color:hsl(${hue} 62% 32%)">${GLYPHS[glyph]}</g>
  <text x="300" y="512" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="hsl(${hue} 62% 24%)">${escapeXml(label)}</text>
  <text x="300" y="556" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="500" letter-spacing="4" fill="hsl(${hue} 40% 42%)">BONFILS STORE</text>
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const category of CATEGORIES) {
  const file = path.join(outDir, `${category.slug}.svg`);
  fs.writeFileSync(file, buildSvg(category), 'utf8');
}
console.log(`Generated ${CATEGORIES.length} category images in ${outDir}`);
