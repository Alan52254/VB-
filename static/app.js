const socket = io();
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

let config = null;
let vehicles = [];
let selectedId = null; 
let mapScale = { x: 1, y: 1 };
let radarAngle = 0; // 雷達掃描線角度

// 時鐘更新
setInterval(() => {
    const now = new Date();
    document.getElementById('sysTime').innerText = now.toLocaleTimeString('en-GB');
}, 1000);

// --- WebSocket Events ---
socket.on('connect', () => {
    console.log(">> SYSTEM CONNECTED: UPLINK ESTABLISHED");
});

socket.on('config', (data) => {
    config = data;
    resizeCanvas();
    console.log(">> CONFIG LOADED");
});

socket.on('update', (data) => {
    vehicles = data.vehicles;
    document.getElementById('windSpeed').innerHTML = `${data.wind} <small>m/s</small>`;
    window.attractions = data.attractions || {};  // 新增這行
        // 新增：更新站點等待人數（可選）
    if (data.stations) {
        window.currentStations = data.stations;
    }
    updateSidebar();
    draw(); // 讓車子即時更新位置
});

// --- Render Loop (60FPS) ---
// 將繪圖與數據更新分離，保證動畫流暢
function animate() {
    draw();
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// --- Drawing Logic ---

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    // 重新計算縮放 (基於 1400x900 設計稿)
    mapScale.x = canvas.width / 1400;
    mapScale.y = canvas.height / 900;
}

window.addEventListener('resize', resizeCanvas);

function draw() {
    if (!config) return;

    // 1. 清空並畫背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. 繪製地圖 (金門輪廓)
    drawKinmenMap();

    // 3. 繪製雷達掃描效果 (Radar Scan)
    drawRadarScan();

    // 4. 繪製路線
    drawTrack();

    // 5. 繪製站點
    config.stations.forEach(s => {
        const x = s.x * mapScale.x;
        const y = s.y * mapScale.y;
        const isSelected = selectedId === `s-${s.id}`;
        
        // 站點光暈
        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = s.type === 'hub' ? '#00f3ff' : '#00ff9d';
        ctx.shadowBlur = isSelected ? 20 : 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // 站名
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.font = '12px "Rajdhani"';
        ctx.fillText(s.name, x + 15, y + 4);
    });

    // 6. 繪製車輛
    vehicles.forEach(v => {
        const pos = getPosFromProgress(v.progress);
        drawVehicle(pos.x, pos.y, pos.angle, v);
    });
}

function drawRadarScan() {
    radarAngle += 0.02;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.max(canvas.width, canvas.height);

    const grad = ctx.createConicGradient(radarAngle, cx, cy);
    grad.addColorStop(0, 'rgba(0, 243, 255, 0)');
    grad.addColorStop(0.1, 'rgba(0, 243, 255, 0.05)');
    grad.addColorStop(1, 'rgba(0, 243, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawKinmenMap() {
    const points = [
        [200, 200], [400, 150], [800, 100], [1000, 80], [1200, 150],
        [1250, 300], [1100, 400], [800, 450], [600, 600], [300, 700],
        [150, 600], [100, 400]
    ];
    
    ctx.beginPath();
    ctx.moveTo(points[0][0] * mapScale.x, points[0][1] * mapScale.y);
    points.forEach(p => ctx.lineTo(p[0] * mapScale.x, p[1] * mapScale.y));
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawTrack() {
    if (config.stations.length < 2) return;
    
    ctx.beginPath();
    config.stations.forEach((s, i) => {
        const x = s.x * mapScale.x;
        const y = s.y * mapScale.y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    // Close loop
    const first = config.stations[0];
    ctx.lineTo(first.x * mapScale.x, first.y * mapScale.y);
    
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawVehicle(x, y, angle, v) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    const isSelected = selectedId === `v-${v.id}`;

    // 特效：跟車模式發光
    if (v.action === "PLATOON_ACCEL") {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00ff9d";
    } else if (isSelected) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#fff";
        // 選中框
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(-15, -10, 30, 20);
    }

    // 車體：未來感箭頭
    ctx.fillStyle = v.soc < 20 ? '#ff0055' : (v.action === "PLATOON_ACCEL" ? '#00ff9d' : '#00f3ff');
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -7);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

function getPosFromProgress(prog) {
    const total = config.stations.length;
    const p = prog * total; 
    const idx = Math.floor(p) % total;
    const nextIdx = (idx + 1) % total;
    const t = p - Math.floor(p);
    
    const s1 = config.stations[idx];
    const s2 = config.stations[nextIdx];
    
    const x = (s1.x + (s2.x - s1.x) * t) * mapScale.x;
    const y = (s1.y + (s2.y - s1.y) * t) * mapScale.y;
    const angle = Math.atan2(s2.y - s1.y, s2.x - s1.x);
    
    return { x, y, angle };
}

// --- UI Logic ---

function updateSidebar() {
    const list = document.getElementById('vehicleList');
    // 為了效能，只更新內容而不完全重繪，或者簡單重繪
    // 這裡採用重繪方式，但為了防止閃爍，可以檢查滑鼠狀態 (進階做法略)
    list.innerHTML = '';
    
    vehicles.forEach(v => {
        const div = document.createElement('div');
        div.className = `v-card ${selectedId === `v-${v.id}` ? 'active' : ''}`;
        
        // 決定狀態顏色
        let statusColor = '#00f3ff'; // Blue
        if (v.action === 'PLATOON_ACCEL') statusColor = '#00ff9d'; // Green
        if (v.soc < 20) statusColor = '#ff0055'; // Red

        div.innerHTML = `
            <div class="v-header">
                <span class="v-id">UNIT-${v.id}</span>
                <span class="v-soc-box" style="color:${statusColor}">
                    ${v.soc}% <i class="fa-solid fa-bolt"></i>
                </span>
            </div>
            <div class="v-bars">
                <div class="bar-bg"><div class="bar-fill" style="width:${v.soc}%; background:${statusColor}"></div></div>
            </div>
            <div class="v-footer">
                <span>${v.action}</span>
                <span>${v.speed} KM/H</span>
            </div>
        `;
        div.onclick = () => showVehicleInfo(v);
        list.appendChild(div);
    });

    // 如果目前有選中物件，即時更新卡片數值 (若需)
    if (selectedId && selectedId.startsWith('v-')) {
        const vid = parseInt(selectedId.split('-')[1]);
        const v = vehicles.find(veh => veh.id === vid);
        if (v) updateInfoCardContent(v.id, "VEHICLE", v.action, v.speed + " km/h");
    }
}

function showVehicleInfo(v) {
    selectedId = `v-${v.id}`;
    const card = document.getElementById('infoCard');
    card.classList.remove('hidden');
    
    document.getElementById('cardImg').src = "https://placehold.co/600x400/000/00f3ff?text=UNIT+TELEMETRY";
    document.getElementById('cardTitle').innerText = `UNIT-${v.id}`;
    document.getElementById('cardStat1').innerText = "EV-SHUTTLE";
    updateInfoCardContent(v.id, "VEHICLE", v.action, v.speed + " km/h");
}

function updateInfoCardContent(id, type, line1, line2) {
    document.getElementById('cardDesc').innerHTML = `
        <span style="color:#aaa">CURRENT TASK:</span><br>
        <span style="color:#fff; font-size:1.1em">${line1}</span>
    `;
    document.getElementById('cardStat2').innerText = line2;
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    let clicked = false;
    
    // 優先檢查站點
    config.stations.forEach(s => {
        const sx = s.x * mapScale.x;
        const sy = s.y * mapScale.y;
        if (Math.hypot(sx - mx, sy - my) < 20) {
            selectedId = `s-${s.id}`;
            showStationInfo(s);
            clicked = true;
        }
    });

    // 其次檢查車輛 (若未點到站點)
    if (!clicked) {
        vehicles.forEach(v => {
            const pos = getPosFromProgress(v.progress);
            if (Math.hypot(pos.x - mx, pos.y - my) < 20) {
                selectedId = `v-${v.id}`;
                showVehicleInfo(v);
                clicked = true;
            }
        });
    }
    
    if (!clicked) {
        selectedId = null;
        document.getElementById('infoCard').classList.add('hidden');
    }
});


function showStationInfo(s) {
    const attr = window.attractions[s.id] || {};
    const stationData = window.currentStations.find(st => st.id === s.id);
    
    document.getElementById('infoCard').classList.remove('hidden');
    document.getElementById('cardImg').src = attr.img || "https://placehold.co/600x400/000/00f3ff?text=STATION";
    document.getElementById('cardTitle').innerText = attr.name || s.name;
    document.getElementById('cardDesc').innerHTML = `<p style="line-height:1.7">${attr.desc || '金門重要景點'}</p>`;
    document.getElementById('cardStat2').innerText = `排隊：${stationData?.waiting || 0} 人`;
}