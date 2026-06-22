/**
 * 衛星底圖貼地模組
 * 嘗試載入 Esri 空照 / OSM 圖磚，貼合到 3D 場景地面
 */
import { MINGYU_LAT, MINGYU_LNG, METERS_PER_LAT, METERS_PER_LNG } from './constants.js';

const TILE_SOURCES = [
  {
    name: 'Esri空照',
    getUrl: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
  },
  {
    name: 'OSM街圖',
    getUrl: (z, x, y) => `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`
  }
];

/**
 * 載入單張地圖 tile（含超時處理）
 */
function loadTile(source, zoom, tileX, tileY, timeoutMs = 6000) {
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
 * 嘗試載入衛星底圖並建立貼地 mesh
 * @param {THREE.Scene} scene
 * @param {THREE.Group} decorGroup - 裝飾群組（載入底圖時隱藏）
 * @param {function} onStatus - 狀態回呼 (text)
 * @returns {THREE.Mesh|null} 已建立的 mesh，或 null 表示失敗
 */
export async function loadSatelliteGround(scene, decorGroup, onStatus) {
  const ZOOM = 15;
  const TILE_COUNT = Math.pow(2, ZOOM);
  const TILE_SIZE = 256;

  // 涵蓋範圍：社子島/基隆河/淡水河近段/開發區
  const EAST_WEST = -5000, EAST_EAST = 1900, NORTH_SOUTH = -2900, NORTH_NORTH = 2400;
  const latNW = MINGYU_LAT + NORTH_NORTH / METERS_PER_LAT;
  const lonNW = MINGYU_LNG + EAST_WEST / METERS_PER_LNG;
  const latSE = MINGYU_LAT + NORTH_SOUTH / METERS_PER_LAT;
  const lonSE = MINGYU_LNG + EAST_EAST / METERS_PER_LNG;

  // Web Mercator 轉換
  const lonToTileX = (lon) => Math.floor((lon + 180) / 360 * TILE_COUNT);
  const latToTileY = (lat) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * TILE_COUNT);
  const tileXToLon = (x) => x / TILE_COUNT * 360 - 180;
  const tileYToLat = (y) => { const a = Math.PI - 2 * Math.PI * y / TILE_COUNT; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(a) - Math.exp(-a))); };

  const xMin = lonToTileX(lonNW), xMax = lonToTileX(lonSE);
  const yMin = latToTileY(latNW), yMax = latToTileY(latSE);
  const cols = xMax - xMin + 1, rows = yMax - yMin + 1;

  if (cols < 1 || rows < 1 || cols * rows > 72) {
    onStatus('範圍異常');
    return null;
  }

  for (const source of TILE_SOURCES) {
    onStatus('載入中…' + source.name);
    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_SIZE;
    canvas.height = rows * TILE_SIZE;
    const ctx = canvas.getContext('2d');
    let successCount = 0;

    const jobs = [];
    for (let ty = yMin; ty <= yMax; ty++) {
      for (let tx = xMin; tx <= xMax; tx++) {
        jobs.push(
          loadTile(source, ZOOM, tx, ty).then(img => {
            if (img) {
              ctx.drawImage(img, (tx - xMin) * TILE_SIZE, (ty - yMin) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
              successCount++;
            }
          })
        );
      }
    }
    await Promise.all(jobs);

    if (successCount === 0) continue;

    // CORS 驗證
    try { ctx.getImageData(0, 0, 1, 1); } catch (e) { continue; }

    // 計算地理範圍對應場景座標
    const geoWest = tileXToLon(xMin), geoEast = tileXToLon(xMax + 1);
    const geoNorth = tileYToLat(yMin), geoSouth = tileYToLat(yMax + 1);
    const sceneWest = (geoWest - MINGYU_LNG) * METERS_PER_LNG;
    const sceneEast = (geoEast - MINGYU_LNG) * METERS_PER_LNG;
    const sceneNorth = (geoNorth - MINGYU_LAT) * METERS_PER_LAT;
    const sceneSouth = (geoSouth - MINGYU_LAT) * METERS_PER_LAT;

    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      texture.encoding = THREE.sRGBEncoding;
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sceneEast - sceneWest, sceneNorth - sceneSouth),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((sceneWest + sceneEast) / 2, 4.25, -(sceneSouth + sceneNorth) / 2);
    scene.add(mesh);
    decorGroup.visible = false;

    onStatus(source.name + '✓(' + successCount + ')');
    return mesh;
  }

  onStatus('衛星底圖');
  return null;
}

/**
 * 移除衛星底圖 mesh 並恢復裝飾圖層
 */
export function removeSatelliteGround(mesh, scene, decorGroup) {
  scene.remove(mesh);
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.dispose();
  mesh.geometry.dispose();
  decorGroup.visible = true;
}
