# 專案架構

> 本文件掃描 repo 實況後撰寫，所有規劃、開發、審查都依此進行。
> 這是「遠雄明玥 視線模擬」單頁 web app：給定基地與周邊建案 3D 配置，計算任一樓層視線是否被遮擋、產生鳥瞰/剖面圖。

## 1. 概觀

### 技術棧
- **執行環境**：純前端瀏覽器，靜態檔案，無 server、無 build step。
- **渲染**：Three.js r128（CDN，CDN 失敗會自動 fallback 到 unpkg）。
- **2D 地圖**：Leaflet 1.9.4（CDN，失敗則 2D 功能停用但不影響 3D）。
- **模組系統**：原生 ES Modules（`<script type="module">`）。
- **語言**：JavaScript（無 TypeScript）、CSS、HTML。
- **部署**：任何能提供靜態檔案的 HTTP server（直接開 index.html 因 ES Module CORS 限制會失敗，需透過 server）。

### 目錄一覽（實際）
```
/
├── index.html                 # 入口，宣告 DOM 骨架、載入 CDN 與 js/main.js
├── css/style.css              # 全站樣式（dashboard 深色主題，228 行）
├── data/
│   ├── buildings.js           # 建物資料陣列（32 棟，座標+樓層+顏色）
│   └── geography.js           # 地形高程、河道、路網、3D 標籤點位
├── js/
│   ├── main.js                # 入口：初始化、事件綁定、render loop（~483 行）
│   ├── constants.js           # 物理常數（地球半徑、折射、層高、錨點經緯度）
│   ├── scene.js               # Three.js 場景建構（地形網格、建物、橋樑、裝飾）
│   ├── terrain.js             # 地形高程查詢（高斯山峰 + 河道/海域判定）
│   ├── visibility.js          # 視線遮蔽核心演算法（射線步進 + 曲率修正）
│   ├── crossSection.js        # 2D 剖面圖繪製（Canvas 2D）
│   ├── map2d.js               # Leaflet 鳥瞰圖
│   └── satellite.js           # 衛星圖磚拼接 + 貼合地形 mesh
├── DESIGN_REVIEW.md           # 既有的設計檢討（可參考，部分已實作）
└── 遠雄明玥_視線模擬_v54.html # 歷史單檔版本（勿動，當作考古）
```

### 常用指令（實際驗證過的）
| 動作 | 指令 | 說明 |
|------|------|------|
| 本地開發 | `python3 -m http.server 8000` 或 `npx serve` | 必須透過 HTTP，因為用 ES Module |
| 建置 | （無） | 無 bundler，直接部署即可 |
| 測試 | （無） | 專案無任何自動化測試 |
| Lint / 型別檢查 | （無） | 未設定 ESLint / tsc |
| 驗證 | 手動在 Chrome / Safari 開 `http://localhost:8000/` | 檢查 4 個按鈕都能動：剖面圖 / 2D鳥瞰 / 衛星底圖 / 視點切換 |

> **新增檢查前請先確認**：加 ESLint / Prettier 的成本低；加測試需先引入 build tool（目前刻意保持零相依）。

## 2. 分層與依賴方向

這是個小型可視化專案，不需要 Domain/Repository 之類的分層。實際只分三層：

```
  index.html / css/              （視圖骨架）
           │
           ▼
     js/main.js                  （協調層：綁 UI、管狀態、驅動 render loop）
           │
     ┌─────┼─────┬──────────┬─────────────┐
     ▼     ▼     ▼          ▼             ▼
  scene  visibility  crossSection  map2d  satellite
     │     │     │          │             │
     └──┬──┴──┬──┴──────────┴─────────────┘
        ▼     ▼
    terrain  constants             （基礎運算 / 常數）
        │
        ▼
      data/*.js                    （純資料）
```

### 每個目錄的職責與依賴規則

| 目錄 / 檔案 | 職責 | 可以 import 誰 | 禁止 |
|---|---|---|---|
| `data/*.js` | 純資料常量（建物座標、山峰、河道、標籤）。只 export const，不含邏輯 | 不 import 任何東西 | 不得依賴 `js/*`、不得使用 `THREE`、不得有 side effect |
| `js/constants.js` | 物理與地理常數 | 不 import 任何東西 | 同上 |
| `js/terrain.js` | 地形高程查詢、多邊形判定（純函式） | `constants.js`, `data/geography.js` | 不得 import `THREE`、不得碰 DOM |
| `js/visibility.js` | 視線遮蔽計算（純函式） | `constants.js`, `data/buildings.js`, `terrain.js` | 不得 import `THREE`、不得碰 DOM |
| `js/crossSection.js` | 剖面圖繪製（Canvas 2D） | `constants.js`, `data/geography.js`, `terrain.js`, `visibility.js` | 不得使用 `THREE`、僅收 canvas 當參數 |
| `js/scene.js` | Three.js 場景建構 | `constants.js`, `data/*`, `terrain.js`, `visibility.js` | 不得碰 UI DOM（除了收到的 canvas） |
| `js/map2d.js` | Leaflet 鳥瞰圖 | `constants.js`, `data/*` | 不得使用 `THREE`、不得 import `js/scene.js` |
| `js/satellite.js` | 衛星圖磚拼接貼合地形 | `constants.js` + 透過參數收 `terrainMesh` | 不得 import `data/*`（純處理圖磚） |
| `js/main.js` | 唯一的「協調者」：建場景、綁事件、管狀態、呼叫上面所有模組 | 全部可以 | — |

**最重要的一條規則**：`data/` 和 `js/` 中除 `main.js` 和 `scene.js` 外的檔案都應該是「純」的（純函式、純資料），這樣視線計算的正確性才能獨立於渲染被推理。**要改視線的正確性，改 visibility.js / terrain.js / constants.js；要改視覺效果，改 scene.js / css。**

## 3. 資料流

### 啟動流程（一次性）
`index.html` → `js/main.js` 的 `main()`：
1. WebGL 偵測 → 失敗秀 `#fallback-message` 結束。
2. 等 `window.THREE` 載入完（`waitForDependencies`，10 秒 timeout）。
3. `initScene(canvas, TARGETS.BRIDGE)` 建出 scene/camera/renderer 和 `buildingMeshes[]`、`terrainMesh`：
   - `createTerrainMesh()` 用 280×280 網格逐點呼叫 `getTerrainAt()` 建地形。
   - `createBuildingMeshes()` 依 `BUILDINGS` 每筆建 BoxGeometry，用 `getBuildingTopHeight()` 決定高度。
   - 其他：海平面、關渡大橋、淡江大橋、社子島聚落、遠方市區剪影、路帶、裝飾群組。
4. 建 DOM 標籤元素（每個 `LABELS` 建一個 `div.lbl`）。
5. `refresh()` 首次計算 → `renderLoop()` 開始每幀渲染。

### 使用者改樓層的流程（熱路徑）
拉 `#floor` slider → `refresh()`：
1. `floorToEyeHeight(floor)` → 眼高 m（`GROUND_ELEVATION + floor * FLOOR_HEIGHT`）。
2. 對 3 個目標各呼叫一次 `checkVisibility(target, eyeHeight, observer)`：
   - 沿觀測者→目標的射線以 12m / 40m 步距取樣。
   - 每步算視線高度（含地球曲率折射修正：`-range*(total-range)/(2*EFFECTIVE_EARTH_RADIUS)`）。
   - 檢查該點 (sampleE, sampleN) 是否被任何 `BUILDINGS` 的 top 高度擋住、或被 `getTerrainAt()` 擋住。
3. `applyCamera(eyeHeight)` 更新相機位置到 `(obs.e, eyeHeight, -obs.n)`。
4. 若剖面圖開啟，`drawCrossSection(canvas, eyeHeight, minSeaFloor)` 重畫。

### 視線遮蔽的實際依賴圖
```
checkVisibility()                 ← visibility.js
  ├─ EFFECTIVE_EARTH_RADIUS       ← constants.js
  ├─ BUILDINGS                    ← data/buildings.js
  ├─ getBuildingTopHeight()       ← visibility.js (GROUND_ELEVATION + fl * FLOOR_HEIGHT)
  └─ getTerrainAt()               ← terrain.js
       ├─ PEAKS, 河道, 海岸        ← data/geography.js
       └─ GROUND_ELEVATION         ← constants.js
```
**所以樓層高度正確與否的唯一來源**是 `GROUND_ELEVATION`（目前 4m）+ `FLOOR_HEIGHT`（目前 3.4m/層），任何樓層高度改動都改這裡，不能在別處硬編。

## 4. 範本檔案

| 要新增什麼 | 照抄哪個檔案 / 哪一段 | 注意事項 |
|---|---|---|
| 新增一棟建案（確定蓋的） | `data/buildings.js` 的任一 entry（例如遠雄泱玥那行） | 必填 `name, e, n, w, d, fl, color`。座標是「以遠雄明玥為原點、東正北正、公尺」；`fl` 是地上樓數，不要加地下樓。顏色用 hex 整數 |
| 新增未定建案（半透明） | `data/buildings.js` 的 `河岸建案` 那行 | 加 `ghost: true`，渲染時會自動 opacity 0.5 |
| 新增可切換視點 | `data/buildings.js` 的 `潤泰新洲美` 那行 | 加 `obs: true` 或 `vp: true`；`main.js` 的 `viewpointIndices` 會自動納入 |
| 新增一座山 | `data/geography.js` 的 `PEAKS` 陣列 | 高斯模型：`{e, n, amplitude: 峰高m, spread: 擴散半徑m}`。`amplitude` 是**基地上方**的相對高度，`getTerrainAt` 會加到 `GROUND_ELEVATION` |
| 新增一條河 | 新增 polyline 常量到 `data/geography.js`，再到 `terrain.js` 的 `getTerrainAt` 加一段 `distanceToPolyline` 判定 | 參考 `TAMSUI_RIVER` + 在 `getTerrainAt` 的對應段 |
| 新增 3D 場景裡的文字標籤 | `data/geography.js` 的 `LABELS` 陣列 | `position: [east, 高度, north]`（注意這裡 north 是正值，`main.js` 投影時會自動變號）。`category` 控制 CSS class（`peak/water/flat/road/bld`） |
| 新增按鈕 / 面板功能 | `index.html` 的 `<div class="btns">` 區塊 + `js/main.js` 的事件綁定段 | 事件綁定全部集中在 `main.js` 中段（搜尋 `document.getElementById('bSea').onclick`） |
| 新增 3D 裝飾物件 | `js/scene.js` 的 `createDecorations()` | 用 `polygonOffset` 避免 z-fight；高度放 Y=5~6 的範圍 |
| 新增橋樑之類的地標 | `js/scene.js` 的 `createDanjiangBridge()` | 直接 add 到 `scene`；高度要和 `TARGETS.BRIDGE[2]` 一致 |
| 調整物理常數 | `js/constants.js` | 只改這裡，絕對不要在其他檔案硬編 `3.4`、`4`、`0.13` 等 |

## 5. 規則

### 5.1 座標系（**最容易出錯的地方**）
- **統一單位**：公尺。**統一原點**：遠雄明玥 (0,0)。
- **資料層**（`data/`, `terrain.js`, `visibility.js`）：東=+e，北=+n。和真實地圖方位一致。
- **Three.js 場景**：東=+X，北=**−Z**（因為 Three.js 的 Z 軸正向是螢幕外）。所以凡是把資料座標塞進 Three.js，都要寫 `(e, height, -n)`，例子見 `scene.js` 到處都是。
- **高度 Y 軸**：海平面=0，地面=`GROUND_ELEVATION`（4m），樓頂=`GROUND_ELEVATION + fl * FLOOR_HEIGHT`。

### 5.2 樓層高度（本次任務重點）
- 眼高一律用 `floorToEyeHeight(floor)`，**禁止**在別處用 `floor * 3.4` 或類似寫法。
- 建物頂一律用 `getBuildingTopHeight(building)`，**禁止**在別處算。
- 一樓的眼高就是 `GROUND_ELEVATION + FLOOR_HEIGHT`（約 7.4m），這是「一樓地板到視線點」，包含地面高度。若之後要區分「樓板高度」和「視線點高度（+1.5m 人眼）」，統一加在 `floorToEyeHeight` 內，不要散落。
- 建物 Mesh 的位置：`createBuildingMeshes` 內 box 中心 Y = `GROUND_ELEVATION + buildingHeight/2`，底面貼在地面 4m 而非 0。改動時要保持這個不變量。

### 5.3 建案資料（本次任務重點：北市科建案正確性）
- `data/buildings.js` 的每筆資料需有來源依據（配圖、都市計畫）。若為推估，`name` 需註明「(未定)」並加 `ghost: true`。
- 座標驗證方式：切到 2D 鳥瞰 (`b2d`) + 衛星圖，用 Leaflet 看建物方框是否對齊實際屋頂。
- 樓層數 `fl` 須與立面審議/廣告看板一致，若為概估請在 `name` 註明「~」（例如 `科專 ~18F`）。

### 5.4 命名
- 常數：`UPPER_SNAKE_CASE`（`EARTH_RADIUS`、`FLOOR_HEIGHT`）。
- 函式：`camelCase`，動詞開頭（`checkVisibility`、`getTerrainAt`、`isInsidePolygon`）。
- **禁止**單字母變數（除了 `i/j/k/x/y/z/e/n` 這類純迴圈/幾何座標上下文）。歷史的 `R/K/REFF` 已改為 `EARTH_RADIUS/REFRACTION_COEFFICIENT/EFFECTIVE_EARTH_RADIUS`，不要走回頭路。

### 5.5 檔案大小
- `js/main.js` 已經 483 行偏大。繼續成長時應把 UI 事件綁定拆到 `js/ui.js`、rendering loop 拆到 `js/renderLoop.js`。
- 其他模組目前都在 90–370 行，可接受；單檔超過 400 行需拆分。

### 5.6 錯誤處理
- CDN 載入失敗：已有 fallback（Three.js unpkg 備援、Leaflet 失敗則 2D 功能停用），新增 CDN 依賴要同樣處理。
- WebGL 不支援：`checkWebGLSupport()` 已在 `main.js` 開頭做，秀 `#fallback-message`。
- 衛星 tile 載入：`satellite.js` 有超時、CORS 驗證、85% 成功率門檻，新增圖磚來源照抄 `TILE_SOURCES` 格式。

### 5.7 效能
- Render loop 內**不要**做 `BUILDINGS.map`、`new THREE.Color` 之類。
- 新增每幀計算前先問：能否放到 `refresh()`（只在輸入變動時跑）？
- `createTerrainMesh()` 是 ~78k 面，不要再加精度；若要更細請改用 LOD。
- 隨機裝飾（`createSheziVillage`、`createDistantCityscape`）用**固定種子** PRNG，禁用 `Math.random()`（避免每次重載位置亂跳）。

### 5.8 測試要求
目前沒有自動化測試。PR 必須手動驗證下列場景（直到我們加測試為止）：
1. 預設視點下看得到剖面圖、chip 狀態正確。
2. 拉樓層到 1F、23F、1000F，建物/地形/視線反應正確。
3. 切 2D 鳥瞰、切衛星底圖、切剖面圖、切視點，四個按鈕都不會卡住或留下殘影。
4. 手機 Safari 觸控拖曳、雙指縮放可用。

## 6. 機器檢查

| 檢查項 | 狀態 | 備註 |
|---|---|---|
| 建置 | 不需要 | 零 build 設計 |
| 單元測試 | 待設定 | 建議對 `visibility.js` 和 `terrain.js` 加 Vitest（這兩個是純函式最適合）。前置：引入 `package.json` + `npm i -D vitest`（不影響 production） |
| ESLint | 待設定 | 建議規則：`no-unused-vars`、`prefer-const`、`max-lines: 400`、`no-magic-numbers: ["warn", { ignore: [0,1,2,-1,0.5] }]`（抓硬編的樓高/地面高） |
| 依賴邊界檢查 | 待設定 | 建議 `eslint-plugin-boundaries` 或自寫腳本，強制 §2 的依賴規則（例如 `data/*` 不得 import `js/*`、`terrain.js` 不得 import `THREE`） |
| Prettier | 待設定 | 統一縮排（目前混用 2 空格） |
| 型別檢查 | 待設定 | 建議加 `// @ts-check` + JSDoc types（最低成本），尤其是 `visibility.js` / `terrain.js` 回傳物件形狀 |
| 手動 QA checklist | 待設定 | 建議在 repo 根放 `QA_CHECKLIST.md`，列第 5.8 節的四個場景供 PR 自檢 |

### 最推薦先加的三個檢查（成本低、擋得住最多錯）
1. **`// @ts-check` + JSDoc**：對 `visibility.js` / `terrain.js` / `constants.js` 三個檔，抓 target/observer/eyeHeight 型別。
2. **Vitest 加 5 條 visibility 的黃金測試**：確保以後改地形資料不會意外改到 23F 看不看得到海的結論。
3. **ESLint 加 `no-magic-numbers` 抓 `3.4` 和 `4`**：防止樓層高度/地面高度被散落硬編。
