/**
 * 2D Leaflet 地圖模組
 * 提供 OSM/Esri 底圖 + 建物框疊圖
 */
import { METERS_PER_LAT, METERS_PER_LNG, MINGYU_LAT, MINGYU_LNG } from './constants.js';
import { BUILDINGS } from '../data/buildings.js';
import { ROADS, KEELUNG_RIVER_NORTH_BANK } from '../data/geography.js';

/**
 * 將場景座標(e,n)轉換為經緯度 [lat, lng]
 */
export function sceneToLatLng(easting, northing) {
  return [
    MINGYU_LAT + northing / METERS_PER_LAT,
    MINGYU_LNG + easting / METERS_PER_LNG
  ];
}

/**
 * 初始化 2D 地圖
 * @param {string} containerId - 地圖容器 DOM ID
 * @param {number} observerIndex - 目前觀測建物 index
 * @returns {{ map, observerMarker }}
 */
export function initLeafletMap(containerId, observerIndex) {
  const map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
    maxZoom: 19
  }).setView(sceneToLatLng(60, 80), 17);

  // 底圖圖層
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
  const satLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 }
  );
  osmLayer.addTo(map);
  L.control.layers(
    { 'OSM 街圖': osmLayer, '衛星 Esri(沙盒內可能空白)': satLayer },
    null,
    { position: 'topright', collapsed: false }
  ).addTo(map);

  // 建物方框
  const labeledBuildings = {};
  BUILDINGS.forEach((building, index) => {
    const hexColor = '#' + ('000000' + building.color.toString(16)).slice(-6);
    const sw = sceneToLatLng(building.e - building.w / 2, building.n - building.d / 2);
    const ne = sceneToLatLng(building.e + building.w / 2, building.n + building.d / 2);
    const isObserver = (index === observerIndex);

    L.rectangle([sw, ne], {
      color: isObserver ? '#ffb454' : hexColor,
      weight: isObserver ? 2 : 1,
      fillColor: hexColor,
      fillOpacity: building.ghost ? 0.25 : 0.62
    }).addTo(map);

    // 避免重複標籤
    const baseName = building.name.split(' ')[0].replace(/[AB]$/, '');
    if (!labeledBuildings[baseName]) {
      labeledBuildings[baseName] = true;
      L.circleMarker(sceneToLatLng(building.e, building.n), {
        radius: 0, opacity: 0, fillOpacity: 0, interactive: false
      }).addTo(map).bindTooltip(baseName, {
        permanent: true, direction: 'center', className: 'mlbl'
      }).openTooltip();
    }
  });

  // 道路疊圖
  ROADS.forEach((road) => {
    const latLngs = road.points.map(p => sceneToLatLng(p[0], p[1]));
    L.polyline(latLngs, { color: '#cdd6df', weight: 3, opacity: 0.9 }).addTo(map);
    L.circleMarker(latLngs[Math.floor(latLngs.length / 2)], {
      radius: 0, opacity: 0, fillOpacity: 0, interactive: false
    }).addTo(map).bindTooltip(road.name, {
      permanent: true, direction: 'center', className: 'mlbl'
    });
  });

  // 河岸線
  const bankLatLngs = KEELUNG_RIVER_NORTH_BANK.map(p => sceneToLatLng(p[0], p[1]));
  L.polyline(bankLatLngs, { color: '#36c9b8', weight: 3, opacity: 0.85, dashArray: '5 4' }).addTo(map);

  // 觀測者標記
  const observer = BUILDINGS[observerIndex];
  const observerMarker = L.circleMarker(sceneToLatLng(observer.e, observer.n), {
    radius: 6, color: '#0b1418', weight: 2, fillColor: '#ffb454', fillOpacity: 1
  }).addTo(map).bindTooltip('視點', { permanent: true, direction: 'top', className: 'mlbl' });

  return { map, observerMarker };
}
