import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const svgPath = path.join(publicDir, 'icon.svg');

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);

  const targets = [
    { file: 'pwa-192x192.png', size: 192 },
    { file: 'pwa-512x512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 },
    { file: 'apple-touch-icon-180x180.png', size: 180 },
    { file: 'favicon-32x32.png', size: 32 },
  ];

  for (const { file, size } of targets) {
    const dest = path.join(publicDir, file);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(dest);
    console.log(`Generated ${file} (${size}x${size})`);
  }

  // Copia favicon 32x32 para favicon.ico
  fs.copyFileSync(
    path.join(publicDir, 'favicon-32x32.png'),
    path.join(publicDir, 'favicon.ico')
  );
  console.log('Copied favicon.ico');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
