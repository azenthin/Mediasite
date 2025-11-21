const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'ingest');
const CHECKPOINT_FILE = path.join(OUTPUT_DIR, 'staging-results-1m-checkpoint.json');
const BATCH_PREFIX = 'staging-results-1m';

const TARGET_SONGS = 1000000;
const BATCH_SIZE = 50000;

let startTime = Date.now();
let lastKnownTime = startTime;
let lastKnownCount = 0;

async function monitor() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🎵 1M SONG COLLECTION - REAL-TIME MONITOR');
  console.log('═══════════════════════════════════════════════════════════════\n');

  while (true) {
    try {
      if (fs.existsSync(CHECKPOINT_FILE)) {
        const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
        const currentCount = checkpoint.totalTracks || 0;
        const currentTime = Date.now();
        const elapsedMs = currentTime - startTime;
        const elapsedSec = Math.round(elapsedMs / 1000);
        const elapsedMin = (elapsedSec / 60).toFixed(1);
        const elapsedHour = (elapsedSec / 3600).toFixed(2);

        // Calculate speed
        const timeDeltaSec = (currentTime - lastKnownTime) / 1000;
        const countDelta = currentCount - lastKnownCount;
        const tracksPerSec = timeDeltaSec > 0 ? (countDelta / timeDeltaSec).toFixed(0) : 0;

        // Calculate ETA
        const remaining = TARGET_SONGS - currentCount;
        const secPerTrack = tracksPerSec > 0 ? 1 / tracksPerSec : 999999;
        const estimatedSecRemaining = Math.round(remaining * secPerTrack);
        const estimatedMinRemaining = Math.round(estimatedSecRemaining / 60);
        const estimatedHourRemaining = (estimatedMinRemaining / 60).toFixed(1);

        // Progress bar
        const progressPercent = Math.round((currentCount / TARGET_SONGS) * 100);
        const barLength = 40;
        const filledLength = Math.round((progressPercent / 100) * barLength);
        const emptyLength = barLength - filledLength;
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

        // Batch info
        const batchNumber = checkpoint.nextBatch || 1;
        const queriesProcessed = checkpoint.searchQueriesProcessed || 0;

        // Format output
        console.log(`\n📊 PROGRESS\n`);
        console.log(`   ${progressBar} ${progressPercent}%`);
        console.log(`\n   Collected: ${currentCount.toLocaleString()} / ${TARGET_SONGS.toLocaleString()} songs`);
        console.log(`   Remaining: ${remaining.toLocaleString()} songs`);

        console.log(`\n⏱️  TIME\n`);
        console.log(`   Elapsed:   ${elapsedHour}h (${elapsedMin}m, ${elapsedSec}s)`);
        console.log(`   ETA:       ${estimatedHourRemaining}h (${estimatedMinRemaining}m)`);
        console.log(`   Speed:     ${tracksPerSec} tracks/sec`);

        console.log(`\n📋 BATCH INFO\n`);
        console.log(`   Current Batch:  #${batchNumber}`);
        console.log(`   Batch Size:     ${BATCH_SIZE.toLocaleString()} songs`);
        console.log(`   Searches Done:  ${queriesProcessed} / ~600`);

        console.log(`\n💾 FILES\n`);
        const batchFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.includes(`${BATCH_PREFIX}-batch-`));
        console.log(`   Batch files saved: ${batchFiles.length}`);
        batchFiles.slice(0, 5).forEach(f => {
          const stat = fs.statSync(path.join(OUTPUT_DIR, f));
          console.log(`   └─ ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        if (batchFiles.length > 5) {
          console.log(`   └─ ... and ${batchFiles.length - 5} more`);
        }

        // Check for final file
        const finalFile = path.join(OUTPUT_DIR, `${BATCH_PREFIX}-final.json`);
        if (fs.existsSync(finalFile)) {
          const stat = fs.statSync(finalFile);
          console.log(`\n   ✅ FINAL FILE: ${`${BATCH_PREFIX}-final.json`} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
          console.log(`\n   🎉 Collection complete! Ready for import to PostgreSQL.`);
          console.log(`\n   Next step: turbo-upsert.js will migrate ${currentCount.toLocaleString()} songs in ~26 minutes\n`);
          process.exit(0);
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('   Updates every 10 seconds... Press Ctrl+C to exit');
        console.log('═══════════════════════════════════════════════════════════════\n');

        lastKnownTime = currentTime;
        lastKnownCount = currentCount;
      } else {
        console.log('⏳ Waiting for checkpoint file...\n');
      }

      // Wait 10 seconds before next update
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error('Monitor error:', error.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

monitor().catch(console.error);
