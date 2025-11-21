const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const count = await prisma.verifiedTrack.count();
    console.log('✓ SQLite works, VerifiedTrack count:', count);
    
    // Test a simple query
    const sample = await prisma.verifiedTrack.findFirst();
    if (sample) {
      console.log('✓ Sample track:', sample.title, 'by', sample.artist);
    }
    
    process.exit(0);
  } catch (e) {
    console.error('✗ Error:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
