/**
 * Three.js 3D 場景建構
 * 負責地形網格、水面、建物量體、橋樑、裝飾物件
 */
import { GROUND_ELEVATION } from './constants.js';
import { BUILDINGS } from '../data/buildings.js';
import { ROADS, SHEZI_ISLAND } from '../data/geography.js';
import { getTerrainAt, isInsidePolygon } from './terrain.js';
import { getBuildingTopHeight } from './visibility.js';

/**
 * 根據高程和地表類型決定頂點顏色
 */
function getTerrainColor(height, type) {
  const color = new THREE.Color();
  if (type === 'sea') return color.setHex(0x52707f);
  if (type === 'river') return color.setHex(0x5d7886);
  if (type === 'wet') return color.setHex(0x707a52);

  if (height < 22) color.setHex(0x6fa45a);
  else if (height < 120) color.lerpColors(new THREE.Color(0x6fa45a), new THREE.Color(0x95974f), (height - 22) / 98);
  else if (height < 320) color.lerpColors(new THREE.Color(0x95974f), new THREE.Color(0x9c8a5e), (height - 120) / 200);
  else if (height < 620) color.lerpColors(new THREE.Color(0x9c8a5e), new THREE.Color(0x8d7e6e), (height - 320) / 300);
  else color.lerpColors(new THREE.Color(0x8d7e6e), new THREE.Color(0xc6bfb0), Math.min(1, (height - 620) / 500));
  return color;
}

/**
 * 建立地形網格
 */
function createTerrainMesh() {
  // 擴大地形範圍覆蓋整個北台灣可見區域（約 60km × 60km）
  // 站在 1000F (~3400m) 時視距約 200km，需要能看到海岸輪廓
  const EAST_MIN = -30000, EAST_MAX = 20000;
  const NORTH_MIN = -25000, NORTH_MAX = 30000;
  const GRID_COLS = 280, GRID_ROWS = 280;

  const geometry = new THREE.BufferGeometry();
  const positions = [], colors = [], indices = [];

  for (let row = 0; row <= GRID_ROWS; row++) {
    for (let col = 0; col <= GRID_COLS; col++) {
      const easting = EAST_MIN + (EAST_MAX - EAST_MIN) * col / GRID_COLS;
      const northing = NORTH_MIN + (NORTH_MAX - NORTH_MIN) * row / GRID_ROWS;
      const terrain = getTerrainAt(easting, northing);

      // 海域頂點下沉到海平面以下，讓海面平面覆蓋
      // 河流頂點也微降，讓河面層覆蓋
      let vertexHeight;
      if (terrain.type === 'sea') vertexHeight = -10;
      else if (terrain.type === 'river') vertexHeight = -0.5;
      else vertexHeight = terrain.height;
      positions.push(easting, vertexHeight, -northing);
      const color = getTerrainColor(terrain.height, terrain.type);
      colors.push(color.r, color.g, color.b);
    }
  }

  const width = GRID_COLS + 1;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const a = row * width + col;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

/**
 * 建立海平面
 */
function createSeaPlane() {
  // 海面平面：使用 depthWrite + 高 renderOrder 確保完全遮蓋下方的海域地形
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120000, 120000),
    new THREE.MeshBasicMaterial({ color: 0x1a6080, depthWrite: true })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.1, 0);
  return sea;
}

/**
 * 建立建物量體 mesh 陣列
 * 建物從 GROUND_ELEVATION 開始往上蓋，不從 Y=0
 */
function createBuildingMeshes(scene) {
  const meshes = [];
  for (const building of BUILDINGS) {
    const topHeight = getBuildingTopHeight(building);
    const buildingHeight = topHeight - GROUND_ELEVATION; // 實際建物高度（不含地基）
    const material = building.ghost
      ? new THREE.MeshLambertMaterial({ color: building.color, transparent: true, opacity: 0.5 })
      : new THREE.MeshLambertMaterial({ color: building.color });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(building.w, buildingHeight, building.d), material);
    // box 中心在 GROUND_ELEVATION + buildingHeight/2 = (GROUND + top) / 2
    mesh.position.set(building.e, GROUND_ELEVATION + buildingHeight / 2, -building.n);
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

/**
 * 建立社子島低矮聚落（固定種子避免隨機差異）
 */
function createSheziVillage(scene) {
  const material = new THREE.MeshLambertMaterial({ color: 0x9aa488 });
  // 使用固定種子產生偽隨機
  let seed = 42;
  const seededRandom = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const range = (a, b) => a + seededRandom() * (b - a);

  for (let k = 0; k < 60; k++) {
    const e = range(-3900, -900);
    const n = range(-2100, -200);
    if (!isInsidePolygon(e, n, SHEZI_ISLAND) && seededRandom() < 0.6) continue;
    const h = range(6, 22), w = range(22, 46), d = range(22, 46);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(e, h / 2 + 2.5, -n);
    scene.add(mesh);
  }
}

/**
 * 建立遠方市區剪影
 */
function createDistantCityscape(scene) {
  const material = new THREE.MeshLambertMaterial({ color: 0xa7bac7 });
  let seed = 99;
  const seededRandom = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const range = (a, b) => a + seededRandom() * (b - a);

  const clusters = [
    [-4600, 4200, 1700, 1100], [-6200, 5200, 1900, 1300],
    [-8000, 5600, 1700, 1200], [-9600, 6200, 1500, 1100],
    [-5200, 2600, 1500, 1000], [-7000, 3400, 1500, 1100]
  ];

  for (const [centerE, centerN, widthE, widthN] of clusters) {
    for (let k = 0; k < 7; k++) {
      const e = centerE + range(-widthE / 2, widthE / 2);
      const n = centerN + range(-widthN / 2, widthN / 2);
      const h = range(16, 52), w = range(36, 90), d = range(36, 90);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(e, h / 2, -n);
      scene.add(mesh);
    }
  }
}

/**
 * 建立關渡大橋（紅拱）
 */
function createGuanduBridge(scene) {
  const group = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(720, 9, 26), red);
  deck.position.y = 12;
  group.add(deck);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(300, 11, 8, 28, Math.PI), red);
  arch.position.set(0, 12, 0);
  group.add(arch);
  group.position.set(-5340, 0, -1550);
  group.rotation.y = 0.86;
  scene.add(group);
}

/**
 * 建立淡江大橋（白塔斜張橋）
 */
function createDanjiangBridge(scene, bridgeTarget) {
  const group = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(40, 211, 40),
    new THREE.MeshLambertMaterial({ color: 0xececf0 })
  );
  tower.position.set(bridgeTarget[0], 211 / 2, -bridgeTarget[1]);
  group.add(tower);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1700, 8, 30),
    new THREE.MeshLambertMaterial({ color: 0xccd0d6 })
  );
  deck.position.set(bridgeTarget[0] + 250, 18, -(bridgeTarget[1] + 340));
  deck.rotation.y = 0.62;
  group.add(deck);
  scene.add(group);
}

/**
 * 建立路帶 ribbon（貼地不遮蔽視線）
 */
function createRoadRibbon(points, width, color, scene) {
  const halfWidth = width / 2;
  const positions = [], indices = [];
  let vertexIndex = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b[0] - a[0], dn = b[1] - a[1];
    const length = Math.hypot(dx, dn) || 1;
    const perpE = -dn / length * halfWidth;
    const perpN = dx / length * halfWidth;

    positions.push(
      a[0] + perpE, 4.7, -(a[1] + perpN),
      a[0] - perpE, 4.7, -(a[1] - perpN),
      b[0] + perpE, 4.7, -(b[1] + perpN),
      b[0] - perpE, 4.7, -(b[1] - perpN)
    );
    indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex + 1, vertexIndex + 3, vertexIndex + 2);
    vertexIndex += 4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
}

/**
 * 建立裝飾物件（操場、庭園、公園）
 */
function createDecorations(decorGroup) {
  // 洲美國小操場
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(168, 138),
    new THREE.MeshLambertMaterial({ color: 0x5c8a45 })
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(-128, 4.3, -126);
  decorGroup.add(field);

  const track = new THREE.Mesh(
    new THREE.RingGeometry(38, 50, 36),
    new THREE.MeshBasicMaterial({ color: 0xb15a40, side: THREE.DoubleSide })
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(-112, 4.6, -108);
  track.scale.set(1.4, 1, 1);
  decorGroup.add(track);

  const infield = new THREE.Mesh(
    new THREE.CircleGeometry(38, 28),
    new THREE.MeshLambertMaterial({ color: 0x4f7d38 })
  );
  infield.rotation.x = -Math.PI / 2;
  infield.position.set(-112, 4.5, -108);
  infield.scale.set(1.4, 1, 1);
  decorGroup.add(infield);

  // 明玥庭園
  const garden = new THREE.Mesh(
    new THREE.PlaneGeometry(74, 60),
    new THREE.MeshLambertMaterial({ color: 0x6cae55 })
  );
  garden.rotation.x = -Math.PI / 2;
  garden.position.set(0, 0.6, -2);
  decorGroup.add(garden);

  // 公園綠地
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 120),
    new THREE.MeshLambertMaterial({ color: 0x4f8f4e })
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(255, 4.3, -175);
  decorGroup.add(park);
}

/**
 * 初始化整個 3D 場景
 * @returns {{ scene, camera, renderer, decorGroup, buildingMeshes }}
 */
export function initScene(canvas, bridgeTarget) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.localClippingEnabled = true;  // 啟用材質層級的 clipping plane

  const scene = new THREE.Scene();
  const decorGroup = new THREE.Group();
  scene.add(decorGroup);

  // 天空漸層背景（下方偏暖白，與深藍海面形成明顯對比）
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#5b8ebd');
  gradient.addColorStop(0.35, '#8cb8d6');
  gradient.addColorStop(0.65, '#c8dce8');
  gradient.addColorStop(0.85, '#e8eff4');
  gradient.addColorStop(1, '#f5f0e8');
  skyCtx.fillStyle = gradient;
  skyCtx.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(skyCanvas);

  // 霧效（遠處淡化，但不過早開始以免遮住海面）
  scene.fog = new THREE.Fog(0xe8eff4, 8000, 28000);

  // 相機（遠裁面加大，站高樓時能看到遠處海岸線）
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 80000);

  // 光源
  scene.add(new THREE.AmbientLight(0xffffff, 0.58));
  scene.add(new THREE.HemisphereLight(0xcdd9e0, 0x6f7e54, 0.42));
  const sun = new THREE.DirectionalLight(0xf4f1ea, 0.5);
  sun.position.set(-6000, 9000, 3000);
  scene.add(sun);

  // 地形
  const terrainMesh = createTerrainMesh();
  scene.add(terrainMesh);
  scene.add(createSeaPlane());

  // 河面覆蓋層（確保基隆河/淡水河在任何模式下都清楚可見）
  const riverMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a6a8a,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });
  // 基隆河面（在近景建物旁邊，最重要）
  const keelungRiver = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 280),
    riverMaterial
  );
  keelungRiver.rotation.x = -Math.PI / 2;
  keelungRiver.position.set(200, 0.6, 180); // 基隆河在明玥南側
  keelungRiver.rotation.z = 0.15; // 微轉對齊河道方向
  scene.add(keelungRiver);

  // 淡水河面
  const tamsuiRiver = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 500),
    riverMaterial
  );
  tamsuiRiver.rotation.x = -Math.PI / 2;
  tamsuiRiver.position.set(-6500, 0.5, -3500);
  tamsuiRiver.rotation.z = 0.55; // 對齊淡水河走向（西北-東南）
  scene.add(tamsuiRiver);

  // 海面標示：在出海口附近加一圈白色泡沫線，標示海岸線
  const shorelineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
  const shorelinePoints = [
    new THREE.Vector3(-12500, 1.5, -7500),
    new THREE.Vector3(-11500, 1.5, -8000),
    new THREE.Vector3(-10700, 1.5, -8240),
    new THREE.Vector3(-9800, 1.5, -8600),
    new THREE.Vector3(-8500, 1.5, -9200),
  ];
  const shorelineGeom = new THREE.BufferGeometry().setFromPoints(shorelinePoints);
  scene.add(new THREE.Line(shorelineGeom, shorelineMaterial));

  // 建物
  const buildingMeshes = createBuildingMeshes(scene);

  // 裝飾
  createSheziVillage(scene);
  createDistantCityscape(scene);
  createGuanduBridge(scene);
  createDanjiangBridge(scene, bridgeTarget);
  createDecorations(decorGroup);

  // 路網
  for (const road of ROADS) {
    createRoadRibbon(road.points, 13, 0x6b7682, scene);
  }

  return { scene, camera, renderer, decorGroup, buildingMeshes, terrainMesh };
}
