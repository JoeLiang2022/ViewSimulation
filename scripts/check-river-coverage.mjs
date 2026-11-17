#!/usr/bin/env node
/**
 * 河道覆蓋率檢查腳本
 * 沿河道折線以 50m 步距取樣，驗證 getTerrainAt 回傳 type='river' 或 'sea'
 */
import { getTerrainAt } from '../js/terrain.js';
import {
  TAMSUI_RIVER,
  KEELUNG_RIVER_WEST,
  KEELUNG_RIVER_NORTH_BANK
} from '../data/geography.js';

/**
 * 沿折線取樣，返回不符合預期的點
 */
function samplePolyline(polyline, stepSize, name) {
  const failures = [];
  let totalSamples = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [e1, n1] = polyline[i];
    const [e2, n2] = polyline[i + 1];
    const segmentLength = Math.hypot(e2 - e1, n2 - n1);
    const numSteps = Math.ceil(segmentLength / stepSize);

    for (let step = 0; step <= numSteps; step++) {
      const t = step / numSteps;
      const e = e1 + t * (e2 - e1);
      const n = n1 + t * (n2 - n1);
      const terrain = getTerrainAt(e, n);
      totalSamples++;

      if (terrain.type !== 'river' && terrain.type !== 'sea') {
        failures.push({ e, n, type: terrain.type, segment: i });
      }
    }
  }

  return { totalSamples, failures };
}

/**
 * 沿基隆河北岸向南偏移 80m 取中線樣本
 */
function sampleKeelungNorthBankCenterline(stepSize) {
  const failures = [];
  let totalSamples = 0;
  const OFFSET_SOUTH = 80; // 向南偏移到河道中心

  for (let i = 0; i < KEELUNG_RIVER_NORTH_BANK.length - 1; i++) {
    const [e1, n1] = KEELUNG_RIVER_NORTH_BANK[i];
    const [e2, n2] = KEELUNG_RIVER_NORTH_BANK[i + 1];
    const segmentLength = Math.hypot(e2 - e1, n2 - n1);
    const numSteps = Math.ceil(segmentLength / stepSize);

    for (let step = 0; step <= numSteps; step++) {
      const t = step / numSteps;
      const e = e1 + t * (e2 - e1);
      const n = n1 + t * (n2 - n1) - OFFSET_SOUTH; // 向南偏移
      const terrain = getTerrainAt(e, n);
      totalSamples++;

      if (terrain.type !== 'river' && terrain.type !== 'sea') {
        failures.push({ e, n, type: terrain.type, segment: i });
      }
    }
  }

  return { totalSamples, failures };
}

/**
 * 主程式
 */
function main() {
  const STEP_SIZE = 50; // 50m 取樣步距
  let allPassed = true;

  // 檢查淡水河
  console.log('=== 檢查 TAMSUI_RIVER ===');
  const tamsuiResult = samplePolyline(TAMSUI_RIVER, STEP_SIZE, 'TAMSUI_RIVER');
  const tamsuiRate = ((tamsuiResult.totalSamples - tamsuiResult.failures.length) / tamsuiResult.totalSamples * 100).toFixed(1);
  console.log(`取樣點數: ${tamsuiResult.totalSamples}`);
  console.log(`river/sea 比例: ${tamsuiRate}%`);
  console.log(`失敗點數: ${tamsuiResult.failures.length}`);
  
  if (parseFloat(tamsuiRate) < 95) {
    allPassed = false;
    console.log('❌ 未達 95% 標準');
    console.log('失敗點範例（前 5 個）:');
    tamsuiResult.failures.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. (${f.e.toFixed(0)}, ${f.n.toFixed(0)}) type=${f.type} segment=${f.segment}`);
    });
  } else {
    console.log('✓ 通過');
  }

  // 檢查基隆河北岸中線
  console.log('\n=== 檢查 KEELUNG_RIVER_NORTH_BANK 中線（南偏 80m） ===');
  const keelungBankResult = sampleKeelungNorthBankCenterline(STEP_SIZE);
  const keelungBankRate = ((keelungBankResult.totalSamples - keelungBankResult.failures.length) / keelungBankResult.totalSamples * 100).toFixed(1);
  console.log(`取樣點數: ${keelungBankResult.totalSamples}`);
  console.log(`river/sea 比例: ${keelungBankRate}%`);
  console.log(`失敗點數: ${keelungBankResult.failures.length}`);
  
  if (parseFloat(keelungBankRate) < 90) {
    allPassed = false;
    console.log('❌ 未達 90% 標準');
    console.log('失敗點範例（前 5 個）:');
    keelungBankResult.failures.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. (${f.e.toFixed(0)}, ${f.n.toFixed(0)}) type=${f.type} segment=${f.segment}`);
    });
  } else {
    console.log('✓ 通過');
  }

  // 檢查基隆河西段
  console.log('\n=== 檢查 KEELUNG_RIVER_WEST ===');
  const keelungWestResult = samplePolyline(KEELUNG_RIVER_WEST, STEP_SIZE, 'KEELUNG_RIVER_WEST');
  const keelungWestRate = ((keelungWestResult.totalSamples - keelungWestResult.failures.length) / keelungWestResult.totalSamples * 100).toFixed(1);
  console.log(`取樣點數: ${keelungWestResult.totalSamples}`);
  console.log(`river/sea 比例: ${keelungWestRate}%`);
  console.log(`失敗點數: ${keelungWestResult.failures.length}`);
  
  if (parseFloat(keelungWestRate) < 95) {
    allPassed = false;
    console.log('❌ 未達 95% 標準');
    console.log('失敗點範例（前 5 個）:');
    keelungWestResult.failures.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. (${f.e.toFixed(0)}, ${f.n.toFixed(0)}) type=${f.type} segment=${f.segment}`);
    });
  } else {
    console.log('✓ 通過');
  }

  // 總結
  console.log('\n=== 總結 ===');
  if (allPassed) {
    console.log('✓ 所有檢查通過');
    process.exit(0);
  } else {
    console.log('❌ 有檢查未通過，需要調整 terrain.js 的河道半徑');
    process.exit(1);
  }
}

main();
