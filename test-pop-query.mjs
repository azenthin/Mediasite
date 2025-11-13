#!/usr/bin/env node

async function testPopQuery() {
  try {
    const response = await fetch("http://localhost:3000/api/ai/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "pop" })
    });
    
    const data = await response.json();
    
    console.log("\n=== POP QUERY RESULTS ===");
    console.log(`Total songs: ${data.playlist?.length || 0}`);
    
    if (data.playlist) {
      console.log("\nFirst 10 results:");
      data.playlist.slice(0, 10).forEach((song, i) => {
        console.log(`${i + 1}. "${song.title}" - ${song.artist} (${song.genre})`);
      });
    }
    
    // Check if they're all pop
    if (data.playlist) {
      const allPop = data.playlist.every(s => s.genre === "pop");
      console.log(`\n✓ All pop? ${allPop ? "YES" : "NO"}`);
      
      // Show non-pop songs if any
      const nonPop = data.playlist.filter(s => s.genre !== "pop");
      if (nonPop.length > 0) {
        console.log(`\nNon-pop songs found (${nonPop.length}):`);
        nonPop.forEach(s => console.log(`  - "${s.title}" - ${s.artist} (${s.genre})`));
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testPopQuery();
