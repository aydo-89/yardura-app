const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

async function main() {
  const outDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const items = [
    { url: 'https://yardura.com', out: 'qr-yardura-site' },
    { url: 'tel:+16125819812', out: 'qr-yardura-call' },
    { url: 'mailto:hello@yardura.com', out: 'qr-yardura-email' },
  ];

  for (const { url, out } of items) {
    const pngPath = path.join(outDir, `${out}.png`);
    const svgPath = path.join(outDir, `${out}.svg`);
    await QRCode.toFile(pngPath, url, {
      width: 1024,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const svgStr = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    fs.writeFileSync(svgPath, svgStr, 'utf8');
    console.log('Generated', out, '->', url);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
