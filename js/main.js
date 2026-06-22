/**
 * 主程式入口
 * 負責初始化場景、綁定 UI 事件、啟動渲染循環
 */
import { BUILDINGS } from '../data/buildings.js';
import { TARGETS, LABELS } from '../data/geography.js';
import { initScene } from './scene.js';
import { checkVisibility, floorToEyeHeight, findMinSeaFloor, getBuildingTopHeight } from './visibility.js';
import { drawCrossSection, getCrossSectionCaption } from './crossSection.js';
import { initLeafletMap, sceneToLatLng } from './map2d.js';
import { loadSatelliteGround, removeSatelliteGround } from './satellite.js';

// ============================================================
// WebGL 支援偵測
// ============================================================
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

// ============================================================
// 等待 CDN 載入完成
// ============================================================
function waitForDependencies(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.THREE) { resolve(); return; }
      if (Date.now() - start > timeoutMs) { reject(new Error('Three.js 載入超時')); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

// ============================================================
// 主程式啟動
// ============================================================
async function main() {
  const loadingScreen = document.getElementById('loading-screen');
  const fallbackMessage = document.getElementById('fallback-message');

  // WebGL 檢查
  if (!checkWebGLSupport()) {
    loadingScreen.style.display = 'none';
    fallbackMessage.style.display = 'flex';
    return;
  }

  // 等待 Three.js 載入
  try {
    await waitForDependencies();
  } catch (error) {
    loadingScreen.querySelector('.text').textContent = '載入失敗：' + error.message;
    return;
  }

  // --- 場景初始化 ---
  const canvas = document.getElementById('scene');
  const { scene, camera, renderer, decorGroup, buildingMeshes } = initScene(canvas, TARGETS.BRIDGE);

  // --- 狀態變數 ---
  let observerIndex = 0;
  let yaw = Math.atan2(TARGETS.SEA[0] - getObserver().e, TARGETS.SEA[1] - getObserver().n);
  let pitch = -0.04;
  let fieldOfView = 60;
  let currentTarget = TARGETS.SEA;
  let showLabels = true;
  let isCrossSectionOpen = false;
  let isMap2dOn = false;
  let leafletMap = null;
  let observerMarker = null;
  let satPlane = null;
  let minSeaFloor = findMinSeaFloor(TARGETS.SEA, getObserver());

  // 2D ortho 相關
  let panE = 0, panN = 180, zoomLevel = 1;

  // 拖曳
  let isDragging = false, lastX = 0, lastY = 0, pinchDist = 0;

  // 可切換視點列表
  const viewpointIndices = BUILDINGS.map((b, i) => i).filter(i => BUILDINGS[i].obs || BUILDINGS[i].vp);

  function getObserver() { return BUILDINGS[observerIndex]; }

  // --- 隱藏目前觀測建物 mesh ---
  function updateBuildingVisibility() {
    for (let k = 0; k < buildingMeshes.length; k++) {
      buildingMeshes[k].visible = isMap2dOn ? true : (k !== observerIndex);
    }
  }
  updateBuildingVisibility();

  // --- 相機控制 ---
  function applyCamera(eyeHeight) {
    const obs = getObserver();
    if (camera.fov !== fieldOfView) {
      camera.fov = fieldOfView;
      camera.updateProjectionMatrix();
    }
    camera.position.set(obs.e, eyeHeight, -obs.n);
    const fx = Math.cos(pitch) * Math.sin(yaw);
    const fy = Math.sin(pitch);
    const fz = -Math.cos(pitch) * Math.cos(yaw);
    camera.lookAt(obs.e + fx * 1000, eyeHeight + fy * 1000, -obs.n + fz * 1000);
  }

  function setPitch(value) {
    pitch = Math.max(-1.30, Math.min(0.80, value));
    const tiltSlider = document.getElementById('tilt');
    if (tiltSlider) tiltSlider.value = pitch;
  }

  // --- 視線射線 ---
  const rayMaterial = new THREE.LineBasicMaterial({ color: 0xffb454 });
  let rayLine = null;

  function updateRay(target, eyeHeight) {
    if (rayLine) { scene.remove(rayLine); rayLine.geometry.dispose(); }
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(getObserver().e, eyeHeight, -getObserver().n),
      new THREE.Vector3(target[0], target[2], -target[1])
    ]);
    rayLine = new THREE.Line(geometry, rayMaterial);
    scene.add(rayLine);
  }

  // --- 標籤系統 ---
  const labelElements = LABELS.map(label => {
    const div = document.createElement('div');
    div.className = 'lbl ' + (label.category || '');
    div.textContent = label.text;
    document.body.appendChild(div);
    return div;
  });

  function updateLabelsPosition() {
    for (let i = 0; i < LABELS.length; i++) {
      const el = labelElements[i];
      const label = LABELS[i];

      // 隱藏觀測者自身標籤
      if (!isMap2dOn && label.selfKey && getObserver().name.indexOf(label.selfKey) >= 0) {
        el.style.display = 'none';
        continue;
      }

      const projected = new THREE.Vector3(label.position[0], label.position[1], -label.position[2]).project(camera);
      if (!showLabels || projected.z > 1 || projected.x < -1.1 || projected.x > 1.1 || projected.y < -1.1 || projected.y > 1.1) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';
      el.style.left = ((projected.x * 0.5 + 0.5) * innerWidth) + 'px';
      el.style.top = ((-projected.y * 0.5 + 0.5) * innerHeight) + 'px';
    }
  }

  // --- UI 更新 ---
  const floorSlider = document.getElementById('floor');

  function formatDistance(meters) {
    return (meters / 1000).toFixed(1) + 'km';
  }

  function setChipStatus(chipId, result) {
    const chip = document.getElementById(chipId);
    chip.classList.remove('ok', 'no');
    chip.classList.add(result.ok ? 'ok' : 'no');
    chip.querySelector('.t').textContent = result.ok ? '看得到' : '被擋住';
  }

  function refresh() {
    const floor = +floorSlider.value;
    const eyeHeight = floorToEyeHeight(floor);

    // 更新樓層顯示
    document.getElementById('flN').textContent = floor;
    document.getElementById('htV').textContent = Math.round(eyeHeight);

    const tag = document.getElementById('flTag');
    if (floor <= getObserver().fl) {
      tag.textContent = '實際樓層';
      tag.className = 'tag real';
    } else {
      tag.textContent = '假設加高(本案' + getObserver().fl + '樓)';
      tag.className = 'tag hyp';
    }

    // 計算視線
    const seaResult = checkVisibility(TARGETS.SEA, eyeHeight, getObserver());
    const bridgeResult = checkVisibility(TARGETS.BRIDGE, eyeHeight, getObserver());
    const riverResult = checkVisibility(TARGETS.RIVER, eyeHeight, getObserver());

    setChipStatus('chSea', seaResult);
    setChipStatus('chBridge', bridgeResult);
    setChipStatus('chRiver', riverResult);

    document.getElementById('dSea').textContent = seaResult.ok
      ? '海距 ' + formatDistance(13500)
      : ('被' + (seaResult.by || '') + '擋');
    document.getElementById('dBridge').textContent = bridgeResult.ok
      ? '塔頂可見'
      : '遮點 ' + formatDistance(bridgeResult.at);
    document.getElementById('dRiver').textContent = riverResult.ok
      ? '水面/平原可見'
      : ('被' + (riverResult.by || '') + '擋 @' + formatDistance(riverResult.at));

    applyCamera(eyeHeight);
    updateRay(currentTarget, eyeHeight);

    if (isCrossSectionOpen) {
      const xcanvas = document.getElementById('xcanvas');
      const result = drawCrossSection(xcanvas, eyeHeight, minSeaFloor);
      document.getElementById('xcap').innerHTML = getCrossSectionCaption(result);
    }
  }

  // --- 樓層刻度 ---
  (function initFloorMarks() {
    const marksContainer = document.getElementById('marks');
    const maxFloor = +floorSlider.max;

    function addMark(floor, cssClass, text) {
      const div = document.createElement('div');
      div.className = 'mk ' + cssClass;
      div.style.left = ((floor - 1) / (maxFloor - 1) * 100) + '%';
      div.innerHTML = '<i></i>' + text;
      marksContainer.appendChild(div);
    }

    addMark(1, '', '1F');
    addMark(23, 'real', '23F');
    addMark(27, '', '27F');
    if (minSeaFloor) addMark(minSeaFloor, 'sea', '見海 ' + minSeaFloor + 'F');
    addMark(maxFloor, '', maxFloor + 'F');
  })();

  // --- 事件綁定 ---
  floorSlider.addEventListener('input', refresh);

  document.getElementById('bSea').onclick = () => {
    currentTarget = TARGETS.SEA;
    yaw = Math.atan2(TARGETS.SEA[0] - getObserver().e, TARGETS.SEA[1] - getObserver().n);
    setPitch(-0.04);
    document.getElementById('cName').textContent = '出海口';
    refresh();
  };

  document.getElementById('bBridge').onclick = () => {
    currentTarget = TARGETS.BRIDGE;
    yaw = Math.atan2(TARGETS.BRIDGE[0] - getObserver().e, TARGETS.BRIDGE[1] - getObserver().n);
    setPitch(-0.02);
    document.getElementById('cName').textContent = '淡江大橋';
    refresh();
  };

  document.getElementById('bNear').onclick = () => {
    currentTarget = TARGETS.RIVER;
    yaw = Math.atan2(TARGETS.RIVER[0] - getObserver().e, TARGETS.RIVER[1] - getObserver().n);
    setPitch(-0.55);
    document.getElementById('cName').textContent = '近景俯瞰';
    refresh();
  };

  document.getElementById('bLbl').onclick = function () {
    showLabels = !showLabels;
    this.classList.toggle('on', showLabels);
  };

  // 視點切換
  function setObserver(index) {
    observerIndex = index;
    updateBuildingVisibility();
    minSeaFloor = findMinSeaFloor(TARGETS.SEA, getObserver());

    const name = getObserver().name.split(' ')[0];
    document.getElementById('titleH').textContent = '視點:' + name + ' → 全分區建築';

    const currentVpIndex = viewpointIndices.indexOf(observerIndex);
    const nextIndex = viewpointIndices[(currentVpIndex + 1) % viewpointIndices.length];
    document.getElementById('bObs').textContent = '視點→' + BUILDINGS[nextIndex].name.split(' ')[0];

    floorSlider.value = Math.min(+floorSlider.max, getObserver().fl);
    yaw = Math.atan2(TARGETS.SEA[0] - getObserver().e, TARGETS.SEA[1] - getObserver().n);
    setPitch(-0.05);
    document.getElementById('cName').textContent = name + ' 視點 ' + getObserver().fl + 'F';
    refresh();
  }

  document.getElementById('bObs').onclick = () => {
    const currentVpIndex = viewpointIndices.indexOf(observerIndex);
    setObserver(viewpointIndices[(currentVpIndex + 1) % viewpointIndices.length]);
  };

  // 剖面圖
  const xsecPanel = document.getElementById('xsec');
  document.getElementById('bXsec').onclick = function () {
    isCrossSectionOpen = !isCrossSectionOpen;
    xsecPanel.classList.toggle('show', isCrossSectionOpen);
    this.classList.toggle('on', isCrossSectionOpen);
    if (isCrossSectionOpen) {
      const xcanvas = document.getElementById('xcanvas');
      const result = drawCrossSection(xcanvas, floorToEyeHeight(+floorSlider.value), minSeaFloor);
      document.getElementById('xcap').innerHTML = getCrossSectionCaption(result);
    }
  };
  document.getElementById('xClose').onclick = () => {
    isCrossSectionOpen = false;
    xsecPanel.classList.remove('show');
    document.getElementById('bXsec').classList.remove('on');
  };

  // 2D 地圖
  document.getElementById('b2d').onclick = function () {
    isMap2dOn = !isMap2dOn;
    document.getElementById('map2d').style.display = isMap2dOn ? 'block' : 'none';
    canvas.style.display = isMap2dOn ? 'none' : 'block';
    document.body.classList.toggle('mapmode', isMap2dOn);
    this.textContent = isMap2dOn ? '3D視角' : '2D鳥瞰';
    this.classList.toggle('on', isMap2dOn);

    if (isMap2dOn) {
      if (!leafletMap && typeof L !== 'undefined') {
        const result = initLeafletMap('map2d', observerIndex);
        leafletMap = result.map;
        observerMarker = result.observerMarker;
      }
      if (observerMarker) observerMarker.setLatLng(sceneToLatLng(getObserver().e, getObserver().n));
      if (leafletMap) {
        setTimeout(() => { leafletMap.invalidateSize(); leafletMap.setView(sceneToLatLng(60, 80), 17); }, 60);
      }
    }
    updateBuildingVisibility();
  };

  // 衛星底圖
  document.getElementById('bsat').onclick = async function () {
    if (satPlane) {
      removeSatelliteGround(satPlane, scene, decorGroup);
      satPlane = null;
      this.textContent = '衛星底圖';
      this.classList.remove('on');
      return;
    }
    const btn = this;
    try {
      satPlane = await loadSatelliteGround(scene, decorGroup, (text) => { btn.textContent = text; });
      if (satPlane) {
        btn.classList.add('on');
      } else {
        btn.textContent = '衛星底圖';
        alert('Esri 空照與 OSM 圖磚都無法載入（可能因 CORS 限制）。');
      }
    } catch (e) {
      btn.textContent = '衛星底圖';
      alert('載入失敗: ' + e.message);
    }
  };

  // --- 拖曳/觸控操作 ---
  function startDrag(x, y) {
    isDragging = true;
    lastX = x;
    lastY = y;
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = 0;
  }

  function moveDrag(x, y) {
    if (!isDragging) return;
    if (isMap2dOn) return; // 地圖模式由 Leaflet 處理
    yaw -= (x - lastX) * 0.0032;
    setPitch(pitch - (y - lastY) * 0.0032);
    lastX = x;
    lastY = y;
  }

  function endDrag() { isDragging = false; pinchDist = 0; }

  // 滑鼠
  canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  // 觸控
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      isDragging = false;
      return;
    }
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchDist) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      fieldOfView = Math.max(12, Math.min(78, fieldOfView * pinchDist / dist));
      pinchDist = dist;
      return;
    }
    if (!isDragging) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  canvas.addEventListener('touchend', endDrag);
  canvas.addEventListener('touchcancel', endDrag);

  // 滾輪縮放
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    fieldOfView = Math.max(12, Math.min(78, fieldOfView * (e.deltaY < 0 ? 0.92 : 1.08)));
  }, { passive: false });

  // 俯仰滑桿
  const tiltSlider = document.getElementById('tilt');
  if (tiltSlider) tiltSlider.addEventListener('input', () => { pitch = +tiltSlider.value; });

  // 提示自動消失（首次互動後）
  setTimeout(() => { const h = document.getElementById('hint'); if (h) h.style.opacity = 0; }, 4200);

  // --- 視窗調整 ---
  function handleResize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', handleResize);
  handleResize();

  // --- 渲染循環 ---
  const headingDisplay = document.getElementById('cHead');
  const zoomDisplay = document.getElementById('cZoom');

  function renderLoop() {
    const eyeHeight = floorToEyeHeight(+floorSlider.value);
    applyCamera(eyeHeight);

    // 更新羅盤
    let heading = (Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 180 / Math.PI);
    heading = (heading + 360) % 360;
    headingDisplay.textContent = Math.round(heading) + '°';
    if (zoomDisplay) zoomDisplay.textContent = '×' + (60 / fieldOfView).toFixed(1);

    if (isMap2dOn) { requestAnimationFrame(renderLoop); return; }

    updateLabelsPosition();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }

  // --- 啟動 ---
  refresh();
  loadingScreen.classList.add('hidden');
  renderLoop();
}

// 啟動主程式
main().catch(error => {
  console.error('應用啟動失敗:', error);
  const loading = document.getElementById('loading-screen');
  if (loading) loading.querySelector('.text').textContent = '啟動失敗: ' + error.message;
});
