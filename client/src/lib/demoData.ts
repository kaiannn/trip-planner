import type { City, DailyPlan, Spot } from '../types'

/**
 * Fixed IDs so the demo is idempotent — loading it twice replaces
 * the previous demo instead of creating duplicates.
 */
const ID = {
  cityHangzhou: 'demo_city_hz',
  spotWestLake: 'demo_spot_westlake',
  spotLingyin: 'demo_spot_lingyin',
  spotLeifeng: 'demo_spot_leifeng',
  spotHumen: 'demo_spot_humen',
  spotWuzhen: 'demo_spot_wuzhen',
  spotSongcheng: 'demo_spot_songcheng',
  spotHefangStreet: 'demo_spot_hefang',
  spotTigerSpring: 'demo_spot_hupao',
  day1: 'demo_day_1',
  day2: 'demo_day_2',
  day3: 'demo_day_3',
} as const

export const DEMO_CITIES: City[] = [
  {
    id: ID.cityHangzhou,
    name: '杭州',
    order: 0,
    location: { lat: 30.274085, lng: 120.15507 },
  },
]

// Rough public coordinates of well-known Hangzhou spots (AMap GCJ-02).
export const DEMO_SPOTS: Spot[] = [
  {
    id: ID.spotWestLake,
    cityId: ID.cityHangzhou,
    name: '西湖',
    location: { lat: 30.25924, lng: 120.13025 },
    description: '杭州的灵魂。清晨雾气散在湖面,苏堤白堤骑行最舒服。',
    visitTimeText: '3-4 小时',
  },
  {
    id: ID.spotLingyin,
    cityId: ID.cityHangzhou,
    name: '灵隐寺',
    location: { lat: 30.2411, lng: 120.0986 },
    description: '千年古刹,飞来峰石刻值得慢慢看。清晨香火气最浓。',
    visitTimeText: '2-3 小时',
  },
  {
    id: ID.spotLeifeng,
    cityId: ID.cityHangzhou,
    name: '雷峰塔',
    location: { lat: 30.2318, lng: 120.1487 },
    description: '夕照下最好看。塔顶能俯瞰整个西湖。',
    visitTimeText: '1-2 小时',
  },
  {
    id: ID.spotHumen,
    cityId: ID.cityHangzhou,
    name: '虎跑泉',
    location: { lat: 30.2237, lng: 120.1251 },
    description: '安静的山泉公园,龙井茶 + 虎跑水,少游客。',
    visitTimeText: '1-2 小时',
  },
  {
    id: ID.spotWuzhen,
    cityId: ID.cityHangzhou,
    name: '乌镇',
    location: { lat: 30.7462, lng: 120.4841 },
    description: '离杭州 1.5h 车程。西栅夜景最好,建议留一晚。',
    visitTimeText: '一整天',
  },
  {
    id: ID.spotSongcheng,
    cityId: ID.cityHangzhou,
    name: '宋城',
    location: { lat: 30.1944, lng: 120.1036 },
    description: '「给我一天,还你千年」。晚上的演出是亮点。',
    visitTimeText: '半天 + 演出',
  },
  {
    id: ID.spotHefangStreet,
    cityId: ID.cityHangzhou,
    name: '河坊街',
    location: { lat: 30.2432, lng: 120.1665 },
    description: '老杭州的食街,定胜糕 / 片儿川 / 葱包桧。',
    visitTimeText: '1-2 小时',
  },
  {
    id: ID.spotTigerSpring,
    cityId: ID.cityHangzhou,
    name: '九溪烟树',
    location: { lat: 30.2011, lng: 120.0994 },
    description: '龙井茶园里的溪水徒步,夏天非常凉快。',
    visitTimeText: '2-3 小时',
  },
]

export const DEMO_DAILY_PLANS: DailyPlan[] = [
  {
    id: ID.day1,
    dayIndex: 1,
    cityId: ID.cityHangzhou,
    lodging: { name: '西湖边的民宿', address: '杭州市上城区南山路附近' },
    // 3 assigned spots in a walkable cluster — Day 1 shows driving routes
    spotOrder: [ID.spotWestLake, ID.spotLeifeng, ID.spotHefangStreet],
  },
  {
    id: ID.day2,
    dayIndex: 2,
    cityId: ID.cityHangzhou,
    lodging: { name: '西湖边的民宿', address: '杭州市上城区南山路附近' },
    // Empty — to showcase the "drag here" day card state later
    spotOrder: [],
  },
  {
    id: ID.day3,
    dayIndex: 3,
    cityId: ID.cityHangzhou,
    lodging: {},
    spotOrder: [],
  },
]

export const DEMO_TRIP_META = {
  title: '杭州 3 天小长假',
  start: '2026-05-15',
  end: '2026-05-17',
  expectation:
    '第一次去杭州,和伴侣一起。想看标志性的西湖,也想找些安静 / 不那么游客的地方。喜欢吃小馆子。',
  type: '情侣',
}
