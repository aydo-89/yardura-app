// Simple QR generator to produce PNG and SVG in the public folder
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

async function main() {
  const url = process.env.QR_URL || 'https://9a68f940d237.ngrok-free.app';
  const outDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // PNG
  const pngPath = path.join(outDir, 'yardura-qr.png');
  await QRCode.toFile(pngPath, url, { width: 512, margin: 2 });

  // SVG
  const svgStr = await QRCode.toString(url, { type: 'svg', margin: 1 });
  const svgPath = path.join(outDir, 'yardura-qr.svg');
  fs.writeFileSync(svgPath, svgStr, 'utf8');

  console.log('Generated:', pngPath);
  console.log('Generated:', svgPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



