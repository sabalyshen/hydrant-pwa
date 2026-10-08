// 消防水源地圖 PWA — 主程式
let map;
let hydrants = [];
let markers = [];
let currentFilter = new Set(); // 空 = 全部顯示

// 分隊顏色
const STATION_COLORS = {
  '大里': '#e53935',
  '仁化': '#fb8c00',
  '十九甲': '#fdd835',
  '太平': '#43a047',
  '溪湳': '#00acc1',
  '烏日': '#1e88e5',
  '霧峰': '#8e24aa',
  '車籠埔': '#d81b60',
  '中山': '#6d4c41',
};

// 地圖中心（大里區附近）
const CENTER = [24.107, 120.680];

function initMap() {
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
  }).setView(CENTER, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map);

  // 註冊 service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .catch((err) => console.log('SW 註冊失敗:', err));
  }

  loadHydrants();
}

async function loadHydrants() {
  try {
    const resp = await fetch('hydrants.json');
    hydrants = await resp.json();
    document.getElementById('stats').textContent = `共 ${hydrants.length} 支消防栓`;
    buildFilterPanel();
    buildLegend();
    renderMarkers();
  } catch (err) {
    document.getElementById('stats').textContent = '資料載入失敗';
    console.error(err);
  }
}

function buildFilterPanel() {
  const stations = [...new Set(hydrants.map((h) => h.station))];
  const list = document.getElementById('filter-list');
  list.innerHTML = '';

  // 全部按鈕
  const allChip = document.createElement('div');
  allChip.className = 'filter-chip active';
  allChip.textContent = '全部';
  allChip.onclick = () => {
    currentFilter.clear();
    updateChips();
    renderMarkers();
  };
  list.appendChild(allChip);

  stations.forEach((s) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.textContent = s;
    chip.onclick = () => {
      if (currentFilter.has(s)) {
        currentFilter.delete(s);
      } else {
        currentFilter.add(s);
      }
      // 若全選等於空
      if (currentFilter.size === stations.length) currentFilter.clear();
      updateChips();
      renderMarkers();
    };
    list.appendChild(chip);
  });
}

function updateChips() {
  const chips = document.querySelectorAll('.filter-chip');
  const stations = [...new Set(hydrants.map((h) => h.station))];
  chips.forEach((chip, i) => {
    if (i === 0) {
      chip.classList.toggle('active', currentFilter.size === 0);
    } else {
      chip.classList.toggle('active', currentFilter.has(stations[i - 1]));
    }
  });
}

function buildLegend() {
  const stations = [...new Set(hydrants.map((h) => h.station))];
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  stations.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = STATION_COLORS[s] || '#999';
    const label = document.createElement('span');
    label.textContent = s;
    item.appendChild(dot);
    item.appendChild(label);
    legend.appendChild(item);
  });
}

function renderMarkers() {
  // 清除舊 markers
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const filtered = hydrants.filter((h) => {
    if (currentFilter.size === 0) return true;
    return currentFilter.has(h.station);
  });

  const color = (s) => STATION_COLORS[s] || '#999';

  filtered.forEach((h) => {
    const marker = L.circleMarker([h.lat, h.lng], {
      radius: h.type === '地上' ? 7 : 5,
      fillColor: color(h.station),
      color: '#fff',
      weight: 1,
      fillOpacity: 0.8,
    }).addTo(map);

    marker.bindPopup(buildPopup(h));
    markers.push(marker);
  });

  document.getElementById('stats').textContent =
    `顯示 ${filtered.length} / ${hydrants.length} 支消防栓`;
}

function buildPopup(h) {
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=driving`;
  return `
    <b>消防栓 ${h.id}</b><br>
    分隊: ${h.station}<br>
    種類: ${h.type}<br>
    位置: ${h.location}<br>
    ${h.water ? '水公司: ' + h.water + '<br>' : ''}
    座標: ${h.lat.toFixed(6)}, ${h.lng.toFixed(6)}<br>
    <a class="nav-link" href="${navUrl}" target="_blank">🧭 Google 導航</a>
  `;
}

// 搜尋
function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const result = hydrants.find((h) => h.id === q || h.location.includes(q));
  if (result) {
    map.setView([result.lat, result.lng], 17);
    const marker = markers.find((m) => {
      const ll = m.getLatLng();
      return ll.lat === result.lat && ll.lng === result.lng;
    });
    if (marker) marker.openPopup();
    else {
      // 如果被篩選掉，臨時顯示
      const tmp = L.circleMarker([result.lat, result.lng], {
        radius: 10, fillColor: '#d32f2f', color: '#fff', weight: 2, fillOpacity: 1,
      }).addTo(map).bindPopup(buildPopup(result)).openPopup();
      markers.push(tmp);
    }
  } else {
    alert('找不到相符的消防栓');
  }
}

// 定位
function locateMe() {
  if (!navigator.geolocation) {
    alert('此裝置不支援定位');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 16);
      L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: '',
          html: '<div style="font-size:28px;">📍</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(map).bindPopup('我的位置').openPopup();
    },
    (err) => alert('定位失敗: ' + err.message),
    { enableHighAccuracy: true }
  );
}

// 事件綁定
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  document.getElementById('search-btn').addEventListener('click', doSearch);
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  document.getElementById('locate-btn').addEventListener('click', locateMe);
  document.getElementById('filter-toggle').addEventListener('click', () => {
    document.getElementById('filter-panel').classList.toggle('show');
  });
});
