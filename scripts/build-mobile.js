/**
 * Aegis Mobile Web Asset Bundler
 * Compiles and organizes web assets into a self-contained distribution
 * for Capacitor Android packaging.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const WEB_DIR = path.join(ROOT, 'apps', 'web');
const DIST_DIR = path.join(WEB_DIR, 'dist');
const PACKAGES_DIR = path.join(ROOT, 'packages');

console.log('📦 Starting Aegis Mobile Web Asset Bundler...');

// 1. Clean and prepare dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Helper to copy directory recursively
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy src directory to dist/src
console.log('📁 Copying client source code...');
copyDirRecursive(path.join(WEB_DIR, 'src'), path.join(DIST_DIR, 'src'));

// 3. Copy packages/protocol to dist/packages/protocol
console.log('📁 Copying shared protocol packages...');
copyDirRecursive(PACKAGES_DIR, path.join(DIST_DIR, 'packages'));

// 4. Process and copy index.html
console.log('📄 Processing and copying index.html...');
let htmlContent = fs.readFileSync(path.join(WEB_DIR, 'public', 'index.html'), 'utf8');

// Fix paths in index.html for flat dist root
htmlContent = htmlContent.replace('../src/css/main.css', './src/css/main.css');
htmlContent = htmlContent.replace('../src/ui/app.js', './src/ui/app.js');

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlContent, 'utf8');

// 5. Fix packages/protocol imports in dist/src/ui/app.js
console.log('🔧 Re-linking protocol imports in bundled app.js...');
const bundledAppJsPath = path.join(DIST_DIR, 'src', 'ui', 'app.js');
let appJsContent = fs.readFileSync(bundledAppJsPath, 'utf8');

appJsContent = appJsContent.replace(
  "from '../../../../packages/protocol/fingerprint.js'",
  "from '../../packages/protocol/fingerprint.js'"
);
appJsContent = appJsContent.replace(
  "from '../../../../packages/protocol/e164.js'",
  "from '../../packages/protocol/e164.js'"
);

fs.writeFileSync(bundledAppJsPath, appJsContent, 'utf8');

console.log('✅ Mobile asset bundling completed successfully!');
console.log(`📁 Distribution ready at: ${DIST_DIR}`);
