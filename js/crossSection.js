/**
 * 剖面圖繪製模組
 * 沿視線方位畫地形剖面 + 視線射線
 */
import { EFFECTIVE_EARTH_RADIUS } from './constants.js';
import { TARGETS } from '../data/geography.js';
import { getTerrainAt } from './terrain.js';
import { floorToEyeHeight } from './visibility.js';

/**
 * 繪製視線剖面圖
 * @param {HTMLCanvasElement} canvas - 繪圖用 Canvas
 * @param {number} eyeHeight - 目前觀測高度(m)
 * @param {number|null} minSeaFloor - 可見海的最低樓層
 */
export function drawCrossSection(canvas, eyeHeight, minSeaFloor) {
  const ctx = canvas.getContext('2d');
  const seaTarget = TARGETS.SEA;
  const totalDistance = Math.hypot(seaTarget[0], seaTarget[1]);

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const PADDING = 22;
  const MAX_DISPLAY_HEIGHT = 400;

  // 座標轉換函式
  const rangeToX = (range) => PADDING + (width - PADDING * 1.4) * range / totalDistance;
  const elevToY = (elev) => height - 14 - (height - 26) * Math.min(elev, MAX_DISPLAY_HEIGHT) / MAX_DISPLAY_HEIGHT;

  // 繪製地形剖面
  ctx.beginPath();
  ctx.moveTo(rangeToX(0), elevToY(0));
  let firstBlockRange = null;

  for (let range = 0; range <= totalDistance; range += 40) {
    const fraction = range / totalDistance;
    const terrainHeight = getTerrainAt(seaTarget[0] * fraction, seaTarget[1] * fraction).height;
    ctx.lineTo(rangeToX(range), elevToY(terrainHeight));

    // 偵測第一個遮擋點
    if (firstBlockRange === null) {
      const sightHeight = eyeHeight + (0 - eyeHeight) * fraction
        - range * (totalDistance - range) / (2 * EFFECTIVE_EARTH_RADIUS);
      if (terrainHeight > sightHeight + 1 && range > 200) {
        firstBlockRange = range;
      }
    }
  }
  ctx.lineTo(rangeToX(totalDistance), elevToY(0));
  ctx.closePath();
  ctx.fillStyle = '#33503f';
  ctx.fill();

  // 海面指示
  ctx.fillStyle = '#2f7d9e';
  ctx.fillRect(rangeToX(totalDistance) - 3, elevToY(0), 3, height);

  // 視線射線
  ctx.strokeStyle = '#ffb454';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rangeToX(0), elevToY(eyeHeight));
  ctx.lineTo(rangeToX(totalDistance), elevToY(0));
  ctx.stroke();

  // 觀測點
  ctx.fillStyle = '#ffb454';
  ctx.beginPath();
  ctx.arc(rangeToX(0), elevToY(eyeHeight), 3.5, 0, 7);
  ctx.fill();

  // 地標文字
  ctx.fillStyle = '#e7d3a6';
  ctx.font = '10px ui-monospace';
  ctx.fillText('北藝大稜線', rangeToX(5720) - 24, elevToY(150) - 6);
  ctx.fillText('出海口', rangeToX(totalDistance) - 30, elevToY(0) - 4);

  // 遮擋紅點
  if (firstBlockRange) {
    const fraction = firstBlockRange / totalDistance;
    const terrainHeight = getTerrainAt(seaTarget[0] * fraction, seaTarget[1] * fraction).height;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(rangeToX(firstBlockRange), elevToY(terrainHeight), 4, 0, 7);
    ctx.fill();
  }

  // 比例尺
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, height - 14);
  ctx.lineTo(width - 4, height - 14);
  ctx.stroke();

  ctx.fillStyle = '#8aa4a8';
  ctx.font = '9px ui-monospace';
  ctx.fillText('0', 2, elevToY(0) + 3);
  ctx.fillText('150m', 0, elevToY(150) + 3);
  ctx.fillText('300m', 0, elevToY(300) + 3);

  // 回傳結果供 caption 使用
  return {
    isBlocked: firstBlockRange !== null,
    blockDistance: firstBlockRange,
    minSeaFloor,
    eyeHeight
  };
}

/**
 * 產生剖面圖的說明文字 HTML
 */
export function getCrossSectionCaption(result) {
  if (result.isBlocked) {
    let html = `視線在 <b style="color:#ff6b6b">${(result.blockDistance / 1000).toFixed(1)}km</b> 撞上北藝大稜線,海被擋。`;
    if (result.minSeaFloor) {
      html += ` 本模型約 <b style="color:#ffb454">第 ${result.minSeaFloor} 樓 / ${Math.round(floorToEyeHeight(result.minSeaFloor))}m</b> 才越得過。`;
    }
    return html;
  }
  return `視線越過所有地形 → <b style="color:#5fd08a">看得到海</b>(高度 ${Math.round(result.eyeHeight)}m)。`;
}
