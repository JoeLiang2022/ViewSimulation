/**
 * 衛星底圖模組
 * 將衛星圖磚拼接後作為地形網格的貼圖，取代頂點色彩
 * 這樣底圖會完整貼合地形起伏，不會出現補丁效果
 */
import { MINGYU_LAT, MINGYU_LNG, METERS_PER_LAT, METERS_PER_LNG } from './constants.js';

const TILE_SOURCES = [
  {
    name: 'Esri空照',
    getUrl: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  },
  {
    name: 'Google衛星',
    getUrl: (z, x, y) => `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`
  },
  {
    name: 'OSM街圖',
    getUrl: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }
];

/**
 * 載入單張地圖 tile（含超時處理）
 */
function loadTile(source, zoom, tileX, tileY, timeoutMs = 10000) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let resolved = false;
    const timer = setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, timeoutMs);
    img.onload = () => { if (!resolved) { resolved = true; clearTimeout(timer); resolve(img); } };
    img.onerror = () => { if (!resolved) { resolved = true; clearTimeout(timer); resolve(null); } };
    img.src = source.getUrl(zoom, tileX, tileY);
  });
}

/**
 * 載入衛星底圖並貼合到地形 mesh 上
 * @param {THREE.Mesh} terrainMesh - 地形網格 mesh（第一個加入 scene 的大型 mesh）
 * @param {function} onStatus - 狀態回呼
 * @returns {{ texture, originalMaterial }|null}
 */
export async function loadSatelliteGround(terrainMesh, onStatus) {
  const ZOOM = 14;
  const TILE_COUNT = Math.pow(2, ZOOM);
  const TILE_SIZE = 256;

  // 衛星底圖覆蓋核心區域（不需要覆蓋整個 60km 地形）
  const EAST_MIN = -14000, EAST_MAX = 4000;
  const NORTH_MIN = -5000, NORTH_MAX = 12000;

  // 轉為經緯度
  const latSouth = MINGYU_LAT + NORTH_MIN / METERS_PER_LAT;
  const latNorth = MINGYU_LAT + NORTH_MAX / METERS_PER_LAT;
  const lonWest = MINGYU_LNG + EAST_MIN / METERS_PER_LNG;
  const lonEast = MINGYU_LNG + EAST_MAX / METERS_PER_LNG;

  // Web Mercator tile 座標
  const lonToTileX = (lon) => Math.floor((lon + 180) / 360 * TILE_COUNT);
  const latToTileY = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * TILE_COUNT);
  const tileXToLon = (x) => x / TILE_COUNT * 360 - 180;
  const tileYToLat = (y) => { const a = Math.PI - 2 * Math.PI * y / TILE_COUNT; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(a) - Math.exp(-a))); };

  const xMin = lonToTileX(lonWest), xMax = lonToTileX(lonEast);
  const yMin = latToTileY(latNorth), yMax = latToTileY(latSouth);
  const cols = xMax - xMin + 1, rows = yMax - yMin + 1;

  if (cols < 1 || rows < 1 || cols * rows > 200) {
    onStatus('範圍異常 (' + cols + '×' + rows + ')');
    return null;
  }

  for (const source of TILE_SOURCES) {
    onStatus('載入中…' + source.name + ' (' + cols * rows + ' tiles)');

    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    let successCount = 0;

    // 並行載入所有 tiles
    const jobs = [];
    for (let ty = yMin; ty <= yMax; ty++) {
      for (let tx = xMin; tx <= xMax; tx++) {
        jobs.push(
          loadTile(source, ZOOM, tx, ty).then(img => {
            if (img) {
              ctx.drawImage(img, (tx - xMin) * TILE_SIZE, (ty - yMin) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              successCount++;
            } else {
              // 載入失敗的 tile 填充深綠色（接近地形色），比留空白好
              ctx.fillStyle = '#4a6b42';
              ctx.fillRect((tx - xMin) * TILE_SIZE, (ty - yMin) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          })
        );
      }
    }
    await Promise.all(jobs);

    const totalTiles = cols * rows;
    const successRate = successCount / totalTiles;

    // 如果載入率太低，跳過此來源（避免半成品拼接效果）
    if (successCount === 0) continue;
    if (successRate < 0.85) {
      onStatus(source.name + ' 載入不完整(' + Math.round(successRate * 100) + '%)，跳過…');
      continue;
    }

    // CORS 驗證
    try { ctx.getImageData(0, 0, 1, 1); } catch (e) { continue; }

    // 計算 tile 覆蓋的地理範圍
    const geoWest = tileXToLon(xMin);
    const geoEast = tileXToLon(xMax + 1);
    const geoNorth = tileYToLat(yMin);
    const geoSouth = tileYToLat(yMax + 1);

    // 轉為場景座標
    const sceneWest = (geoWest - MINGYU_LNG) * METERS_PER_LNG;
    const sceneEast = (geoEast - MINGYU_LNG) * METERS_PER_LNG;
    const sceneNorth = (geoNorth - MINGYU_LAT) * METERS_PER_LAT;
    const sceneSouth = (geoSouth - MINGYU_LAT) * METERS_PER_LAT;

    // 計算 UV 映射：地形網格頂點對應到貼圖的 UV
    // 地形 mesh position: x = easting, z = -northing
    // UV: u = (easting - sceneWest) / (sceneEast - sceneWest)
    //     v = 1 - (northing - sceneSouth) / (sceneNorth - sceneSouth)
    //       = 1 - (-z - sceneSouth) / (sceneNorth - sceneSouth)
    const geometry = terrainMesh.geometry;
    const posAttr = geometry.getAttribute('position');
    const uvs = new Float32Array(posAttr.count * 2);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);  // easting
      const z = posAttr.getZ(i);  // -northing
      const northing = -z;

      uvs[i * 2] = (x - sceneWest) / (sceneEast - sceneWest);
      uvs[i * 2 + 1] = 1.0 - (northing - sceneSouth) / (sceneNorth - sceneSouth);
    }
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    // 建立貼圖
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // 提亮衛星圖：在 canvas 上疊一層半透明白色增加亮度
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    texture.needsUpdate = true;

    // 保存原始材質，切換為貼圖材質（關閉 fog 避免壓暗）
    const originalMaterial = terrainMesh.material;
    terrainMesh.material = new THREE.MeshBasicMaterial({
      map: texture,
      fog: false
    });

    onStatus(source.name + '✓(' + successCount + '/' + cols * rows + ')');
    return { texture, originalMaterial };
  }

  onStatus('衛星底圖');
  return null;
}

/**
 * 移除衛星底圖，恢復原始地形頂點色材質
 */
export function removeSatelliteGround(terrainMesh, satData) {
  if (satData.texture) satData.texture.dispose();
  if (terrainMesh.material !== satData.originalMaterial) {
    terrainMesh.material.dispose();
  }
  terrainMesh.material = satData.originalMaterial;
}
