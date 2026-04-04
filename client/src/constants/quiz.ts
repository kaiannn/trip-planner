export interface QuizOption {
  id: string
  label: string
  hint?: string
  tags: string[]
  next: string | null
}

export interface QuizNode {
  id: string
  question: string
  options: QuizOption[]
}

export const TRIP_QUIZ_TREE: Record<string, QuizNode> = {
  q_length: {
    id: 'q_length',
    question: '这次旅行你更倾向待多久？',
    options: [
      {
        id: 'weekend_short',
        label: '周末 1–2 天',
        hint: '短途放松、小成本出行',
        tags: ['length_short'],
        next: 'q_domestic_abroad',
      },
      {
        id: 'three_five',
        label: '3–5 天',
        hint: '经典小长假行程',
        tags: ['length_medium'],
        next: 'q_domestic_abroad',
      },
      {
        id: 'long_trip',
        label: '6 天以上',
        hint: '可以多城市或深度游',
        tags: ['length_long'],
        next: 'q_domestic_abroad',
      },
    ],
  },
  q_domestic_abroad: {
    id: 'q_domestic_abroad',
    question: '这次更想在国内玩，还是出国看看？',
    options: [
      {
        id: 'domestic',
        label: '主要考虑国内',
        tags: ['scope_domestic'],
        next: 'q_style',
      },
      {
        id: 'abroad',
        label: '想试试出国',
        tags: ['scope_abroad'],
        next: 'q_style',
      },
    ],
  },
  q_style: {
    id: 'q_style',
    question: '你更喜欢哪种旅行感觉？',
    options: [
      {
        id: 'nature',
        label: '自然风光、山海湖泊',
        tags: ['style_nature'],
        next: 'q_energy',
      },
      {
        id: 'city',
        label: '城市逛吃、博物馆、街区',
        tags: ['style_city'],
        next: 'q_energy',
      },
      {
        id: 'mix',
        label: '两者都可以，想搭配一些',
        tags: ['style_mix'],
        next: 'q_energy',
      },
    ],
  },
  q_energy: {
    id: 'q_energy',
    question: '你能接受的行程节奏更偏向哪种？',
    options: [
      {
        id: 'active',
        label: '能多走多逛，行程紧一点没关系',
        tags: ['pace_active'],
        next: 'q_companion',
      },
      {
        id: 'relax',
        label: '想轻松一点，多留时间发呆休息',
        tags: ['pace_relax'],
        next: 'q_companion',
      },
    ],
  },
  q_companion: {
    id: 'q_companion',
    question: '这次大概是跟谁一起旅行？',
    options: [
      {
        id: 'with_kids',
        label: '带小朋友（亲子）',
        tags: ['companion_kids', 'need_family_friendly'],
        next: 'q_crowd',
      },
      {
        id: 'couple',
        label: '情侣 / 伴侣',
        tags: ['companion_couple', 'prefer_romantic'],
        next: 'q_crowd',
      },
      {
        id: 'friends',
        label: '朋友 / 同学',
        tags: ['companion_friends'],
        next: 'q_crowd',
      },
      {
        id: 'solo',
        label: '一个人',
        tags: ['companion_solo'],
        next: 'q_crowd',
      },
    ],
  },
  q_crowd: {
    id: 'q_crowd',
    question: '能接受热门景点排队、人多一点吗？',
    options: [
      {
        id: 'ok_crowd',
        label: '可以，热门景点也想去打卡',
        tags: ['accept_crowd', 'hot_spots_ok'],
        next: 'q_budget',
      },
      {
        id: 'avoid_crowd',
        label: '更想人少一点、舒服一点',
        tags: ['prefer_quiet', 'small_crowd'],
        next: 'q_budget',
      },
    ],
  },
  q_budget: {
    id: 'q_budget',
    question: '这次预算更偏向哪种感觉？',
    options: [
      {
        id: 'budget_low',
        label: '尽量省钱，能坐火车不坐飞机',
        tags: ['budget_low'],
        next: 'q_food',
      },
      {
        id: 'budget_mid',
        label: '中等，性价比优先',
        tags: ['budget_mid'],
        next: 'q_food',
      },
      {
        id: 'budget_high',
        label: '体验优先，适当小贵也可以',
        tags: ['budget_high'],
        next: 'q_food',
      },
    ],
  },
  q_food: {
    id: 'q_food',
    question: '美食对这次旅行有多重要？',
    options: [
      {
        id: 'food_important',
        label: '非常重要，想专门去吃',
        tags: ['food_focus', 'need_food_recommend'],
        next: null,
      },
      {
        id: 'food_normal',
        label: '有就吃，不特意为吃跑很远',
        tags: ['food_normal'],
        next: null,
      },
      {
        id: 'food_low',
        label: '不太在意吃什么',
        tags: ['food_low_priority'],
        next: null,
      },
    ],
  },
}
