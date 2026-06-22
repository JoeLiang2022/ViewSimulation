/**
 * 地理資料 — 地形高程、水系、路網、標籤點位
 * 座標系：以遠雄明玥為原點 (0,0)，東 = +e，北 = +n（公尺）
 */

/** 關鍵視線目標 [東偏移, 北偏移, 高程(m)] */
export const TARGETS = {
  SEA: [-10700, 8240, 0],       // 淡水出海口
  BRIDGE: [-9353, 5400, 211],   // 淡江大橋塔頂
  RIVER: [-3000, 1050, 0]       // 基隆河/關渡平原
};

/** 地形高斯山峰模型：e/n=中心, A=最高海拔, s=擴散半徑 */
export const PEAKS = [
  { e: -4550, n: 3400, amplitude: 138, spread: 780 },   // 北藝大稜線
  { e: -7975, n: 3222, amplitude: 291, spread: 1100 },  // 觀音山前峰
  { e: -8676, n: 2390, amplitude: 612, spread: 1400 },  // 觀音山主峰
  { e: 2500, n: 10500, amplitude: 1086, spread: 2400 }, // 大屯山
  { e: -12500, n: -3000, amplitude: 180, spread: 3500 } // 林口台地
];

/** 基隆河北岸折線（由西到東） */
export const KEELUNG_RIVER_NORTH_BANK = [
  [-621, 455], [-586, 55], [-240, -114], [409, -205], [699, -65], [1421, 160]
];

/** 基隆河西北段接淡水河 */
export const KEELUNG_RIVER_WEST = [
  [-621, 455], [-1000, 720], [-1500, 1050], [-2200, 1350], [-3400, 1600]
];

/** 淡水河主河道折線 */
export const TAMSUI_RIVER = [
  [-3600, -2400], [-4100, -500], [-4640, 1110], [-5340, 1550],
  [-6400, 2800], [-7700, 4300], [-9000, 5800], [-9900, 7000], [-10700, 8240]
];

/** 社子島邊界多邊形 */
export const SHEZI_ISLAND = [
  [-4500, 950], [-2900, 250], [-1300, -650], [-700, -1900],
  [-1700, -2600], [-3100, -1700], [-4150, -300]
];

/** 路網折線（依衛星描跡） */
export const ROADS = [
  { name: '河美街', points: [[-320, -50], [-118, -100], [120, -120], [421, -108]] },
  { name: '福真路', points: [[-55, -28], [421, -22]] },
  { name: '福善路', points: [[-55, 103], [419, 118]] },
  { name: '福美路', points: [[-55, 165], [419, 182]] },
  { name: '承美路', points: [[-40, -66], [-45, 299]] },
  { name: '承真街', points: [[191, -108], [190, 107]] },
  { name: '承德街', points: [[422, -73], [418, 325]] }
];

/** 3D 場景標籤點位 */
export const LABELS = [
  { position: [-300, 7, -360], text: '基隆河', category: 'water' },
  { position: [-6400, 7, 2800], text: '淡水河', category: 'water' },
  { position: [-2400, 10, -900], text: '社子島', category: 'flat' },
  { position: [-3900, 7, 650], text: '社子島濕地', category: 'water' },
  { position: [-1200, 12, 2500], text: '關渡平原', category: 'flat' },
  { position: [-5340, 46, 1550], text: '關渡大橋', category: 'flat' },
  { position: [-4550, 168, 3400], text: '北藝大稜線 150m', category: 'peak' },
  { position: [-8676, 640, 2390], text: '觀音山 616m', category: 'peak' },
  { position: [2500, 1110, 10500], text: '大屯山 1092m', category: 'peak' },
  { position: [-9353, 232, 5400], text: '淡江大橋 211m', category: 'peak' },
  { position: [-10700, 30, 8240], text: '淡水出海口', category: 'water' },
  { position: [0, 100, 0], text: '遠雄明玥 27F', category: 'bld', selfKey: '明玥' },
  { position: [-118, 90, -20], text: '遠雄泱玥 24F', category: 'bld', selfKey: '泱玥' },
  { position: [40, 52, 63], text: '達麗河蘊 AB(14F)', category: 'bld' },
  { position: [-229, 82, 38], text: '潤泰新洲美 22F', category: 'bld' },
  { position: [140, 58, 250], text: '洲美公宅 A/B/C/D 12棟(15F)', category: 'bld' },
  { position: [165, 84, 29], text: '士科大院 AB南北雙塔(22F)', category: 'bld' },
  { position: [-268, 32, 145], text: '國際羽球館(校地西側)', category: 'flat' },
  { position: [-150, 12, 176], text: '洲美國中小', category: 'flat' },
  { position: [-26, 6, 6], text: '明玥庭園', category: 'flat' },
  { position: [30, 52, -72], text: '河岸建案·河岸第一排(未定)', category: 'bld' },
  { position: [-30, 5, 210], text: '承美路', category: 'road' },
  { position: [260, 5, -45], text: '河美街', category: 'road' },
  { position: [-209, 58, 275], text: '住宅 住3-2(15F×4)', category: 'bld' },
  { position: [235, 9, 240], text: '公園', category: 'flat' },
  { position: [520, 70, 200], text: '科專區(科技,樓高估)', category: 'bld' },
  { position: [-690, 12, 165], text: '橋下平面停車場', category: 'flat' }
];
