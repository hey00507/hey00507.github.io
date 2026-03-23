/**
 * public/images/ 내 jpg/jpeg/png 파일의 WebP 버전을 생성한다.
 * 이미 WebP가 존재하고 원본보다 새로우면 스킵한다.
 * 빌드 전에 실행: node scripts/generate-webp.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const IMAGES_DIR = path.resolve('public/images');
const EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function findImages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImages(fullPath));
    } else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

const images = findImages(IMAGES_DIR);
let converted = 0;
let skipped = 0;

for (const imgPath of images) {
  const webpPath = imgPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  // 이미 WebP가 있고 원본보다 새로우면 스킵
  if (fs.existsSync(webpPath)) {
    const srcStat = fs.statSync(imgPath);
    const webpStat = fs.statSync(webpPath);
    if (webpStat.mtimeMs >= srcStat.mtimeMs) {
      skipped++;
      continue;
    }
  }

  await sharp(imgPath).webp({ quality: 80 }).toFile(webpPath);
  converted++;
}

console.log(`WebP: ${converted} converted, ${skipped} skipped (total ${images.length} images)`);
