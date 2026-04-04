export interface TripProfile {
  length: string
  scope: string
  style: string
  companion: string
  pace: string
  crowd: string
  budget: string
  food: string
  tags: string[]
  summary: string
}

export function buildTripProfileFromTags(tags: string[]): TripProfile | null {
  if (!tags?.length) return null
  const has = (t: string) => tags.includes(t)
  let length = '3–5天'
  if (has('length_short')) length = '1–2天'
  if (has('length_long')) length = '6天以上'
  const scope = has('scope_abroad') ? '出境游' : '国内游'
  let style = '城市 + 自然搭配'
  if (has('style_nature')) style = '以自然风光为主'
  if (has('style_city')) style = '以城市逛吃为主'
  const pace = has('pace_active') ? '节奏偏紧凑' : '节奏偏轻松'
  let companion = '适合朋友或独自出行'
  if (has('companion_kids')) companion = '亲子友好'
  else if (has('companion_couple')) companion = '情侣/伴侣'
  else if (has('companion_friends')) companion = '朋友结伴'
  else if (has('companion_solo')) companion = '适合一个人慢慢玩'
  const crowd = has('prefer_quiet') ? '更偏好人少一点' : '热门景点也能接受'
  let budget = '预算中等，偏向性价比'
  if (has('budget_low')) budget = '预算偏省'
  if (has('budget_high')) budget = '预算偏体验'
  let food = '美食正常优先级'
  if (has('food_focus')) food = '美食是此行重要部分'

  const summary = `${scope} · ${length} · ${style} · ${companion} · ${pace} · ${crowd} · ${budget} · ${food}`
  return {
    length,
    scope,
    style,
    companion,
    pace,
    crowd,
    budget,
    food,
    tags: [...tags],
    summary,
  }
}

export interface DestinationSuggestion {
  name: string
  summary: string
  tags: string[]
}

export function suggestDestinationsFromProfile(
  profile: TripProfile,
): DestinationSuggestion[] {
  const list: DestinationSuggestion[] = []
  const { scope, style, companion, budget, length } = profile
  const isShort = /1–2/.test(length)
  if (scope === '国内游' && style.includes('自然')) {
    list.push({
      name: isShort ? '近郊山水放松小假期' : '西南山地环线',
      summary: isShort
        ? '从所在城市出发 1–2 小时车程内，找一处山水/湖边民宿，小范围徒步+躺平。'
        : '结合高铁/航班去西南山区，安排 2–3 个自然景观城市串联，兼顾景色和节奏。',
      tags: ['自然风光', companion, budget],
    })
  }
  if (scope === '国内游' && style.includes('城市')) {
    list.push({
      name: isShort ? '周末城市逛吃' : '经典双城文化线',
      summary: isShort
        ? '选择高铁 1–3 小时可达的城市，集中在美食街区、博物馆和步行街附近活动。'
        : '安排两座风格不同的城市，比如一座历史感强、一座现代逛吃为主，来回切换体验。',
      tags: ['城市逛吃', companion, budget],
    })
  }
  if (scope === '出境游') {
    list.push({
      name: isShort ? '近程轻量出境' : '一国多城慢旅行',
      summary: isShort
        ? '选择签证/机票门槛较低的近程目的地（如日韩/东南亚），以 1 城为主，少挪动。'
        : '以 1–2 个国家为范围，串联 2–3 座节奏不同的城市，留足缓冲和休息日。',
      tags: ['出境', companion, budget],
    })
  }
  if (!list.length) {
    list.push({
      name: '弹性时间+城市/自然混搭行程',
      summary:
        '根据你的选择，可以用一座核心城市作为据点，搭配周边 1–2 个自然或小城目的地，保持节奏弹性。',
      tags: [companion, budget],
    })
  }
  return list
}
