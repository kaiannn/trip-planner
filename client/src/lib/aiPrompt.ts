import type { City, DailyPlan, Spot } from '../types'

export interface TripContextPayload {
  title: string
  startDate: string
  endDate: string
  travelExpectation: string
  tripType: string
  cities: City[]
  spots: Spot[]
  dailyPlans: DailyPlan[]
}

export function buildAiPrompt({
  trip,
  focusCityId,
  budgetPerDay,
  focus = 'all',
}: {
  trip: TripContextPayload
  focusCityId: string
  budgetPerDay: number
  focus?: 'all' | 'spots' | 'lodging'
}): string {
  const {
    title,
    startDate,
    endDate,
    travelExpectation,
    tripType,
    cities: cs,
    spots: sp,
    dailyPlans: dps,
  } = trip
  const focusCity = cs.find((c) => c.id === focusCityId)

  const lines: string[] = []
  lines.push(
    '你是一个旅游规划助手。下面【当前行程信息】与【用户旅行期望】会在每次请求时完整提供，请把它们视为唯一可信上下文；不要假设上下文中没有写明的航班号、精确起飞降落时间等（若用户写在「旅行期望」里则可引用）。',
  )
  lines.push(
    '用户有一个「景点池」，景点类推荐应可进入景点池；住宿单独推荐。若发现日程过紧、过松或可能存在可利用的空档，可用 type="other" 的 items 写 1～3 条简短提示（例如动线优化、休息建议）；不要编造用户未提供的精确时刻表。',
  )
  lines.push('要求：')
  lines.push('1. 只输出 JSON，不要输出任何解释文本。')
  lines.push('2. JSON 顶层结构为 {"sections":[...]}。')
  lines.push(
    '3. sections 每一项结构为：{"id":字符串,"title":字符串,"type":字符串("spots"或"lodging"或"other"),"items":[...]}。',
  )
  lines.push(
    '4. items 每一项结构为：{"title":字符串,"summary":字符串,"detail":字符串,"meta":字符串可选,"lat":数值可选,"lng":数值可选,"guideUrl":字符串可选,"innerTransport":字符串可选,"priceLevel":字符串可选}。',
  )
  lines.push('5. 不要包含 JSON 以外的任何文字，不要使用 markdown。')
  lines.push('')
  lines.push('【用户旅行期望】（请重点结合此条推荐）')
  lines.push(travelExpectation ? `用户说：${travelExpectation}` : '（用户未填写）')
  lines.push('')
  lines.push('【当前行程信息】')
  lines.push(`行程标题：${title || '（未填写）'}`)
  lines.push(`出发日期：${startDate || '（未填写）'}`)
  lines.push(`结束日期：${endDate || '（未填写）'}`)
  if (tripType) {
    lines.push(
      `出行类型：${tripType}（请在行程强度、景点类型和用语风格上适当贴合这一类型）`,
    )
  } else {
    lines.push('出行类型：未指定，可适当给出适合不同人群的建议。')
  }
  lines.push('')

  lines.push('城市列表（按顺序）：')
  cs
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c, idx) => {
      const loc =
        c.location && typeof c.location.lat === 'number'
          ? `(${c.location.lat},${c.location.lng})`
          : '(无坐标)'
      lines.push(`- 第${idx + 1} 个城市：${c.name}，坐标：${loc}`)
    })
  lines.push('')

  lines.push('景点列表：')
  sp.forEach((s) => {
    const city = cs.find((c) => c.id === s.cityId)
    const cityName = city ? city.name : '未知城市'
    lines.push(
      `- 景点：${s.name}（城市：${cityName}），坐标：(${s.location.lat},${s.location.lng})`,
    )
    if (s.visitTimeText) lines.push(`  预计时间：${s.visitTimeText}`)
    if (s.innerTransport) lines.push(`  城市内交通：${s.innerTransport}`)
    if (s.guideUrl) lines.push(`  攻略链接：${s.guideUrl}`)
  })
  if (!sp.length) {
    lines.push('- （尚未添加任何景点）')
  }
  lines.push('')

  lines.push('每日行程：')
  dps
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .forEach((d) => {
      const city = cs.find((c) => c.id === d.cityId)
      const cityName = city ? city.name : '未知城市'
      lines.push(
        `- 第 ${d.dayIndex} 天（${d.date || '日期未填'}），城市：${cityName}`,
      )
      const lodgingName = d.lodging?.name || '（住宿未填）'
      const lodgingAddr = d.lodging?.address || ''
      lines.push(
        `  住宿：${lodgingName}${
          lodgingAddr ? '，地址：' + lodgingAddr : ''
        }`,
      )
      if (d.spotOrder.length) {
        const names = d.spotOrder
          .map((sid) => sp.find((s) => s.id === sid)?.name || '已删除景点')
          .join(' -> ')
        lines.push(`  景点顺序：${names}`)
      } else {
        lines.push('  该天尚未安排景点')
      }
    })
  if (!dps.length) {
    lines.push('- （尚未创建任何每日行程）')
  }
  lines.push('')

  if (focusCity) {
    lines.push(`重点关注城市：${focusCity.name}`)
  }
  if (budgetPerDay && budgetPerDay > 0) {
    lines.push(`用户预期预算：每天约 ${budgetPerDay} 元人民币。`)
  } else {
    lines.push('用户未提供预算，你可以给出不同价位的选项并简单标注价格等级。')
  }
  lines.push('')
  lines.push(
    '请根据以上信息（尤其旅行期望）返回 sections：1）优先给出「景点推荐」type=spots；2）可为未填住宿的天推荐 type=lodging；3）行程松紧、空档利用、注意事项等用 type=other（每条 item 的 title/summary 力求简短可扫读）。',
  )

  if (focus === 'spots') {
    lines.push('')
    lines.push(
      '【本轮任务】请只输出 type="spots" 的 sections，不要输出 lodging 或 other。',
    )
  } else if (focus === 'lodging') {
    lines.push('')
    lines.push(
      '【本轮任务】请只输出 type="lodging" 的 sections，不要输出 spots 或 other。',
    )
  }

  return lines.join('\n')
}
