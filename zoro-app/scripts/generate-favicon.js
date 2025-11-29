const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const svgPath = path.join(__dirname, '../public/z-icon.svg');
  const publicDir = path.join(__dirname, '../public');
  
  // Generate favicon.ico with multiple sizes: 16x16, 32x32, 48x48
  console.log('Generating favicon.ico...');
  const icoSizes = [16, 32, 48];
  const icoBuffers = [];
  
  for (const size of icoSizes) {
    const buffer = await sharp(svgPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png()
      .toBuffer();
    icoBuffers.push(buffer);
  }
  
  // Convert PNG buffers to ICO format
  const icoBuffer = await toIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('✅ favicon.ico generated');
  
  // Generate icon.png (512x512 for general use)
  console.log('Generating icon.png...');
  await sharp(svgPath)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
    })
    .png()
    .toFile(path.join(publicDir, 'icon.png'));
  console.log('✅ icon.png generated');
  
  // Generate apple-icon.png (180x180 for Apple devices)
  console.log('Generating apple-icon.png...');
  await sharp(svgPath)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
    })
    .png()
    .toFile(path.join(publicDir, 'apple-icon.png'));
  console.log('✅ apple-icon.png generated');
  
  console.log('\n🎉 All icons generated successfully from Z logo!');
}

generateIcons().catch(console.error);

