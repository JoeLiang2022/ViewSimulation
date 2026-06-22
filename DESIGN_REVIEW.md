# 遠雄明玥 視線模擬 v54 — 設計審查與改進建議

## 1. 專案概述

此 HTML 檔案是一個單頁互動式應用，用於模擬「遠雄明玥」（北投士林科技園區／洲美段）的各樓層視線狀況。功能包含：

- **3D 視覺化**：Three.js 渲染地形、建築量體、水系、橋樑
- **視線遮蔽計算**：考慮地球曲率折射、建物遮擋、地形遮擋
- **多視點切換**：明玥、泱玥、潤泰新洲美、達麗河蘊等觀測點
- **樓層滑桿**：即時計算不同樓層能否看到出海口、淡江大橋、基隆河
- **剖面圖（Cross-section）**：2D Canvas 繪製視線剖面
- **2D 鳥瞰地圖**：Leaflet + OSM/Esri 衛星底圖
- **衛星底圖貼地**：嘗試在 3D 場景貼上空照

---

## 2. 目前架構問題

### 2.1 單一檔案 / 巨石結構
- **問題**：全部 CSS + HTML + JavaScript（~42KB）塞在一個 HTML 檔案
- **影響**：難以維護、無法做 code splitting、無法寫單元測試

### 2.2 全域狀態散落
- **問題**：`OBSI`, `yaw`, `pitch`, `fov3d`, `mode2d`, `drag`, `showLbl`, `xsecOpen` 等全域變數直接暴露
- **影響**：容易產生 side effect，多人維護易衝突

### 2.3 壓縮/混淆式寫法
- **問題**：大量單字母變數（`R`, `K`, `D`, `f`, `s`, `h`, `t`）、極長單行邏輯
- **影響**：可讀性極低，除作者外幾乎無法理解

### 2.4 無錯誤處理 / 降級
- **問題**：Three.js 或 Leaflet CDN 載入失敗時無 fallback、WebGL 不支援時無提示
- **影響**：在受限環境（iOS WebView、企業防火牆）可能白屏

### 2.5 效能
- **問題**：
  - 地形網格 234×224 = 52,416 面（可接受但偏大）
  - `updateLabels()` 每幀對所有標籤做 3D→2D 投影 + DOM 操作
  - `visible()` 在 `refresh()` 被觸發三次，每次步進遍歷所有建物
  - 社子島/遠方市區用 `Math.random()` 產生 → 每次重載佈局不同
- **影響**：低階手機可能掉幀，random 導致不可重現

### 2.6 無障礙（Accessibility）
- **問題**：按鈕無 `aria-label`、滑桿無 `aria-valuetext`、色彩僅以紅綠區分可見/不可見
- **影響**：螢幕閱讀器使用者、色盲使用者無法正常操作

### 2.7 外部依賴版本
- **Three.js r128**（2021 年 6 月），目前已到 r160+，有多個重大 breaking change
- **Leaflet 1.9.4** 尚可

---

## 3. 改進建議

### 3.1 架構重組（高優先）

| 改進項目 | 做法 |
|----------|------|
| 拆分模組 | 建議改用 Vite + ES Module：`data/buildings.js`, `engine/terrain.js`, `engine/visibility.js`, `ui/panel.js`, `ui/crossSection.js`, `ui/map2d.js` |
| 狀態管理 | 引入輕量 reactive（如 Preact signals 或手寫 EventBus），集中管理 `floor`, `observer`, `mode` |
| 資料驅動 | 將 `BUILDINGS[]`, `PEAKS[]`, `ROADS[]` 等移入 JSON/YAML，方便非工程師更新座標 |

### 3.2 可讀性與維護性

| 改進項目 | 做法 |
|----------|------|
| 命名規範 | `R` → `EARTH_RADIUS`, `K` → `REFRACTION_COEFF`, `REFF` → `EFFECTIVE_EARTH_RADIUS` |
| 函式拆分 | `heightAt()` 內的多條件判斷拆為 `isSeaArea()`, `isRiverArea()`, `isWetland()`, `terrainElevation()` |
| 註解補充 | 每個 IIFE 前加 JSDoc 說明用途和數學公式來源 |
| 移除死碼 | `mode2d` 和 3D ortho camera 的邏輯重疊（按鈕切到 Leaflet 地圖而非 ortho 2D） |

### 3.3 效能優化

| 改進項目 | 做法 |
|----------|------|
| 標籤改 CSS3D / Sprite | 用 `CSS2DRenderer` 或改每幀只更新可見標籤（frustum cull 先過濾） |
| 視線計算快取 | `visible()` 結果在 floor/observer 不變時快取，避免拖曳時重算 |
| 隨機種子固定 | `Math.random()` 改用 seeded PRNG，確保場景可重現 |
| 地形 LOD | 遠處用低精度網格，近處再細分（或直接用 Quadtree heightmap） |

### 3.4 使用者體驗

| 改進項目 | 做法 |
|----------|------|
| 載入指示 | 加入 splash / loading spinner，等 CDN + 地形建立完再顯示 |
| 觸控改善 | 加入慣性滑動、雙擊歸位 |
| 操作提示 | Hint 改為首次使用引導（tooltip step-by-step），非 4.2 秒自動消失 |
| 螢幕方向 | 鎖定 landscape 或在 portrait 時調整 panel layout |
| 深色/淺色 | 目前僅深色，可加日間模式 |
| 截圖/分享 | 加入「匯出目前視角 PNG」功能，方便客戶簡報使用 |

### 3.5 無障礙

| 改進項目 | 做法 |
|----------|------|
| ARIA 屬性 | `role="slider"` + `aria-valuemin/max/now/valuetext` 給樓層滑桿 |
| 色彩對比 | 可見/不可見除紅綠外加圖示（✓ / ✕）← 目前已有文字，但 dot 顏色仍需輔助 |
| 鍵盤操作 | 按鈕要可 focus + Enter 觸發（目前用 `<button>` 已天生可行，但拖曳操作需加鍵盤替代） |
| Skip link | 3D Canvas 前加 skip 連結供跳至控制面板 |

### 3.6 安全 / 穩健

| 改進項目 | 做法 |
|----------|------|
| CDN fallback | 加入 `onerror` 回退到本地 bundle 或顯示錯誤提示 |
| WebGL 偵測 | 開場偵測 `getContext('webgl')` 失敗時顯示靜態替代圖 |
| CSP 相容 | inline script / style 改為外部檔案，支援嚴格 Content-Security-Policy |
| SRI | CDN 資源加入 `integrity` + `crossorigin` 屬性 |

---

## 4. 建議重構路線圖

```
Phase 1 — 基礎整理（1~2 天）
├── 拆出 buildings.json / roads.json / peaks.json
├── 命名 rename：單字母 → 有意義名稱
├── 加 JSDoc 註解
└── 固定隨機種子

Phase 2 — 模組化（2~3 天）
├── 導入 Vite / ES Modules
├── 拆分 terrain.js, visibility.js, camera.js, ui.js, crossSection.js, map2d.js
├── 引入簡易 state store
└── 加入 loading 畫面 + WebGL fallback

Phase 3 — 效能 + UX（2 天）
├── 標籤改 CSS2DRenderer
├── visibility 快取
├── 觸控慣性 + 雙擊歸位
└── 截圖功能

Phase 4 — A11y + 安全（1 天）
├── ARIA 屬性
├── 鍵盤操控
├── CDN fallback + SRI
└── WebGL 偵測降級
```

---

## 5. 維持現狀可接受的項目

以下是目前做得不錯、不需優先改動的：

- ✅ 地球曲率折射修正（K=0.13）— 物理模型正確
- ✅ 整體視覺風格統一（暗色科技感 dashboard）
- ✅ 觸控/滑鼠/wheel 三軌輸入完整
- ✅ 剖面圖即時繪製邏輯清晰
- ✅ Leaflet 2D 與 3D 雙模式切換順暢
- ✅ 多視點切換概念完整
- ✅ 建物半透明 ghost 標記未定建案 — 視覺語義明確

---

## 6. 技術債清單（Quick Fixes）

1. `user-scalable=no` — 違反 WCAG 2.5.5，建議移除或改為 `user-scalable=yes`
2. `maximum-scale=1` — 同上，在 iOS Safari 已無效但仍建議移除
3. `<script>` 在 `<head>` 載入未加 `defer/async` — 阻塞渲染
4. Three.js r128 使用已棄用 API（如 `THREE.sRGBEncoding`，r152 改為 `THREE.SRGBColorSpace`）
5. `setTimeout(()=>...,4200)` 硬編時間消除提示 — 應改為互動後消失
6. 2D mode (`mode2d`) 和 `map2dOn` 概念重疊 — `mode2d` 未被任何按鈕觸發，可移除或合併
7. `satPlane` 的 CORS 載入策略在 iframe/sandbox 下幾乎 100% 失敗 — 應標註為 known limitation
8. 衛星底圖的 tile 用 `new Image(); im.crossOrigin='anonymous'` 但 ArcGIS 未必回 CORS header

---

## 7. 總結

這是一個功能豐富、概念完整的視線模擬工具，對於房地產銷售端的「景觀價值論證」用途已相當實用。主要瓶頸在於：

1. **可維護性**：單檔 + 壓縮命名讓未來迭代成本高
2. **穩健性**：缺少錯誤處理和降級方案
3. **無障礙**：完全未考慮

建議以 Phase 1（基礎整理）為最低成本起點，不改功能只改結構，即可大幅降低後續維護門檻。
