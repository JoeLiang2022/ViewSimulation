/**
 * 地形高程計算引擎
 * 負責判定任意座標點的海拔高度與地表類型
 */
import { GROUND_ELEVATION } from './constants.js';
import {
  PEAKS, KEELUNG_RIVER_NORTH_BANK, KEELUNG_RIVER_WEST,
  TAMSUI_RIVER, SHEZI_ISLAND
} from '../data/geography.js';

/**
 * 計算點到線段的最短距離
 */
function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  let t = lengthSq ? ((px - ax) * dx + (pz - az) * dz) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/**
 * 計算點到折線的最短距離
 */
function distanceToPolyline(px, pz, polyline) {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = distanceToSegment(
      px, pz,
      polyline[i][0], polyline[i][1],
      polyline[i + 1][0], polyline[i + 1][1]
    );
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

/**
 * 判斷點是否在多邊形內（射線法）
 */
export function isInsidePolygon(px, pz, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > pz) !== (yj > pz)) && (px < (xj - xi) * (pz - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 計算基隆河北岸在指定東向座標的南北位置（線性插值）
 */
function getKeelungBankNorth(easting) {
  const bank = KEELUNG_RIVER_NORTH_BANK;
  if (easting <= bank[0][0]) return bank[0][1];
  for (let i = 0; i < bank.length - 1; i++) {
    const a = bank[i], b = bank[i + 1];
    if (easting >= a[0] && easting <= b[0]) {
      const t = (easting - a[0]) / (b[0] - a[0]);
      return a[1] + t * (b[1] - a[1]);
    }
  }
  return bank[bank.length - 1][1];
}

/**
 * 計算指定座標的地表高程和類型
 * @param {number} easting - 東向偏移(m)
 * @param {number} northing - 北向偏移(m)
 * @returns {{ height: number, type: string }}
 *   type: 'sea' | 'river' | 'wet' | 'land'
 */
export function getTerrainAt(easting, northing) {
  // 海域判定（出海口以北）
  if (easting < -8200 && northing > 6600) {
    return { height: 0, type: 'sea' };
  }

  // 淡水河主河道（河寬 ~360m）
  if (distanceToPolyline(easting, northing, TAMSUI_RIVER) < 180) {
    return { height: 0, type: 'river' };
  }

  // 基隆河（河寬 150~300m，依位置漸變）
  if (easting > -650 && easting < 1450) {
    const riverWidth = Math.min(300, 150 + Math.max(0, -easting) * 0.25);
    const bankNorth = getKeelungBankNorth(easting);
    if (northing < bankNorth - 6 && northing > bankNorth - riverWidth) {
      return { height: 0, type: 'river' };
    }
  }

  // 基隆河西北段接淡水河（河寬 ~280m）
  if (distanceToPolyline(easting, northing, KEELUNG_RIVER_WEST) < 140) {
    return { height: 0, type: 'river' };
  }

  // 社子島濕地（低窪泥灘）
  if (isInsidePolygon(easting, northing, SHEZI_ISLAND)) {
    return { height: 2.5, type: 'wet' };
  }

  // 陸地：基底高程 + 高斯山峰疊加
  let height = GROUND_ELEVATION;
  for (const peak of PEAKS) {
    const distSq = (easting - peak.e) ** 2 + (northing - peak.n) ** 2;
    height += peak.amplitude * Math.exp(-distSq / (2 * peak.spread * peak.spread));
  }
  return { height, type: 'land' };
}
