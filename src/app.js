/**
 * 行程规划前端逻辑（高德地图 + AI 推荐）
 */

/**
 * @typedef {{ id: string, name: string, location?: {lat:number,lng:number}, order:number }} City
 * @typedef {{ id: string, cityId: string, name: string, location:{lat:number,lng:number}, guideUrl?:string, visitTimeText?:string, innerTransport?:string, imageUrl?:string, description?:string, videoUrl?:string, xiaohongshuUrls?:string[] }} Spot
 * @typedef {{ name?: string, address?: string }} DailyLodging
 * @typedef {{ id: string, dayIndex:number, date?:string, cityId:string, lodging:DailyLodging, spotOrder:string[], transportMode?:string }} DailyPlan
 */

/** @type {City[]} */
let cities = [];
/** @type {Spot[]} */
let spots = [];
/** @type {DailyPlan[]} */
let dailyPlans = [];

let map;
let cityMarkers = [];
let spotMarkers = [];
let routePolylines = [];
let distanceLabels = [];
let infoWindow;

let aiRefreshTimer = null;
let lastAiPayload = null;
let currentDetailSpot = null;

function distanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isDuplicateSpot(cityId, name, lat, lng) {
  const nameLower = (name || '').trim().toLowerCase();
  return spots.some((s) => {
    if (s.cityId !== cityId) return false;
    const sNameLower = (s.name || '').trim().toLowerCase();
    const sameName = sNameLower && sNameLower === nameLower;
    const hasLoc =
      s.location &&
      typeof s.location.lat === 'number' &&
      typeof s.location.lng === 'number';
    if (!hasLoc) return sameName;
    const d = distanceInMeters(
      s.location.lat,
      s.location.lng,
      lat,
      lng,
    );
    return sameName || d < 100;
  });
}

const TRIP_QUIZ_TREE = {
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
};

let tripQuizPath = [];
let tripQuizTags = [];

function log(message, level = 'info') {
  const logPanel = document.getElementById('log-panel');
  if (!logPanel) return;
  const div = document.createElement('div');
  div.className = 'log-entry';
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date().toLocaleTimeString();
  const levelSpan = document.createElement('span');
  levelSpan.className = `level-${level}`;
  levelSpan.textContent = `[${level.toUpperCase()}] `;
  const text = document.createElement('span');
  text.textContent = message;
  div.appendChild(timeSpan);
  div.appendChild(levelSpan);
  div.appendChild(text);
  logPanel.prepend(div);
}

function initMap() {
  if (typeof AMap === 'undefined') {
    log('高德地图脚本未成功加载，请检查 key 是否正确。', 'error');
    return;
  }

  map = new AMap.Map('map', {
    viewMode: '2D',
    zoom: 4,
    center: [110.0, 34.0],
  });

  infoWindow = new AMap.InfoWindow({
    offset: new AMap.Pixel(0, -30),
  });

  AMap.plugin('AMap.Geocoder', () => {});

  map.on('rightclick', (e) => {
    const lnglat = e.lnglat;
    const lat = lnglat.getLat ? lnglat.getLat() : lnglat.lat;
    const lng = lnglat.getLng ? lnglat.getLng() : lnglat.lng;
    const latInputCity = document.getElementById('city-lat-input');
    const lngInputCity = document.getElementById('city-lng-input');
    const latInputSpot = document.getElementById('spot-lat-input');
    const lngInputSpot = document.getElementById('spot-lng-input');
    if (latInputCity && lngInputCity) {
      latInputCity.value = lat.toFixed(6);
      lngInputCity.value = lng.toFixed(6);
    }
    if (latInputSpot && lngInputSpot) {
      latInputSpot.value = lat.toFixed(6);
      lngInputSpot.value = lng.toFixed(6);
    }
    log(`已将经纬度填入输入框：${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  });
}

function refreshCitySelects() {
  const spotCitySelect = document.getElementById('spot-city-select');
  const dayCitySelect = document.getElementById('day-city-select');
  if (!spotCitySelect || !dayCitySelect) return;
  [spotCitySelect, dayCitySelect].forEach((sel) => {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
  });

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '请选择城市';
  spotCitySelect.appendChild(placeholder.cloneNode(true));
  dayCitySelect.appendChild(placeholder.cloneNode(true));

  cities
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const opt1 = document.createElement('option');
      opt1.value = c.id;
      opt1.textContent = c.name;
      spotCitySelect.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = c.id;
      opt2.textContent = c.name;
      dayCitySelect.appendChild(opt2);
    });
}

function refreshDaySpotSelect() {
  const daySpotSelect = document.getElementById('day-spot-select');
  const dayCitySelect = document.getElementById('day-city-select');
  if (!daySpotSelect || !dayCitySelect) return;
  while (daySpotSelect.firstChild) daySpotSelect.removeChild(daySpotSelect.firstChild);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '选择要加入当天的景点';
  daySpotSelect.appendChild(placeholder);

  const cityId = dayCitySelect.value;
  if (!cityId) return;
  spots
    .filter((s) => s.cityId === cityId)
    .forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      daySpotSelect.appendChild(opt);
    });
}

function refreshAiCitySelect() {
  const sel = document.getElementById('ai-city-select');
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '自动选择（第一个城市）';
  sel.appendChild(placeholder);
  cities
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
}

function refreshAmapCitySelect() {
  const sel = document.getElementById('amap-city-select');
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = '请选择城市';
  sel.appendChild(ph);
  cities
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
}

function renderCities() {
  const ul = document.getElementById('city-list');
  if (!ul) return;
  while (ul.firstChild) ul.removeChild(ul.firstChild);
  if (map && cityMarkers.length) {
    cityMarkers.forEach((m) => m.setMap(null));
    cityMarkers = [];
  }

  const sorted = cities.slice().sort((a, b) => a.order - b.order);
  sorted.forEach((city, index) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = `${index + 1}. ${city.name}`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'small-btn';
    upBtn.textContent = '↑';
    upBtn.onclick = () => moveCity(city.id, -1);

    const downBtn = document.createElement('button');
    downBtn.className = 'small-btn';
    downBtn.textContent = '↓';
    downBtn.onclick = () => moveCity(city.id, 1);

    const delBtn = document.createElement('button');
    delBtn.className = 'small-btn';
    delBtn.textContent = '删';
    delBtn.onclick = () => deleteCity(city.id);

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(delBtn);

    li.appendChild(label);
    li.appendChild(actions);
    ul.appendChild(li);

    if (map && city.location) {
      const marker = new AMap.Marker({
        position: [city.location.lng, city.location.lat],
        title: city.name,
        map,
      });
      marker.on('click', () => {
        if (!infoWindow) return;
        infoWindow.setContent(`城市：${city.name}`);
        infoWindow.open(map, marker.getPosition());
      });
      cityMarkers.push(marker);
    }
  });

  refreshCitySelects();
  refreshAiCitySelect();
  refreshAmapCitySelect();
}

function moveCity(cityId, delta) {
  const index = cities.findIndex((c) => c.id === cityId);
  if (index === -1) return;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= cities.length) return;
  const tmp = cities[index];
  cities[index] = cities[newIndex];
  cities[newIndex] = tmp;
  cities.forEach((c, i) => (c.order = i));
  renderCities();
  drawRoutes();
  scheduleAiRefresh();
}

function deleteCity(cityId) {
  cities = cities.filter((c) => c.id !== cityId);
  spots = spots.filter((s) => s.cityId !== cityId);
  dailyPlans = dailyPlans.filter((d) => d.cityId !== cityId);
  renderCities();
  renderSpots();
  renderDailyPlans();
  refreshDaySpotSelect();
  drawRoutes();
  log('已删除城市及其关联的景点和行程', 'warn');
  scheduleAiRefresh();
}

function updateSpotMarkers() {
  if (map && spotMarkers.length) {
    spotMarkers.forEach((m) => m.setMap(null));
    spotMarkers = [];
  }
  if (!map) return;
  spots.forEach((spot) => {
    const marker = new AMap.Marker({
      position: [spot.location.lng, spot.location.lat],
      title: spot.name,
      map,
    });
    const innerTransport = spot.innerTransport ? `<br/>交通：${spot.innerTransport}` : '';
    const guideLink = spot.guideUrl ? `<br/><a href="${spot.guideUrl}" target="_blank">攻略链接</a>` : '';
    const html = `景点：${spot.name}${spot.visitTimeText ? `<br/>时间：${spot.visitTimeText}` : ''}${innerTransport}${guideLink}`;
    marker.on('click', () => {
      if (!infoWindow) return;
      infoWindow.setContent(html);
      infoWindow.open(map, marker.getPosition());
    });
    spotMarkers.push(marker);
  });
}

function renderSpotPoolSummary() {
  const el = document.getElementById('spot-pool-count');
  if (el) el.textContent = `共 ${spots.length} 个景点`;
}

function renderSpots() {
  updateSpotMarkers();
  refreshDaySpotSelect();
  renderSpotPoolSummary();
  const grid = document.getElementById('spot-pool-grid');
  if (grid && !document.getElementById('spot-pool-overlay')?.hidden) {
    renderSpotPoolGrid();
  }
}

function refreshSpotPoolCityFilter() {
  const sel = document.getElementById('spot-pool-city-filter');
  if (!sel) return;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const all = document.createElement('option');
  all.value = '';
  all.textContent = '全部城市';
  sel.appendChild(all);
  cities
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
}

function renderSpotPoolGrid() {
  const grid = document.getElementById('spot-pool-grid');
  const filterSel = document.getElementById('spot-pool-city-filter');
  if (!grid) return;
  grid.innerHTML = '';
  const cityId = filterSel?.value || '';
  const filtered = cityId ? spots.filter((s) => s.cityId === cityId) : spots;
  filtered.forEach((spot) => {
    const card = document.createElement('div');
    card.className = 'spot-card';
    card.onclick = () => showSpotDetail(spot);
    const img = document.createElement('img');
    img.alt = spot.name;
    if (spot.imageUrl) {
      img.src = spot.imageUrl;
      img.className = 'spot-card-image';
      img.onerror = () => {
        img.classList.add('placeholder');
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
      };
    } else {
      img.className = 'spot-card-image placeholder';
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
    }
    const name = document.createElement('div');
    name.className = 'spot-card-name';
    name.textContent = spot.name;
    card.appendChild(img);
    card.appendChild(name);
    grid.appendChild(card);
  });
}

function openSpotPoolView() {
  const overlay = document.getElementById('spot-pool-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  refreshCitySelects();
  refreshAmapCitySelect();
  refreshSpotPoolCityFilter();
  renderSpotPoolGrid();
}

function closeSpotPoolView() {
  const overlay = document.getElementById('spot-pool-overlay');
  if (overlay) overlay.hidden = true;
}

function showSpotDetail(spot) {
  const overlay = document.getElementById('spot-detail-overlay');
  const nameEl = document.getElementById('spot-detail-name');
  const imageWrap = document.getElementById('spot-detail-image-wrap');
  const descEl = document.getElementById('spot-detail-description');
  const videoEl = document.getElementById('spot-detail-video');
  const xhsEl = document.getElementById('spot-detail-xiaohongshu');
  const metaEl = document.getElementById('spot-detail-meta');
  if (!overlay || !nameEl) return;
  nameEl.textContent = spot.name;
  imageWrap.innerHTML = '';
  if (spot.imageUrl) {
    const img = document.createElement('img');
    img.src = spot.imageUrl;
    img.alt = spot.name;
    imageWrap.appendChild(img);
  }
  descEl.textContent = spot.description || '暂无介绍';
  videoEl.innerHTML = '';
  if (spot.videoUrl) {
    const url = spot.videoUrl.trim();
    const bvMatch = url.match(/(BV[\w]+)/i);
    const avMatch = url.match(/video\/av(\d+)/i);
    if (/bilibili|b23\.tv/i.test(url) && (bvMatch || avMatch)) {
      const iframe = document.createElement('iframe');
      iframe.src = bvMatch
        ? `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}`
        : `https://player.bilibili.com/player.html?aid=${avMatch[1]}`;
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'no-referrer';
      videoEl.appendChild(iframe);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = '打开视频链接';
      videoEl.appendChild(a);
    }
  } else {
    videoEl.textContent = '暂无视频';
  }
  xhsEl.innerHTML = '';
  const urls = spot.xiaohongshuUrls || [];
  if (urls.length) {
    urls.forEach((u) => {
      const a = document.createElement('a');
      a.href = u.trim();
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = '小红书帖子';
      xhsEl.appendChild(a);
    });
  } else {
    xhsEl.textContent = '暂无';
  }
  metaEl.innerHTML = '';
  const parts = [];
  if (spot.guideUrl) {
    const a = document.createElement('a');
    a.href = spot.guideUrl;
    a.target = '_blank';
    a.textContent = '攻略链接';
    metaEl.appendChild(a);
  }
  if (spot.visitTimeText) parts.push(`建议时间：${spot.visitTimeText}`);
  if (spot.innerTransport) parts.push(`交通：${spot.innerTransport}`);
  if (parts.length) {
    const span = document.createElement('span');
    span.textContent = parts.join(' · ');
    span.style.marginLeft = '8px';
    metaEl.appendChild(span);
  }
  if (!metaEl.innerHTML) metaEl.textContent = '暂无';
  currentDetailSpot = spot;
  overlay.hidden = false;
}

function closeSpotDetail() {
  currentDetailSpot = null;
  const overlay = document.getElementById('spot-detail-overlay');
  if (overlay) overlay.hidden = true;
}

function renderDailyPlans() {
  const ul = document.getElementById('day-list');
  if (!ul) return;
  while (ul.firstChild) ul.removeChild(ul.firstChild);

  dailyPlans
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .forEach((day) => {
      const li = document.createElement('li');
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '4px';

      const title = document.createElement('span');
      const city = cities.find((c) => c.id === day.cityId);
      title.textContent = `第 ${day.dayIndex} 天 · ${city ? city.name : '未知城市'}`;
      header.appendChild(title);

      if (!day.lodging || !day.lodging.name) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-warning';
        badge.textContent = '住宿未填写';
        header.appendChild(badge);
      }

      const dateSpan = document.createElement('span');
      dateSpan.style.fontSize = '11px';
      dateSpan.style.color = '#6b7280';
      dateSpan.textContent = day.date ? `（${day.date}）` : '';
      header.appendChild(dateSpan);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const focusBtn = document.createElement('button');
      focusBtn.className = 'small-btn';
      focusBtn.textContent = '查看';
      focusBtn.onclick = () => focusDay(day.id);
      const delBtn = document.createElement('button');
      delBtn.className = 'small-btn';
      delBtn.textContent = '删';
      delBtn.onclick = () => {
        dailyPlans = dailyPlans.filter((d) => d.id !== day.id);
        renderDailyPlans();
        drawRoutes();
        scheduleAiRefresh();
      };
      actions.appendChild(focusBtn);
      actions.appendChild(delBtn);

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.justifyContent = 'space-between';
      topRow.style.width = '100%';
      topRow.appendChild(header);
      topRow.appendChild(actions);

      li.appendChild(topRow);

      const lodgingP = document.createElement('div');
      lodgingP.style.fontSize = '11px';
      lodgingP.style.color = '#4b5563';
      const lodgingText = day.lodging?.name
        ? `住宿：${day.lodging.name}${
            day.lodging.address ? `（${day.lodging.address}）` : ''
          }`
        : '住宿：未填写';
      lodgingP.textContent = lodgingText;
      li.appendChild(lodgingP);

      const spotP = document.createElement('div');
      spotP.style.fontSize = '11px';
      spotP.style.color = '#4b5563';
      const names = day.spotOrder
        .map((sid) => spots.find((s) => s.id === sid)?.name || '已删除景点')
        .join(' → ');
      spotP.textContent = names ? `景点顺序：${names}` : '尚未安排景点';
      li.appendChild(spotP);
      if (day.transportMode) {
        const transportP = document.createElement('div');
        transportP.style.fontSize = '11px';
        transportP.style.color = '#6b7280';
        transportP.textContent = `交通：${day.transportMode}`;
        li.appendChild(transportP);
      }

      ul.appendChild(li);
    });

  const summaryEl = document.getElementById('day-summary-text');
  if (summaryEl) {
    if (!dailyPlans.length) {
      summaryEl.textContent = '尚未创建任何每日行程。';
    } else {
      const days = dailyPlans
        .slice()
        .sort((a, b) => a.dayIndex - b.dayIndex);
      const count = days.length;
      const missingLodging = days.filter(
        (d) => !d.lodging || !d.lodging.name,
      ).length;
      summaryEl.textContent = `已创建 ${count} 天行程${
        missingLodging
          ? `，其中 ${missingLodging} 天未填写住宿`
          : '，所有天数都已填写住宿'
      }。`;
    }
  }

  renderDayTimeline();
}

function focusDay(dayId) {
  const day = dailyPlans.find((d) => d.id === dayId);
  if (!day) return;
  const dayIndexInput = document.getElementById('day-index-input');
  const dayCitySelect = document.getElementById('day-city-select');
  const dayDateInput = document.getElementById('day-date-input');
  const lodgingNameInput = document.getElementById('lodging-name-input');
  const lodgingAddressInput = document.getElementById('lodging-address-input');
  const dayTransportModeInput = document.getElementById('day-transport-mode-input');
  const daySpotOrderList = document.getElementById('day-spot-order-list');

  if (
    !dayIndexInput ||
    !dayCitySelect ||
    !dayDateInput ||
    !lodgingNameInput ||
    !lodgingAddressInput ||
    !daySpotOrderList
  )
    return;

  dayIndexInput.value = String(day.dayIndex);
  dayCitySelect.value = day.cityId;
  dayDateInput.value = day.date || '';
  lodgingNameInput.value = day.lodging?.name || '';
  lodgingAddressInput.value = day.lodging?.address || '';
  if (dayTransportModeInput) dayTransportModeInput.value = day.transportMode || '';
  refreshDaySpotSelect();

  renderDaySpotOrderEditor(day.spotOrder);
  drawRoutes(day.id);
}

function renderDaySpotOrderEditor(spotOrder) {
  const ul = document.getElementById('day-spot-order-list');
  if (!ul) return;
  while (ul.firstChild) ul.removeChild(ul.firstChild);

  spotOrder.forEach((sid, index) => {
    const spot = spots.find((s) => s.id === sid);
    const li = document.createElement('li');
    li.setAttribute('data-spot-id', sid);
    const label = document.createElement('span');
    label.textContent = spot ? spot.name : '已删除景点';

    const actions = document.createElement('div');
    actions.className = 'actions';
    const upBtn = document.createElement('button');
    upBtn.className = 'small-btn';
    upBtn.textContent = '↑';
    upBtn.onclick = () => {
      if (index === 0) return;
      const tmp = spotOrder[index - 1];
      spotOrder[index - 1] = spotOrder[index];
      spotOrder[index] = tmp;
      renderDaySpotOrderEditor(spotOrder);
    };
    const downBtn = document.createElement('button');
    downBtn.className = 'small-btn';
    downBtn.textContent = '↓';
    downBtn.onclick = () => {
      if (index === spotOrder.length - 1) return;
      const tmp = spotOrder[index + 1];
      spotOrder[index + 1] = spotOrder[index];
      spotOrder[index] = tmp;
      renderDaySpotOrderEditor(spotOrder);
    };
    const delBtn = document.createElement('button');
    delBtn.className = 'small-btn';
    delBtn.textContent = '移除';
    delBtn.onclick = () => {
      spotOrder.splice(index, 1);
      renderDaySpotOrderEditor(spotOrder);
    };

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(delBtn);
    li.appendChild(label);
    li.appendChild(actions);
    ul.appendChild(li);
  });
}

const DAY_COLORS = ['#059669', '#2563eb', '#7c3aed', '#c026d3', '#dc2626', '#ea580c', '#ca8a04', '#16a34a'];

function drawRoutes(focusDayId) {
  if (!map) return;
  if (routePolylines.length) {
    routePolylines.forEach((p) => p.setMap(null));
    routePolylines = [];
  }
  if (distanceLabels.length) {
    distanceLabels.forEach((t) => t.setMap(null));
    distanceLabels = [];
  }
  const legendEl = document.getElementById('map-legend');
  if (legendEl) legendEl.innerHTML = '';

  if (!cities.length && !dailyPlans.length) return;

  const sortedCities = cities.slice().sort((a, b) => a.order - b.order);
  const cityPath = sortedCities
    .filter((c) => c.location)
    .map((c) => [c.location.lng, c.location.lat]);
  if (cityPath.length >= 2) {
    const cityLine = new AMap.Polyline({
      path: cityPath,
      strokeColor: '#64748b',
      strokeWeight: 4,
      strokeStyle: 'dashed',
    });
    map.add(cityLine);
    routePolylines.push(cityLine);
    if (legendEl) {
      const item = document.createElement('div');
      item.className = 'map-legend-item';
      item.innerHTML = '<span class="map-legend-color" style="background:#64748b;border-style:dashed"></span><span>城市间移动</span>';
      legendEl.appendChild(item);
    }
  }

  const daysToDraw = focusDayId
    ? dailyPlans.filter((d) => d.id === focusDayId)
    : dailyPlans.slice().sort((a, b) => a.dayIndex - b.dayIndex);

  daysToDraw.forEach((day, idx) => {
    const coords = [];
    const orderedSpots = [];
    day.spotOrder.forEach((sid) => {
      const spot = spots.find((s) => s.id === sid);
      if (spot && spot.location) {
        coords.push([spot.location.lng, spot.location.lat]);
        orderedSpots.push(spot);
      }
    });
    const color = DAY_COLORS[idx % DAY_COLORS.length];
    if (coords.length >= 2) {
      const line = new AMap.Polyline({
        path: coords,
        strokeColor: color,
        strokeWeight: 4,
      });
      map.add(line);
      routePolylines.push(line);

      // 在每一段中点位置标注大致距离，辅助用户在地图上感知顺序是否合理
      for (let i = 0; i < orderedSpots.length - 1; i++) {
        const a = orderedSpots[i].location;
        const b = orderedSpots[i + 1].location;
        if (
          typeof a.lat !== 'number' ||
          typeof a.lng !== 'number' ||
          typeof b.lat !== 'number' ||
          typeof b.lng !== 'number'
        )
          continue;
        const d = distanceInMeters(a.lat, a.lng, b.lat, b.lng);
        const midLng = (a.lng + b.lng) / 2;
        const midLat = (a.lat + b.lat) / 2;
        const label = new AMap.Text({
          text: `${(d / 1000).toFixed(1)} km`,
          position: [midLng, midLat],
          style: {
            'background-color': 'rgba(255,255,255,0.9)',
            'border-radius': '4px',
            padding: '2px 4px',
            'font-size': '10px',
            border: `1px solid ${color}`,
            color,
          },
        });
        map.add(label);
        distanceLabels.push(label);
      }
    }
    if (legendEl && (coords.length >= 1)) {
      const item = document.createElement('div');
      item.className = 'map-legend-item';
      const city = cities.find((c) => c.id === day.cityId);
      const label = `第${day.dayIndex}天${city ? ` · ${city.name}` : ''}`;
      item.innerHTML = `<span class="map-legend-color" style="background:${color}"></span><span>${label}</span>`;
      legendEl.appendChild(item);
    }
  });

  const overlays = [...cityMarkers, ...spotMarkers, ...routePolylines].filter(Boolean);
  if (overlays.length) {
    map.setFitView(overlays);
  }
}

function setupEventHandlers() {
  const addCityBtn = document.getElementById('add-city-btn');
  const addSpotBtn = document.getElementById('add-spot-btn');
  const saveDayBtn = document.getElementById('save-day-btn');
  const addSpotToDayBtn = document.getElementById('add-spot-to-day-btn');
  const generateRouteBtn = document.getElementById('generate-route-btn');
  const spotCitySelect = document.getElementById('spot-city-select');
  const dayCitySelect = document.getElementById('day-city-select');
  const aiRecommendSpotsBtn = document.getElementById(
    'ai-recommend-spots-btn',
  );
  const aiRecommendLodgingBtn = document.getElementById(
    'ai-recommend-lodging-btn',
  );
  const aiRefreshBtn = document.getElementById('ai-refresh-btn');
  const aiQuickPlanBtn = document.getElementById('ai-quick-plan-btn');
  const openTripWizardBtn = document.getElementById('open-trip-wizard-btn');
  const tripWizardApplyBtn = document.getElementById('trip-wizard-apply-btn');

  if (addCityBtn) {
    addCityBtn.onclick = () => {
      const nameInput = document.getElementById('city-name-input');
      const latInput = document.getElementById('city-lat-input');
      const lngInput = document.getElementById('city-lng-input');
      if (!nameInput || !latInput || !lngInput) return;
      const name = nameInput.value.trim();
      if (!name) {
        log('城市名称不能为空', 'error');
        return;
      }
      const id = `city_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const city = {
        id,
        name,
        order: cities.length,
      };
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        city.location = { lat, lng };
      }
      cities.push(city);
      nameInput.value = '';
      renderCities();
      drawRoutes();
      log(`已添加城市：${name}`);
      if (!city.location) {
        geocodeCityLocation(city);
      }
      scheduleAiRefresh();
      if (city.location) {
        autoSeedPoisForCity(city);
      }
    };
  }

  if (addSpotBtn) {
    addSpotBtn.onclick = () => {
      const citySelect = document.getElementById('spot-city-select');
      const nameInput = document.getElementById('spot-name-input');
      const latInput = document.getElementById('spot-lat-input');
      const lngInput = document.getElementById('spot-lng-input');
      const guideInput = document.getElementById('spot-guide-input');
      const timeInput = document.getElementById('spot-time-input');
      const transportInput = document.getElementById('spot-transport-input');
      const imageInput = document.getElementById('spot-image-input');
      const descriptionInput = document.getElementById('spot-description-input');
      const videoInput = document.getElementById('spot-video-input');
      const xiaohongshuInput = document.getElementById('spot-xiaohongshu-input');
      if (!citySelect || !nameInput || !latInput || !lngInput) return;
      const cityId = citySelect.value;
      if (!cityId) {
        log('请先选择景点所属城市', 'error');
        return;
      }
      const name = nameInput.value.trim();
      if (!name) {
        log('景点名称不能为空', 'error');
        return;
      }
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        log('请填写有效的景点经纬度，可在地图右键获取', 'error');
        return;
      }
      if (isDuplicateSpot(cityId, name, lat, lng)) {
        log('该景点在当前城市中已经存在或位置非常接近，已自动跳过重复添加。', 'warn');
        return;
      }
      const xhsRaw = (xiaohongshuInput && xiaohongshuInput.value.trim()) || '';
      const xiaohongshuUrls = xhsRaw ? xhsRaw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean) : undefined;
      const id = `spot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      spots.push({
        id,
        cityId,
        name,
        location: { lat, lng },
        guideUrl: guideInput?.value?.trim() || undefined,
        visitTimeText: timeInput?.value?.trim() || undefined,
        innerTransport: transportInput?.value?.trim() || undefined,
        imageUrl: imageInput?.value?.trim() || undefined,
        description: descriptionInput?.value?.trim() || undefined,
        videoUrl: videoInput?.value?.trim() || undefined,
        xiaohongshuUrls,
      });
      if (nameInput) nameInput.value = '';
      if (guideInput) guideInput.value = '';
      if (timeInput) timeInput.value = '';
      if (transportInput) transportInput.value = '';
      if (imageInput) imageInput.value = '';
      if (descriptionInput) descriptionInput.value = '';
      if (videoInput) videoInput.value = '';
      if (xiaohongshuInput) xiaohongshuInput.value = '';
      renderSpots();
      drawRoutes();
      log(`已添加景点：${name}`);
      scheduleAiRefresh();
    };
  }

  const openPoolBtn = document.getElementById('open-spot-pool-btn');
  const closePoolBtn = document.getElementById('close-spot-pool-btn');
  const closeDetailBtn = document.getElementById('close-spot-detail-btn');
  const poolCityFilter = document.getElementById('spot-pool-city-filter');
  if (openPoolBtn) openPoolBtn.onclick = openSpotPoolView;
  if (closePoolBtn) closePoolBtn.onclick = closeSpotPoolView;
  document.getElementById('spot-pool-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'spot-pool-overlay') closeSpotPoolView();
  });
  if (closeDetailBtn) closeDetailBtn.onclick = closeSpotDetail;
  document.getElementById('spot-detail-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'spot-detail-overlay') closeSpotDetail();
  });
  const detailDeleteBtn = document.getElementById('spot-detail-delete-btn');
  if (detailDeleteBtn) {
    detailDeleteBtn.onclick = () => {
      if (!currentDetailSpot) return;
      spots = spots.filter((s) => s.id !== currentDetailSpot.id);
      dailyPlans.forEach((d) => {
        d.spotOrder = d.spotOrder.filter((sid) => sid !== currentDetailSpot.id);
      });
      closeSpotDetail();
      renderSpots();
      renderDailyPlans();
      drawRoutes();
      log(`已从景点池移除：${currentDetailSpot.name}`, 'warn');
      scheduleAiRefresh();
    };
  }
  if (poolCityFilter) poolCityFilter.onchange = () => renderSpotPoolGrid();

  if (dayCitySelect) {
    dayCitySelect.onchange = () => {
      refreshDaySpotSelect();
      const daySpotOrderList = document.getElementById('day-spot-order-list');
      if (daySpotOrderList) {
        while (daySpotOrderList.firstChild)
          daySpotOrderList.removeChild(daySpotOrderList.firstChild);
      }
    };
  }

  if (addSpotToDayBtn) {
    addSpotToDayBtn.onclick = () => {
      const daySpotSelect = document.getElementById('day-spot-select');
      const list = document.getElementById('day-spot-order-list');
      if (!daySpotSelect || !list) return;
      const spotId = daySpotSelect.value;
      if (!spotId) {
        log('请选择一个要加入当天的景点', 'error');
        return;
      }
      const existingOrder = Array.from(list.children)
        .map((li) => li.getAttribute('data-spot-id'))
        .filter(Boolean);
      existingOrder.push(spotId);
      renderDaySpotOrderEditor(existingOrder);
    };
  }

  if (saveDayBtn) {
    saveDayBtn.onclick = () => {
      const dayIndexInput = document.getElementById('day-index-input');
      const dayCitySelect = document.getElementById('day-city-select');
      const dayDateInput = document.getElementById('day-date-input');
      const lodgingNameInput = document.getElementById('lodging-name-input');
      const lodgingAddressInput = document.getElementById('lodging-address-input');
      const dayTransportModeInput = document.getElementById('day-transport-mode-input');
      const daySpotOrderList = document.getElementById('day-spot-order-list');
      if (
        !dayIndexInput ||
        !dayCitySelect ||
        !dayDateInput ||
        !lodgingNameInput ||
        !lodgingAddressInput ||
        !daySpotOrderList
      )
        return;
      const dayIndex = parseInt(dayIndexInput.value, 10);
      if (Number.isNaN(dayIndex) || dayIndex <= 0) {
        log('请填写有效的天数（>=1）', 'error');
        return;
      }
      const cityId = dayCitySelect.value;
      if (!cityId) {
        log('请选择当天所在城市', 'error');
        return;
      }
      const spotOrder = Array.from(daySpotOrderList.children)
        .map((li) => li.getAttribute('data-spot-id'))
        .filter(Boolean);

      const lodging = {
        name: lodgingNameInput.value.trim() || undefined,
        address: lodgingAddressInput.value.trim() || undefined,
      };
      const transportMode = dayTransportModeInput?.value?.trim() || undefined;

      const existingIndex = dailyPlans.findIndex((d) => d.dayIndex === dayIndex);
      if (existingIndex >= 0) {
        dailyPlans[existingIndex] = {
          ...dailyPlans[existingIndex],
          cityId,
          date: dayDateInput.value || undefined,
          lodging,
          spotOrder,
          transportMode,
        };
        log(`已更新第 ${dayIndex} 天行程`);
      } else {
        dailyPlans.push({
          id: `day_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          dayIndex,
          cityId,
          date: dayDateInput.value || undefined,
          lodging,
          spotOrder,
          transportMode,
        });
        log(`已保存第 ${dayIndex} 天行程`);
      }
      renderDailyPlans();
      drawRoutes();
      scheduleAiRefresh();
    };
  }

  if (generateRouteBtn) {
    generateRouteBtn.onclick = () => {
      drawRoutes();
      runReasonablenessChecks();
      scheduleAiRefresh();
    };
  }

  if (aiRecommendSpotsBtn) {
    aiRecommendSpotsBtn.onclick = () => {
      recommendSpotsByAI();
    };
  }

  if (aiRecommendLodgingBtn) {
    aiRecommendLodgingBtn.onclick = () => {
      recommendLodgingByAI();
    };
  }

  if (aiRefreshBtn) {
    aiRefreshBtn.onclick = () => {
      requestAiRecommendations();
    };
  }

  if (aiQuickPlanBtn) {
    aiQuickPlanBtn.onclick = () => {
      const trip = collectTripContext();
      if (!trip.cities.length) {
        log('请先添加至少一个城市，再让 AI 生成详细攻略草稿。', 'error');
        return;
      }
      requestAiRecommendations();
      const card = document.getElementById('ai-recommend-card');
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  const tripWizardOverlay = document.getElementById('trip-wizard-overlay');
  const closeTripWizardBtn = document.getElementById('close-trip-wizard-btn');
  if (openTripWizardBtn && tripWizardOverlay) {
    openTripWizardBtn.onclick = () => {
      tripQuizPath = [];
      tripQuizTags = [];
      renderTripQuizQuestion('q_length');
      tripWizardOverlay.hidden = false;
    };
  }
  if (closeTripWizardBtn && tripWizardOverlay) {
    closeTripWizardBtn.onclick = () => {
      tripWizardOverlay.hidden = true;
    };
  }
  tripWizardOverlay?.addEventListener('click', (e) => {
    if (e.target.id === 'trip-wizard-overlay') {
      tripWizardOverlay.hidden = true;
    }
  });

  if (tripWizardApplyBtn) {
    tripWizardApplyBtn.onclick = () => {
      const profile = buildTripProfileFromTags(tripQuizTags);
      if (!profile) {
        log('请先完成几道题，让我们了解你的旅行偏好。', 'error');
        return;
      }
      const expectationInput = document.getElementById(
        'trip-expectation',
      );
      const prev = expectationInput?.value?.trim() || '';
      const marker = '【旅行性格测验画像】';
      const summary = `${marker}${profile.summary}`;
      expectationInput.value = prev
        ? `${prev}\n\n${summary}`
        : summary;
      const overlay = document.getElementById('trip-wizard-overlay');
      if (overlay) overlay.hidden = true;
      log(
        '已根据测验结果生成旅行画像，并写入「旅行期望」，之后的 AI 推荐会参考这些偏好。',
        'info',
      );
    };
  }

  const amapPoiBtn = document.getElementById('amap-poi-btn');
  if (amapPoiBtn) {
    amapPoiBtn.onclick = () => fetchAmapPoi();
  }

   const amapPoiAiBtn = document.getElementById('amap-poi-ai-btn');
   if (amapPoiAiBtn) {
     amapPoiAiBtn.onclick = () => fetchAmapPoiByAI();
   }

  const openDayTimelineBtn = document.getElementById('open-day-timeline-btn');
  const closeDayPlanBtn = document.getElementById('close-day-plan-btn');
  const dayPlanOverlay = document.getElementById('day-plan-overlay');
  if (openDayTimelineBtn && dayPlanOverlay) {
    openDayTimelineBtn.onclick = () => {
      dayPlanOverlay.hidden = false;
      renderDayTimeline();
    };
  }
  if (closeDayPlanBtn && dayPlanOverlay) {
    closeDayPlanBtn.onclick = () => {
      dayPlanOverlay.hidden = true;
    };
  }
  dayPlanOverlay?.addEventListener('click', (e) => {
    if (e.target.id === 'day-plan-overlay') {
      dayPlanOverlay.hidden = true;
    }
  });
}

async function fetchAmapPoi() {
  const citySelect = document.getElementById('amap-city-select');
  const keywordsInput = document.getElementById('amap-keywords-input');
  if (!citySelect || !keywordsInput) return;
  const cityName = citySelect.value;
  if (!cityName) {
    log('请先选择城市再获取高德 POI 推荐。', 'error');
    return;
  }
  const city = cities.find((c) => c.name === cityName);
  if (!city) {
    log('未找到该城市对应数据。', 'error');
    return;
  }
  const keywords = keywordsInput.value.trim() || '景点';
  log(`正在请求高德 POI：${cityName} / ${keywords}...`, 'info');
  try {
    const url = `/api/amap/poi?city=${encodeURIComponent(
      cityName,
    )}&keywords=${encodeURIComponent(keywords)}&quality=normal`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `请求失败 ${res.status}`;
      log(msg, 'error');
      if (data.raw && data.raw !== msg) log(`高德返回：${data.raw}`, 'info');
      return;
    }
    const pois = data.pois || [];
    if (!pois.length) {
      log('高德未返回结果，可换关键词或城市。', 'warn');
      return;
    }
    let added = 0;
    for (const p of pois) {
      const loc = p.location ? p.location.split(',') : [];
      const lng = parseFloat(loc[0]);
      const lat = parseFloat(loc[1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const name = (p.name || '').trim();
      if (!name) continue;
      if (isDuplicateSpot(city.id, name, lat, lng)) {
        continue;
      }
      const id = `spot_amap_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;
      const address = (p.address || '').trim();
      const type = (p.type || '').trim();
      const rating =
        Number(p.biz_ext?.rating || p.rating || 0) || undefined;
      const metaParts = [];
      if (type) metaParts.push(type);
      if (address) metaParts.push(address);
      if (rating) metaParts.push(`评分约 ${rating}`);
      spots.push({
        id,
        cityId: city.id,
        name,
        location: { lat, lng },
        guideUrl: undefined,
        visitTimeText: undefined,
        innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
      });
      added++;
    }
    renderSpots();
    refreshDaySpotSelect();
    drawRoutes();
    log(`已将 ${added} 个高德 POI 加入景点池（${cityName}）。`, 'info');
  } catch (e) {
    log(`高德 POI 请求失败：${e.message}`, 'error');
  }
}

async function fetchAmapPoiByAI() {
  const citySelect = document.getElementById('amap-city-select');
  const naturalInput = document.getElementById('amap-natural-query-input');
  if (!citySelect || !naturalInput) return;
  const cityName = citySelect.value;
  if (!cityName) {
    log('请先选择城市，再用 AI 帮忙找 POI。', 'error');
    return;
  }
  const city = cities.find((c) => c.name === cityName);
  if (!city) {
    log('未找到该城市对应数据。', 'error');
    return;
  }
  const natural = naturalInput.value.trim();
  if (!natural) {
    log('请先用自然语言描述你想找的地方，例如：适合亲子的安静公园。', 'error');
    return;
  }

  const trip = collectTripContext();
  log(`正在让 AI 帮你构建高德搜索条件：${natural}`, 'info');
  try {
    const res = await fetch('/api/ai/poi-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naturalQuery: natural, cityName, trip }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `AI 解析失败 ${res.status}`;
      log(msg, 'error');
      return;
    }
    const keywords = (data.keywords || '').trim() || '景点';
    const types = (data.types || '').trim();
    const quality = data.quality === 'high' ? 'high' : 'normal';

    log(
      `AI 给出的高德搜索条件：keywords="${keywords}"${
        types ? `, types="${types}"` : ''
      }，质量=${quality}`,
      'info',
    );

    const url = `/api/amap/poi?city=${encodeURIComponent(
      cityName,
    )}&keywords=${encodeURIComponent(keywords)}${
      types ? `&types=${encodeURIComponent(types)}` : ''
    }&quality=${encodeURIComponent(quality)}`;
    const poiRes = await fetch(url);
    const poiData = await poiRes.json();
    if (!poiRes.ok) {
      const msg = poiData.error || `请求失败 ${poiRes.status}`;
      log(msg, 'error');
      if (poiData.raw && poiData.raw !== msg)
        log(`高德返回：${poiData.raw}`, 'info');
      return;
    }
    const pois = poiData.pois || [];
    if (!pois.length) {
      log('高德未返回结果，可尝试调整描述。', 'warn');
      return;
    }

    let added = 0;
    for (const p of pois) {
      const loc = p.location ? p.location.split(',') : [];
      const lng = parseFloat(loc[0]);
      const lat = parseFloat(loc[1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const name = (p.name || '').trim();
      if (!name) continue;
      if (isDuplicateSpot(city.id, name, lat, lng)) {
        continue;
      }
      const id = `spot_amap_ai_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;
      const address = (p.address || '').trim();
      const type = (p.type || '').trim();
      const rating =
        Number(p.biz_ext?.rating || p.rating || 0) || undefined;
      const metaParts = [];
      if (type) metaParts.push(type);
      if (address) metaParts.push(address);
      if (rating) metaParts.push(`评分约 ${rating}`);
      spots.push({
        id,
        cityId: city.id,
        name,
        location: { lat, lng },
        guideUrl: undefined,
        visitTimeText: undefined,
        innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
      });
      added++;
    }
    renderSpots();
    refreshDaySpotSelect();
    drawRoutes();
    log(
      `已根据 AI+高德为 ${cityName} 加入 ${added} 个候选景点到景点池。`,
      'info',
    );
  } catch (e) {
    log(`AI 辅助高德 POI 请求失败：${e.message}`, 'error');
  }
}

async function autoSeedPoisForCity(city) {
  const cityName = city.name;
  log(`正在为新城市「${cityName}」自动获取一批高德推荐景点候选...`, 'info');
  try {
    const url = `/api/amap/poi?city=${encodeURIComponent(
      cityName,
    )}&keywords=${encodeURIComponent('景点')}&types=110000&quality=high`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `请求失败 ${res.status}`;
      log(msg, 'warn');
      return;
    }
    const pois = data.pois || [];
    if (!pois.length) {
      log('自动获取高德景点失败：未返回任何结果。', 'warn');
      return;
    }
    const top = pois.slice(0, 6);
    const names = top
      .map((p) => p.name)
      .filter(Boolean)
      .join(' / ');
    const shouldAdd = window.confirm(
      `为城市「${cityName}」找到了 ${top.length} 个高德推荐景点：\n\n${names}\n\n是否将它们加入景点池（之后可在景点池中删除不需要的）？`,
    );
    if (!shouldAdd) {
      log('已取消自动加入高德景点，你可以稍后在景点池中手动获取。', 'info');
      return;
    }
    let added = 0;
    for (const p of top) {
      const loc = p.location ? p.location.split(',') : [];
      const lng = parseFloat(loc[0]);
      const lat = parseFloat(loc[1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const name = (p.name || '').trim();
      if (!name) continue;
      if (isDuplicateSpot(city.id, name, lat, lng)) continue;
      const id = `spot_amap_seed_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;
      const address = (p.address || '').trim();
      const type = (p.type || '').trim();
      const rating =
        Number(p.biz_ext?.rating || p.rating || 0) || undefined;
      const metaParts = [];
      if (type) metaParts.push(type);
      if (address) metaParts.push(address);
      if (rating) metaParts.push(`评分约 ${rating}`);
      spots.push({
        id,
        cityId: city.id,
        name,
        location: { lat, lng },
        guideUrl: undefined,
        visitTimeText: undefined,
        innerTransport: metaParts.length ? metaParts.join(' · ') : undefined,
      });
      added++;
    }
    if (added) {
      renderSpots();
      refreshDaySpotSelect();
      drawRoutes();
      log(
        `已为城市「${cityName}」自动加入 ${added} 个来自高德的候选景点，可在景点池中进一步筛选。`,
        'info',
      );
    } else {
      log('自动加入高德景点时未发现新的候选点（可能都已存在）。', 'info');
    }
  } catch (e) {
    log(`为城市自动获取高德景点失败：${e.message}`, 'error');
  }
}

async function extendDaySpotsByAI(dayId) {
  const day = dailyPlans.find((d) => d.id === dayId);
  if (!day) {
    log('未找到该天的行程数据，无法为其推荐景点。', 'error');
    return;
  }
  const city = cities.find((c) => c.id === day.cityId);
  if (!city) {
    log('未找到该天所在城市，无法为其推荐景点。', 'error');
    return;
  }

  const trip = collectTripContext();
  const budgetInput = document.getElementById('ai-budget-input');
  const budgetPerDay = parseFloat(budgetInput?.value) || 0;
  const basePrompt = buildAiPrompt({
    trip,
    focusCityId: city.id,
    budgetPerDay,
  });
  const extra = `\n\n【额外要求】\n仅针对上述行程中的第 ${day.dayIndex} 天（城市：${city.name}），在 sections 中增加或补充分 type="spots" 的推荐，用于「补充 1-3 个新的景点候选」，优先考虑与当日已有景点动线相近的小众或特色景点。\n不要修改用户已存在的行程，只做补充建议。`;
  const prompt = basePrompt + extra;

  log(
    `正在为第 ${day.dayIndex} 天（${city.name}）请求 AI 补充景点候选...`,
    'info',
  );

  try {
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || `请求失败 ${res.status}`;
      log(msg, 'error');
      return;
    }
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const spotSections = sections.filter((s) => s.type === 'spots');
    if (!spotSections.length) {
      log('AI 未返回可用的补充景点候选。', 'warn');
      return;
    }

    const aiCitySelect = document.getElementById('ai-city-select');
    if (aiCitySelect) {
      aiCitySelect.value = city.id;
    }

    let added = 0;
    spotSections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const name = (item.title || '').trim();
        if (!name) return;
        const lat =
          typeof item.lat === 'number' ? item.lat : city.location?.lat;
        const lng =
          typeof item.lng === 'number' ? item.lng : city.location?.lng;
        if (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          isDuplicateSpot(city.id, name, lat, lng)
        ) {
          return;
        }
        const id = `spot_ai_day_${Date.now()}_${Math.random()
          .toString(16)
          .slice(2)}`;
        spots.push({
          id,
          cityId: city.id,
          name,
          location: {
            lat: typeof lat === 'number' ? lat : 0,
            lng: typeof lng === 'number' ? lng : 0,
          },
          guideUrl: item.guideUrl,
          visitTimeText: item.summary,
          innerTransport: item.innerTransport,
        });
        day.spotOrder.push(id);
        added++;
      });
    });

    if (!added) {
      log('AI 补充景点与现有景点高度重复，未添加新的候选。', 'warn');
      return;
    }

    renderSpots();
    renderDailyPlans();
    drawRoutes(day.id);
    log(
      `已为第 ${day.dayIndex} 天（${city.name}）加入 ${added} 个 AI 补充景点，并自动添加到当天顺序末尾。`,
      'info',
    );
  } catch (e) {
    log(`为当天补充 AI 景点失败：${e.message}`, 'error');
  }
}

function geocodeCityLocation(city) {
  if (!map || typeof AMap === 'undefined' || !AMap.Geocoder) {
    log(`当前环境不支持自动定位城市【${city.name}】的经纬度。`, 'warn');
    return;
  }
  const geocoder = new AMap.Geocoder({
    city: '全国',
  });
  geocoder.getLocation(city.name, (status, result) => {
    if (status === 'complete' && result.info === 'OK' && result.geocodes.length) {
      const loc = result.geocodes[0].location;
      const lng = loc.lng;
      const lat = loc.lat;
      city.location = { lat, lng };
      log(
        `已根据城市名自动定位：${city.name} -> (${lat.toFixed(4)}, ${lng.toFixed(
          4,
        )})`,
      );
      renderCities();
      drawRoutes();
    } else {
      log(`无法根据城市名自动获取经纬度：${city.name}，请手动填写。`, 'warn');
    }
  });
}

function renderDayTimeline() {
  const container = document.getElementById('day-timeline-list');
  const summary = document.getElementById('day-timeline-summary');
  if (!container || !summary) return;
  container.innerHTML = '';

  const sorted = dailyPlans
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex);

  if (!sorted.length) {
    summary.innerHTML =
      '<div class="day-timeline-empty">还没有创建任何每日行程。<br/>使用左侧的「+ 新建一天」开始规划吧。</div>';
    return;
  }

  let firstDayId = null;

  sorted.forEach((day, idx) => {
    const div = document.createElement('div');
    div.className = 'day-timeline-item';
    div.setAttribute('data-day-id', day.id);

    const city = cities.find((c) => c.id === day.cityId);
    const cityName = city ? city.name : '未知城市';

    const hasLodging = !!(day.lodging && day.lodging.name);
    const spotCount = day.spotOrder.length;

    const title = document.createElement('div');
    title.className = 'day-timeline-title';
    title.textContent = `第 ${day.dayIndex} 天 · ${cityName}`;

    const meta = document.createElement('div');
    meta.className = 'day-timeline-meta';
    meta.textContent = day.date ? day.date : '日期未填写';

    const tags = document.createElement('div');
    tags.className = 'day-timeline-tags';

    const spotTag = document.createElement('span');
    spotTag.className = 'day-timeline-tag';
    spotTag.textContent = `${spotCount} 个景点`;
    tags.appendChild(spotTag);

    if (!hasLodging) {
      const t = document.createElement('span');
      t.className = 'day-timeline-tag warn';
      t.textContent = '住宿未填写';
      tags.appendChild(t);
    }

    if (spotCount > 6) {
      const t = document.createElement('span');
      t.className = 'day-timeline-tag danger';
      t.textContent = '行程偏紧';
      tags.appendChild(t);
    } else if (spotCount <= 1) {
      const t = document.createElement('span');
      t.className = 'day-timeline-tag warn';
      t.textContent = '行程偏松';
      tags.appendChild(t);
    }

    div.appendChild(title);
    div.appendChild(meta);
    div.appendChild(tags);

    div.onclick = () => {
      document
        .querySelectorAll('.day-timeline-item.active')
        .forEach((el) => el.classList.remove('active'));
      div.classList.add('active');
      renderDayTimelineDetail(day);
      drawRoutes(day.id);
      focusDay(day.id);
    };

    container.appendChild(div);

    if (idx === 0) {
      firstDayId = day.id;
    }
  });

  if (firstDayId) {
    const first = container.querySelector(
      `.day-timeline-item[data-day-id="${firstDayId}"]`,
    );
    if (first) {
      first.classList.add('active');
      const firstDay = sorted.find((d) => d.id === firstDayId);
      if (firstDay) {
        renderDayTimelineDetail(firstDay);
      }
    }
  }
}

function renderDayTimelineDetail(day) {
  const summary = document.getElementById('day-timeline-summary');
  if (!summary) return;
  const city = cities.find((c) => c.id === day.cityId);
  const cityName = city ? city.name : '未知城市';
  const lodgingName = day.lodging?.name || '（未填写）';
  const lodgingAddr = day.lodging?.address || '';
  const transport = day.transportMode || '（未填写）';
  const names = day.spotOrder
    .map((sid) => spots.find((s) => s.id === sid)?.name || '已删除景点')
    .join(' → ');

  const lines = [];
  lines.push('<div class="day-timeline-detail-inner">');
  lines.push(`<h3>第 ${day.dayIndex} 天 · ${cityName}</h3>`);
  lines.push(
    `<div class="subtitle">${
      day.date || '日期未填写'
    } · ${names || '尚未安排景点'}</div>`,
  );

  lines.push('<div class="day-timeline-detail-section">');
  lines.push(
    '<div class="day-timeline-detail-section-title">住宿</div>',
  );
  lines.push(
    `<div class="day-timeline-detail-text">${lodgingName}${
      lodgingAddr ? '（' + lodgingAddr + '）' : ''
    }</div>`,
  );
  lines.push('</div>');

  lines.push('<div class="day-timeline-detail-section">');
  lines.push(
    '<div class="day-timeline-detail-section-title">景点顺序</div>',
  );
  lines.push(
    `<div class="day-timeline-detail-spots">${
      names || '尚未安排景点'
    }</div>`,
  );
  lines.push('</div>');

  lines.push('<div class="day-timeline-detail-section">');
  lines.push(
    '<div class="day-timeline-detail-section-title">当日主要交通方式</div>',
  );
  lines.push(
    `<div class="day-timeline-detail-text">${transport}</div>`,
  );
  lines.push('</div>');

  lines.push(
    '<div class="edit-tip">下面的表单已经自动填入了这一天的数据，你可以在此直接调整天数、城市、住宿和景点顺序。若希望 AI 为这一天推荐补充景点，可点击下方按钮。</div>',
  );
  lines.push(
    '<div class="edit-tip"><button id="day-ai-extend-btn" class="secondary-btn">为这一天推荐补充景点</button></div>',
  );
  lines.push('</div>');

  summary.innerHTML = lines.join('');

  const extendBtn = document.getElementById('day-ai-extend-btn');
  if (extendBtn) {
    extendBtn.onclick = () => extendDaySpotsByAI(day.id);
  }
}

function renderTripQuizQuestion(nodeId) {
  const node = TRIP_QUIZ_TREE[nodeId];
  const qEl = document.getElementById('trip-wizard-question');
  const optEl = document.getElementById('trip-wizard-options');
  const progressEl = document.getElementById('trip-wizard-progress');
  const profileEl = document.getElementById(
    'trip-wizard-profile-preview',
  );
  const destEl = document.getElementById('trip-wizard-destinations');
  const prevBtn = document.getElementById('trip-wizard-prev-btn');
  if (!node || !qEl || !optEl || !progressEl || !profileEl || !destEl)
    return;

  if (!tripQuizPath.length) {
    tripQuizPath.push(nodeId);
  } else if (tripQuizPath[tripQuizPath.length - 1] !== nodeId) {
    tripQuizPath.push(nodeId);
  }

  const totalSteps = 8;
  const currentStep = Math.min(tripQuizPath.length, totalSteps);
  progressEl.textContent = `第 ${currentStep} / ${totalSteps} 题`;

  qEl.textContent = node.question;
  optEl.innerHTML = '';

  node.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trip-wizard-option-btn';
    const spanLabel = document.createElement('span');
    spanLabel.className = 'label';
    spanLabel.textContent = opt.label;
    btn.appendChild(spanLabel);
    if (opt.hint) {
      const spanHint = document.createElement('span');
      spanHint.className = 'hint';
      spanHint.textContent = opt.hint;
      btn.appendChild(spanHint);
    }
    btn.onclick = () => {
      tripQuizTags.push(...(opt.tags || []));
      if (opt.next) {
        renderTripQuizQuestion(opt.next);
      } else {
        renderTripQuizResult();
      }
    };
    optEl.appendChild(btn);
  });

  prevBtn.onclick = () => {
    if (tripQuizPath.length <= 1) return;
    tripQuizPath.pop();
    const prevId = tripQuizPath[tripQuizPath.length - 1];
    renderTripQuizQuestion(prevId);
  };

  const profile = buildTripProfileFromTags(tripQuizTags);
  profileEl.textContent = profile
    ? `大致画像：${profile.summary}`
    : '根据你的选择，我们会帮你概括出一条「旅行画像」，作为之后 AI 生成攻略的依据。';
  renderTripProfileDestinations(profile, destEl);
}

function buildTripProfileFromTags(tags) {
  if (!tags || !tags.length) return null;
  const has = (t) => tags.includes(t);
  let length = '3–5天';
  if (has('length_short')) length = '1–2天';
  if (has('length_long')) length = '6天以上';
  let scope = has('scope_abroad') ? '出境游' : '国内游';
  let style = '城市 + 自然搭配';
  if (has('style_nature')) style = '以自然风光为主';
  if (has('style_city')) style = '以城市逛吃为主';
  let pace = has('pace_active') ? '节奏偏紧凑' : '节奏偏轻松';
  let companion = '适合朋友或独自出行';
  if (has('companion_kids')) companion = '亲子友好';
  else if (has('companion_couple')) companion = '情侣/伴侣';
  else if (has('companion_friends')) companion = '朋友结伴';
  else if (has('companion_solo')) companion = '适合一个人慢慢玩';
  let crowd = has('prefer_quiet') ? '更偏好人少一点' : '热门景点也能接受';
  let budget = '预算中等，偏向性价比';
  if (has('budget_low')) budget = '预算偏省';
  if (has('budget_high')) budget = '预算偏体验';
  let food = '美食正常优先级';
  if (has('food_focus')) food = '美食是此行重要部分';

  const summary = `${scope} · ${length} · ${style} · ${companion} · ${pace} · ${crowd} · ${budget} · ${food}`;
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
  };
}

function renderTripProfileDestinations(profile, destEl) {
  destEl.innerHTML = '';
  if (!profile) return;
  const suggestions = suggestDestinationsFromProfile(profile);
  suggestions.forEach((sug) => {
    const card = document.createElement('div');
    card.className = 'trip-wizard-destination-card';
    const title = document.createElement('strong');
    title.textContent = sug.name;
    const desc = document.createElement('div');
    desc.textContent = sug.summary;
    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'trip-wizard-destination-tags';
    (sug.tags || []).forEach((t) => {
      const span = document.createElement('span');
      span.className = 'trip-wizard-destination-tag';
      span.textContent = t;
      tagsWrap.appendChild(span);
    });
    card.appendChild(title);
    card.appendChild(desc);
    if (sug.tags && sug.tags.length) {
      card.appendChild(tagsWrap);
    }
    destEl.appendChild(card);
  });
}

function suggestDestinationsFromProfile(profile) {
  const list = [];
  const { scope, style, companion, crowd, budget, length } = profile;
  const isShort = /1–2/.test(length);
  const isLong = /6天以上/.test(length);
  if (scope === '国内游' && style.includes('自然')) {
    list.push({
      name: isShort ? '近郊山水放松小假期' : '西南山地环线',
      summary: isShort
        ? '从所在城市出发 1–2 小时车程内，找一处山水/湖边民宿，小范围徒步+躺平。'
        : '结合高铁/航班去西南山区，安排 2–3 个自然景观城市串联，兼顾景色和节奏。',
      tags: ['自然风光', companion, budget],
    });
  }
  if (scope === '国内游' && style.includes('城市')) {
    list.push({
      name: isShort ? '周末城市逛吃' : '经典双城文化线',
      summary: isShort
        ? '选择高铁 1–3 小时可达的城市，集中在美食街区、博物馆和步行街附近活动。'
        : '安排两座风格不同的城市，比如一座历史感强、一座现代逛吃为主，来回切换体验。',
      tags: ['城市逛吃', companion, budget],
    });
  }
  if (scope === '出境游') {
    list.push({
      name: isShort ? '近程轻量出境' : '一国多城慢旅行',
      summary: isShort
        ? '选择签证/机票门槛较低的近程目的地（如日韩/东南亚），以 1 城为主，少挪动。'
        : '以 1–2 个国家为范围，串联 2–3 座节奏不同的城市，留足缓冲和休息日。',
      tags: ['出境', companion, budget],
    });
  }
  if (!list.length) {
    list.push({
      name: '弹性时间+城市/自然混搭行程',
      summary:
        '根据你的选择，可以用一座核心城市作为据点，搭配周边 1–2 个自然或小城目的地，保持节奏弹性。',
      tags: [companion, budget],
    });
  }
  return list;
}

function collectTripContext() {
  const titleInput = document.getElementById('trip-title');
  const startInput = document.getElementById('trip-start');
  const endInput = document.getElementById('trip-end');
  const expectationInput = document.getElementById('trip-expectation');
  const tripTypeSelect = document.getElementById('trip-type-select');
  return {
    title: titleInput?.value || '',
    startDate: startInput?.value || '',
    endDate: endInput?.value || '',
    travelExpectation: expectationInput?.value?.trim() || '',
    tripType: tripTypeSelect?.value || '',
    cities,
    spots,
    dailyPlans,
  };
}

function buildAiPrompt({ trip, focusCityId, budgetPerDay }) {
  const {
    title,
    startDate,
    endDate,
    travelExpectation,
    tripType,
    cities: cs,
    spots: sp,
    dailyPlans: dps,
  } = trip;
  const focusCity = cs.find((c) => c.id === focusCityId);

  let lines = [];
  lines.push('你是一个旅游规划助手。用户有一个「景点池」，所有推荐景点都应进入景点池；住宿单独推荐。');
  lines.push('要求：');
  lines.push('1. 只输出 JSON，不要输出任何解释文本。');
  lines.push('2. JSON 顶层结构为 {"sections":[...]}。');
  lines.push(
    '3. sections 每一项结构为：{"id":字符串,"title":字符串,"type":字符串("spots"或"lodging"或"other"),"items":[...]}。'
  );
  lines.push(
    '4. items 每一项结构为：{"title":字符串,"summary":字符串,"detail":字符串,"meta":字符串可选,"lat":数值可选,"lng":数值可选,"guideUrl":字符串可选,"innerTransport":字符串可选,"priceLevel":字符串可选}。'
  );
  lines.push('5. 不要包含 JSON 以外的任何文字，不要使用 markdown。');
  lines.push('');
  lines.push('【用户旅行期望】（请重点结合此条推荐）');
  lines.push(travelExpectation ? `用户说：${travelExpectation}` : '（用户未填写）');
  lines.push('');
  lines.push('【当前行程信息】');
  lines.push(`行程标题：${title || '（未填写）'}`);
  lines.push(`出发日期：${startDate || '（未填写）'}`);
  lines.push(`结束日期：${endDate || '（未填写）'}`);
  if (tripType) {
    lines.push(`出行类型：${tripType}（请在行程强度、景点类型和用语风格上适当贴合这一类型）`);
  } else {
    lines.push('出行类型：未指定，可适当给出适合不同人群的建议。');
  }
  lines.push('');

  lines.push('城市列表（按顺序）：');
  cs
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((c, idx) => {
      const loc =
        c.location && typeof c.location.lat === 'number'
          ? `(${c.location.lat},${c.location.lng})`
          : '(无坐标)';
      lines.push(`- 第${idx + 1} 个城市：${c.name}，坐标：${loc}`);
    });
  lines.push('');

  lines.push('景点列表：');
  sp.forEach((s) => {
    const city = cs.find((c) => c.id === s.cityId);
    const cityName = city ? city.name : '未知城市';
    lines.push(
      `- 景点：${s.name}（城市：${cityName}），坐标：(${s.location.lat},${s.location.lng})`,
    );
    if (s.visitTimeText) lines.push(`  预计时间：${s.visitTimeText}`);
    if (s.innerTransport) lines.push(`  城市内交通：${s.innerTransport}`);
    if (s.guideUrl) lines.push(`  攻略链接：${s.guideUrl}`);
  });
  if (!sp.length) {
    lines.push('- （尚未添加任何景点）');
  }
  lines.push('');

  lines.push('每日行程：');
  dps
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .forEach((d) => {
      const city = cs.find((c) => c.id === d.cityId);
      const cityName = city ? city.name : '未知城市';
      lines.push(
        `- 第 ${d.dayIndex} 天（${d.date || '日期未填'}），城市：${cityName}`,
      );
      const lodgingName = d.lodging?.name || '（住宿未填）';
      const lodgingAddr = d.lodging?.address || '';
      lines.push(
        `  住宿：${lodgingName}${
          lodgingAddr ? '，地址：' + lodgingAddr : ''
        }`,
      );
      if (d.spotOrder.length) {
        const names = d.spotOrder
          .map((sid) => sp.find((s) => s.id === sid)?.name || '已删除景点')
          .join(' -> ');
        lines.push(`  景点顺序：${names}`);
      } else {
        lines.push('  该天尚未安排景点');
      }
    });
  if (!dps.length) {
    lines.push('- （尚未创建任何每日行程）');
  }
  lines.push('');

  if (focusCity) {
    lines.push(`重点关注城市：${focusCity.name}`);
  }
  if (budgetPerDay && budgetPerDay > 0) {
    lines.push(`用户预期预算：每天约 ${budgetPerDay} 元人民币。`);
  } else {
    lines.push('用户未提供预算，你可以给出不同价位的选项并简单标注价格等级。');
  }
  lines.push('');
  lines.push(
    '请根据以上信息（尤其旅行期望）返回 sections：1）优先给出「景点推荐」type=spots，放入该城市的景点池；2）可为未填住宿的天推荐 type=lodging；3）若有行程优化建议用 type=other。',
  );

  return lines.join('\n');
}

function scheduleAiRefresh() {
  const aiStatus = document.getElementById('ai-status-text');
  if (aiStatus) {
    aiStatus.textContent = '行程已变更，准备刷新 AI 推荐...';
  }
  if (aiRefreshTimer) clearTimeout(aiRefreshTimer);
  aiRefreshTimer = setTimeout(() => {
    requestAiRecommendations();
  }, 1500);
}

async function requestAiRecommendations() {
  const aiStatus = document.getElementById('ai-status-text');
  const aiPromptView = document.getElementById('ai-prompt-view');
  const aiSectionsContainer = document.getElementById('ai-sections-container');
  const aiCitySelect = document.getElementById('ai-city-select');
  const aiBudgetInput = document.getElementById('ai-budget-input');

  if (!aiStatus || !aiPromptView || !aiSectionsContainer || !aiCitySelect || !aiBudgetInput) {
    return;
  }

  const trip = collectTripContext();
  const focusCityId = aiCitySelect.value || (cities[0]?.id || '');
  const budgetPerDay = parseFloat(aiBudgetInput.value) || 0;
  const prompt = buildAiPrompt({ trip, focusCityId, budgetPerDay });

  lastAiPayload = { trip, focusCityId, budgetPerDay, prompt };

  aiStatus.textContent = '正在向后端请求 AI 推荐...';
  aiPromptView.textContent = prompt;
  aiSectionsContainer.innerHTML = '';

  try {
    const res = await fetch('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastAiPayload),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const sections = Array.isArray(data.sections) ? data.sections : [];
    renderAiSections(sections);
    aiStatus.textContent = sections.length
      ? '已根据当前行程生成 AI 推荐。'
      : 'AI 没有返回可用的推荐，请适当调整行程后重试。';
  } catch (e) {
    aiStatus.textContent = `请求失败：${e.message}`;
    log(
      `AI 推荐请求失败：${e.message}。请检查后端 /api/ai/recommend 是否已启动以及 API Key 是否填写。`,
      'error',
    );
  }
}

function renderAiSections(sections) {
  const container = document.getElementById('ai-sections-container');
  if (!container) return;
  container.innerHTML = '';

  sections.forEach((sec) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-section';

    const header = document.createElement('div');
    header.className = 'ai-section-header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'ai-section-title';
    titleSpan.textContent = sec.title || '未命名推荐';

    const typeSpan = document.createElement('span');
    typeSpan.className = 'ai-section-type';
    typeSpan.textContent = sec.type || 'other';

    header.appendChild(titleSpan);
    header.appendChild(typeSpan);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'ai-section-items';
    itemsDiv.style.display = 'none';

    (sec.items || []).forEach((item) => {
      const itemDiv = document.createElement('div');
      itemDiv.style.marginBottom = '4px';

      const line1 = document.createElement('div');
      const title = document.createElement('span');
      title.className = 'ai-item-title';
      title.textContent = item.title || '未命名条目';
      line1.appendChild(title);
      if (item.summary) {
        const summary = document.createElement('span');
        summary.className = 'ai-item-meta';
        summary.textContent = ` - ${item.summary}`;
        line1.appendChild(summary);
      }

      const reason = document.createElement('div');
      reason.className = 'ai-item-reason';
      reason.textContent = item.detail || item.meta || '';

      const actions = document.createElement('div');
      actions.className = 'ai-item-actions';

      if (sec.type === 'spots') {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'small-btn';
        applyBtn.textContent = '加入景点';
        applyBtn.onclick = () => applyAiSpotItem(item);
        actions.appendChild(applyBtn);
      } else if (sec.type === 'lodging') {
        const applyBtn = document.createElement('button');
        applyBtn.className = 'small-btn';
        applyBtn.textContent = '填入住宿';
        applyBtn.onclick = () => applyAiLodgingItem(item);
        actions.appendChild(applyBtn);
      }

      itemDiv.appendChild(line1);
      if (reason.textContent) itemDiv.appendChild(reason);
      if (actions.childNodes.length) itemDiv.appendChild(actions);
      itemsDiv.appendChild(itemDiv);
    });

    header.onclick = () => {
      itemsDiv.style.display = itemsDiv.style.display === 'none' ? 'block' : 'none';
    };

    wrapper.appendChild(header);
    wrapper.appendChild(itemsDiv);
    container.appendChild(wrapper);
  });
}

function applyAiSpotItem(item) {
  const citySelect = document.getElementById('ai-city-select');
  if (!citySelect) return;
  const cityId = citySelect.value || (cities[0]?.id || '');
  const city = cities.find((c) => c.id === cityId);
  if (!city) {
    log('无法应用景点：当前没有可用城市。', 'error');
    return;
  }
  const lat = typeof item.lat === 'number' ? item.lat : city.location?.lat;
  const lng = typeof item.lng === 'number' ? item.lng : city.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    log('AI 推荐景点未提供坐标，且城市也没有坐标，无法放到地图上。', 'warn');
  }
  const id = `spot_ai_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  spots.push({
    id,
    cityId: city.id,
    name: item.title || 'AI 推荐景点',
    location: { lat: lat || 0, lng: lng || 0 },
    guideUrl: item.guideUrl,
    visitTimeText: item.summary,
    innerTransport: item.innerTransport,
  });
  renderSpots();
  refreshDaySpotSelect();
  drawRoutes();
  log(`已将 AI 推荐景点加入：${item.title || 'AI 推荐景点'}`, 'info');
  scheduleAiRefresh();
}

function applyAiLodgingItem(item) {
  const citySelect = document.getElementById('ai-city-select');
  if (!citySelect) return;
  const cityId = citySelect.value || (cities[0]?.id || '');
  const cityDays = dailyPlans
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .filter((d) => d.cityId === cityId);
  const targetDay =
    cityDays.find((d) => !d.lodging || !d.lodging.name) || cityDays[0];
  if (!targetDay) {
    log('当前城市没有对应的每日行程，无法填入住宿。', 'warn');
    return;
  }
  targetDay.lodging = {
    name: item.title || 'AI 推荐住宿',
    address: item.meta || item.detail || item.summary || '',
  };
  renderDailyPlans();
  log(
    `已将 AI 推荐住宿填入第 ${targetDay.dayIndex} 天：${targetDay.lodging.name}`,
    'info',
  );
  scheduleAiRefresh();
}

function runReasonablenessChecks() {
  if (!dailyPlans.length) {
    log('尚未创建任何每日行程，无法检查。', 'warn');
    return;
  }

  const daysWithoutLodging = dailyPlans
    .filter((d) => !d.lodging || !d.lodging.name)
    .map((d) => d.dayIndex);

  if (daysWithoutLodging.length) {
    log(
      `以下天数未填写住宿信息：第 ${daysWithoutLodging.join(
        '、',
      )} 天。虽然前端不强制必填，但建议补充以确保每晚都有住宿安排。`,
      'warn',
    );
  } else {
    log('所有天数都填写了住宿信息 ✔', 'info');
  }

  dailyPlans.forEach((day) => {
    if (day.spotOrder.length > 6) {
      log(
        `第 ${day.dayIndex} 天安排了 ${day.spotOrder.length} 个景点，可能过于紧凑，可适当删减或拆分到其他天。`,
        'warn',
      );
    } else if (day.spotOrder.length <= 1) {
      log(
        `第 ${day.dayIndex} 天只安排了 ${
          day.spotOrder.length
        } 个景点，行程较宽松，可适当增加景点或休息时间。`,
        'info',
      );
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventHandlers();
  renderCities();
  renderSpots();
  renderDailyPlans();
  refreshCitySelects();
  refreshDaySpotSelect();
  refreshAiCitySelect();
  log('应用已初始化，可以开始添加城市和景点。', 'info');
  scheduleAiRefresh();
});

