/**
 * 建物資料 — 洲美段開發區所有建築量體
 * 座標系：以遠雄明玥為原點 (0,0)
 * e = 東向偏移(公尺), n = 北向偏移(公尺)
 * w = 東西向寬度, d = 南北向深度, fl = 地上樓層數
 * obs = 可作為觀測視點, vp = 可切換視點, ghost = 未定建案(半透明)
 */
export const BUILDINGS = [
  { name: '遠雄明玥 27F', e: 0, n: 0, w: 36, d: 36, fl: 27, color: 0x70788a, obs: true },
  { name: '遠雄泱玥 24F', e: -118, n: -20, w: 32, d: 28, fl: 24, color: 0xb4673c, obs: true },
  { name: '河岸建案 河岸第一排(未定)', e: 30, n: -72, w: 42, d: 30, fl: 15, color: 0x36c9b8, ghost: true },
  { name: '潤泰新洲美 22F', e: -229, n: 38, w: 30, d: 28, fl: 22, color: 0x7e8a9c, vp: true },
  { name: '達麗河蘊A 14F', e: 62, n: 62, w: 28, d: 26, fl: 14, color: 0x49565f, vp: true },
  { name: '達麗河蘊B 14F', e: 17, n: 64, w: 28, d: 26, fl: 14, color: 0x49565f },
  { name: '國際羽球館', e: -288, n: 162, w: 92, d: 78, fl: 5, color: 0x6f93a8 },
  { name: '洲美國中小', e: -140, n: 176, w: 120, d: 20, fl: 5, color: 0xcabfa3 },
  { name: '洲美國中小', e: -198, n: 210, w: 22, d: 60, fl: 5, color: 0xcabfa3 },
  { name: '住宅 住3-2 15F', e: -209, n: 256, w: 36, d: 32, fl: 15, color: 0x7a86a8, vp: true },
  { name: '住宅 住3-2 15F', e: -245, n: 250, w: 30, d: 30, fl: 15, color: 0x7a86a8 },
  { name: '住宅 住3-2 15F', e: -173, n: 251, w: 30, d: 30, fl: 15, color: 0x7a86a8 },
  { name: '住宅 住3-2 15F', e: -209, n: 299, w: 36, d: 30, fl: 15, color: 0x7a86a8 },
  { name: '洲美公宅A 15F', e: -1, n: 193, w: 34, d: 30, fl: 15, color: 0x8a6f9c, vp: true },
  { name: '洲美公宅A 15F', e: -14, n: 274, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅B 15F', e: 59, n: 246, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅B 15F', e: -7, n: 244, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅C 15F', e: 145, n: 251, w: 34, d: 30, fl: 15, color: 0x9a7fac },
  { name: '洲美公宅C 15F', e: 82, n: 197, w: 34, d: 30, fl: 15, color: 0x9a7fac },
  { name: '洲美公宅C 15F', e: 59, n: 272, w: 34, d: 30, fl: 15, color: 0x9a7fac },
  { name: '洲美公宅C 15F', e: 146, n: 275, w: 34, d: 30, fl: 15, color: 0x9a7fac },
  { name: '洲美公宅D 15F', e: 203, n: 255, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅D 15F', e: 285, n: 251, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅D 15F', e: 210, n: 281, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '洲美公宅D 15F', e: 287, n: 278, w: 34, d: 30, fl: 15, color: 0x8a6f9c },
  { name: '士科大院A 22F(南)', e: 167, n: -2, w: 38, d: 40, fl: 22, color: 0x6f7e92, vp: true },
  { name: '士科大院B 22F(北)', e: 164, n: 60, w: 38, d: 40, fl: 22, color: 0x6f7e92 },
  { name: '科專 ~18F', e: 232, n: 72, w: 42, d: 38, fl: 18, color: 0xc98a4a },
  { name: '科專 ~18F', e: 230, n: 19, w: 42, d: 38, fl: 18, color: 0xc98a4a },
  { name: '科專 ~18F', e: 334, n: 70, w: 42, d: 38, fl: 18, color: 0xc98a4a },
  { name: '科專 ~18F', e: 339, n: 4, w: 42, d: 38, fl: 18, color: 0xc98a4a },
  { name: '科專 ~18F', e: 299, n: -66, w: 42, d: 38, fl: 18, color: 0xc98a4a },
  { name: '平面停車場 交', e: -464, n: 165, w: 80, d: 110, fl: 1, color: 0x9a9a9a }
];
