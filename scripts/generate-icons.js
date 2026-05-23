const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
const iconSvg = fs.readFileSync(path.join(assets, 'icon.svg'));
const adaptiveSvg = fs.readFileSync(path.join(assets, 'adaptive-icon.svg'));

async function run() {
  await sharp(iconSvg, { density: 384 }).resize(1024, 1024).png().toFile(path.join(assets, 'icon.png'));
  await sharp(adaptiveSvg, { density: 384 }).resize(1024, 1024).png().toFile(path.join(assets, 'adaptive-icon.png'));
  await sharp(adaptiveSvg, { density: 384 }).resize(1024, 1024).png().toFile(path.join(assets, 'splash-icon.png'));
  await sharp(iconSvg, { density: 192 }).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'));
  console.log('icons generated');
}

run().catch((e) => { console.error(e); process.exit(1); });
