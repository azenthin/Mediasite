const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const outDir = path.join(process.cwd(), 'scripts', 'backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `verified_tracks_backup_${timestamp}.json`);

  console.log('Exporting verified tracks to', outFile);

  // Adjust model/table names if your schema differs
  const tracks = await prisma.verifiedTrack.findMany({
    include: {
      identifiers: true,
    },
  });

  fs.writeFileSync(outFile, JSON.stringify({ exportedAt: new Date().toISOString(), count: tracks.length, tracks }, null, 2));

  console.log(`Exported ${tracks.length} verified tracks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
