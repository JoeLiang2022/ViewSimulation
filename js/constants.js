/**
 * 物理與環境常數
 */

/** 地球平均半徑（公尺） */
export const EARTH_RADIUS = 6371000;

/** 大氣折射係數（K=0.13 為標準大氣假設） */
export const REFRACTION_COEFFICIENT = 0.13;

/** 等效地球半徑 = R / (1 - K)，用於視線曲率修正 */
export const EFFECTIVE_EARTH_RADIUS = EARTH_RADIUS / (1 - REFRACTION_COEFFICIENT);

/** 基地地面高程（公尺，海拔） */
export const GROUND_ELEVATION = 4;

/** 標準層高（公尺/層） */
export const FLOOR_HEIGHT = 3.4;

/** 地圖錨點（衛星校正工具原點） */
export const ANCHOR_LAT = 25.09790;
export const ANCHOR_LNG = 121.50400;

/** 公尺/緯度 */
export const METERS_PER_LAT = 110540;

/** 公尺/經度（依錨點緯度修正） */
export const METERS_PER_LNG = 111320 * Math.cos(ANCHOR_LAT * Math.PI / 180);

/** 明玥真實經緯度（校正後） */
export const MINGYU_LAT = ANCHOR_LAT + 50 / METERS_PER_LAT;
export const MINGYU_LNG = ANCHOR_LNG + 9 / METERS_PER_LNG;
