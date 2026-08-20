import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xzjxkplsgzcvdcjdhpcp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6anhrcGxzZ3pjdmRjamRocGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2Mjg5MDUsImV4cCI6MjEwMjIwNDkwNX0.sSiDSjXZ4ntmBSmZIiRUfazzsXncpVRBMXINZGlsO1c'
);

const recordsDir = 'C:\\ecgrhythmia\\ecgrhythmia-backend\\records\\records_local';

function getHighestProbabilityLabel(probabilities) {
    if (!probabilities) return 'Unknown';
    let highest = 'Unknown';
    let max = -1;
    for (const [key, value] of Object.entries(probabilities)) {
        if (value > max) {
            max = value;
            highest = key;
        }
    }
    return highest; // Returns exact string from jsonl (e.g., 'AF', 'Takikardia', 'Bradikardia', 'Normal')
}

async function run() {
  console.log('Menyelaraskan label dari probabilitas tertinggi JSONL secara persis (exact)...');
  const files = fs.readdirSync(recordsDir).filter(f => f.endsWith('.jsonl'));
  let totalUpdated = 0;

  for (const file of files) {
    const sessionId = file.replace('.jsonl', '');
    const filePath = path.join(recordsDir, file);
    
    console.log(`\n[START] Memproses sesi: ${sessionId}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let frameIndex = 0;
    for await (const line of rl) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line);
          let label = data.prediction?.label || 'Unknown';
          
          if (data.prediction?.probabilities) {
              label = getHighestProbabilityLabel(data.prediction.probabilities);
          }
          
          const startTime = frameIndex * 10;
          console.log(`  -> [FRAME] Memproses frame ke-${frameIndex} (Start: ${startTime}s) - Ditemukan label: ${label}`);
          
          const { error } = await supabase
            .from('frame_records')
            .update({ label: label })
            .eq('session_id', sessionId)
            .eq('start_time', startTime);
            
          if (error) {
            console.error(`     [ERROR] Gagal update frame ${frameIndex}:`, error.message);
          } else {
            totalUpdated++;
          }
        } catch (e) {
            console.error(`     [ERROR] Gagal membaca JSON pada frame ${frameIndex}:`, e);
        }
      }
      frameIndex++;
    }
    console.log(`[END] Selesai memproses sesi: ${sessionId}`);
  }
  
  console.log(`\nSelesai! Berhasil memulihkan ${totalUpdated} labels persis dari JSONL.`);
}

run();
