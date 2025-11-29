const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

async function generateIconSet(svgPath, outputPrefix, themeName) {
  const publicDir = path.join(__dirname, '../public');
  
  console.log(`\n📦 Generating ${themeName} theme icons...`);
  
  // Generate favicon.ico with multiple sizes: 16x16, 32x32, 48x48
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
  const faviconName = outputPrefix === 'favicon-light' ? 'favicon-light.ico' : 'favicon-dark.ico';
  fs.writeFileSync(path.join(publicDir, faviconName), icoBuffer);
  console.log(`  ✅ ${faviconName} generated`);
  
  // Generate icon.png (512x512 for general use)
  const iconName = outputPrefix === 'favicon-light' ? 'icon-light.png' : 'icon-dark.png';
  await sharp(svgPath)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
    })
    .png()
    .toFile(path.join(publicDir, iconName));
  console.log(`  ✅ ${iconName} generated`);
  
  // Generate apple-icon.png (180x180 for Apple devices)
  const appleIconName = outputPrefix === 'favicon-light' ? 'apple-icon-light.png' : 'apple-icon-dark.png';
  await sharp(svgPath)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
    })
    .png()
    .toFile(path.join(publicDir, appleIconName));
  console.log(`  ✅ ${appleIconName} generated`);
}

async function generateIcons() {
  const lightSvgPath = path.join(__dirname, '../public/z-icon-light.svg');
  const darkSvgPath = path.join(__dirname, '../public/z-icon-dark.svg');
  const publicDir = path.join(__dirname, '../public');
  
  // Generate light theme icons (dark bars for light backgrounds)
  await generateIconSet(lightSvgPath, 'favicon-light', 'Light');
  
  // Generate dark theme icons (white bars for dark backgrounds)
  await generateIconSet(darkSvgPath, 'favicon-dark', 'Dark');
  
  // Generate default favicon.ico (use light as default for better compatibility)
  console.log('\n📦 Generating default favicon.ico (light theme)...');
  const icoSizes = [16, 32, 48];
  const icoBuffers = [];
  
  for (const size of icoSizes) {
    const buffer = await sharp(lightSvgPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    icoBuffers.push(buffer);
  }
  
  const icoBuffer = await toIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('  ✅ favicon.ico (default) generated');
  
  // Also generate default icon.png and apple-icon.png for metadata
  await sharp(lightSvgPath)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon.png'));
  console.log('  ✅ icon.png (default) generated');
  
  await sharp(lightSvgPath)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'apple-icon.png'));
  console.log('  ✅ apple-icon.png (default) generated');
  
  console.log('\n🎉 All icons generated successfully!');
  console.log('   Light theme: favicon-light-*, icon-light-*, apple-icon-light-*');
  console.log('   Dark theme: favicon-dark-*, icon-dark-*, apple-icon-dark-*');
  console.log('   Default: favicon.ico, icon.png, apple-icon.png');
}

generateIcons().catch(console.error);

