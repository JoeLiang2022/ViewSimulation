/**
 * 視線遮蔽計算引擎
 * 沿視線路徑步進檢查是否被建物或地形遮擋
 * 考慮地球曲率 + 大氣折射修正
 */
import { EFFECTIVE_EARTH_RADIUS, GROUND_ELEVATION, FLOOR_HEIGHT } from './constants.js';
import { BUILDINGS } from '../data/buildings.js';
import { getTerrainAt } from './terrain.js';

/**
 * 計算建物頂部高度（公尺）
 */
export function getBuildingTopHeight(building) {
  return GROUND_ELEVATION + building.fl * FLOOR_HEIGHT;
}

/**
 * 判斷座標是否在建物平面範圍內
 */
function isInsideBuilding(easting, northing, building) {
  return Math.abs(easting - building.e) <= building.w / 2 &&
         Math.abs(northing - building.n) <= building.d / 2;
}

/**
 * 將樓層數轉換為視線高度（公尺）
 */
export function floorToEyeHeight(floor) {
  return GROUND_ELEVATION + floor * FLOOR_HEIGHT;
}

/**
 * 計算從觀測建物到目標的視線是否可見
 * @param {number[]} target - [東偏移, 北偏移, 高程]
 * @param {number} eyeHeight - 觀測者眼睛高度(m)
 * @param {object} observer - 觀測建物資料
 * @returns {{ ok: boolean, at: number, by?: string }}
 *   ok: 是否可見
 *   at: 視線觸達距離或遮擋距離(m)
 *   by: 遮擋物名稱（如果被擋）
 */
export function checkVisibility(target, eyeHeight, observer) {
  const originE = observer.e;
  const originN = observer.n;
  const deltaE = target[0] - originE;
  const deltaN = target[1] - originN;
  const totalDistance = Math.hypot(deltaE, deltaN);

  // 沿射線步進，近處細密、遠處粗略
  for (let range = 12; range < totalDistance - 10; range += (range < 900 ? 12 : 40)) {
    const fraction = range / totalDistance;
    const sampleE = originE + deltaE * fraction;
    const sampleN = originN + deltaN * fraction;

    // 視線在此距離的高度（含地球曲率修正）
    const sightHeight = eyeHeight + (target[2] - eyeHeight) * fraction
      - range * (totalDistance - range) / (2 * EFFECTIVE_EARTH_RADIUS);

    // 檢查建物遮擋
    for (const building of BUILDINGS) {
      if (building === observer) continue;
      if (isInsideBuilding(sampleE, sampleN, building) &&
          getBuildingTopHeight(building) > sightHeight + 0.5) {
        return { ok: false, at: range, by: building.name };
      }
    }

    // 檢查地形遮擋
    const terrain = getTerrainAt(sampleE, sampleN);
    if (terrain.height > sightHeight + 1) {
      return { ok: false, at: range, by: '地形' };
    }
  }

  return { ok: true, at: totalDistance };
}

/**
 * 計算能看到出海口的最低樓層
 * @param {number[]} seaTarget - 出海口座標
 * @param {object} observer - 觀測建物
 * @returns {number|null} 最低可見樓層，或 null 表示 200F 內都看不到
 */
export function findMinSeaFloor(seaTarget, observer) {
  for (let floor = 1; floor <= 200; floor++) {
    const eyeHeight = floorToEyeHeight(floor);
    if (checkVisibility(seaTarget, eyeHeight, observer).ok) {
      return floor;
    }
  }
  return null;
}
