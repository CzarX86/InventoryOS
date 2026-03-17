/**
 * Gera os ícones PNG para o PWA a partir do SVG fonte.
 * Executa com: npm run generate-icons
 * Requer: npm install sharp -D
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../public/icons/icon.svg");
const outDir = resolve(__dirname, "../public/icons");

const svgBuffer = readFileSync(svgPath);

const sizes = [72, 96, 128, 144, 152, 192, 256, 384, 512];

console.log("Gerando ícones PWA...");

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(`${outDir}/icon-${size}x${size}.png`);
  console.log(`  ✓ icon-${size}x${size}.png`);
}

// Ícone maskable: padding de 20% para a safe zone do Android
const maskableSizes = [192, 512];
for (const size of maskableSizes) {
  const padding = Math.floor(size * 0.2);
  const innerSize = size - padding * 2;

  await sharp(svgBuffer)
    .resize(innerSize, innerSize)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 8, g: 8, b: 8, alpha: 1 }, // #080808
    })
    .png()
    .toFile(`${outDir}/icon-${size}x${size}-maskable.png`);
  console.log(`  ✓ icon-${size}x${size}-maskable.png`);
}

console.log("\nÍcones gerados em public/icons/");
