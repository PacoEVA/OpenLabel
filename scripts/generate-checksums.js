const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const releaseDir = path.join(__dirname, '..', 'release');
if (!fs.existsSync(releaseDir)) {
  console.error('Release directory does not exist.');
  process.exit(1);
}

const files = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.exe'));
if (files.length === 0) {
  console.log('No .exe artifacts found in release directory.');
  process.exit(0);
}

const lines = [];
for (const file of files) {
  const filePath = path.join(releaseDir, file);
  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  lines.push(`${hash}  ${file}`);
  console.log(`${hash}  ${file}`);
}

const outputPath = path.join(releaseDir, 'SHA256SUMS.txt');
fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
console.log(`Generated checksums at ${outputPath}`);
