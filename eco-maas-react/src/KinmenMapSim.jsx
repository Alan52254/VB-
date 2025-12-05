/**
 * ====================================================================================================
 * 專案名稱：Eco-MaaS 金門低碳島智慧觀光車隊數位孿生系統 (Digital Twin System)
 * 檔案名稱：KinmenMapSim.jsx
 * 模組功能：核心場域模擬器 (Core Simulation Engine & Visualization)
 * * * [版本資訊]
 * Version: v4.5.0 (Competition Final Release - High Doc)
 * Date: 2025/11/22
 * Author: Eco-MaaS Team (Alan & Henry)
 * * * [模組職責]
 * 本元件是整個系統的「物理引擎 (Physics Engine)」與「視覺化核心 (Visualizer)」。
 * 它並不只是單純的 UI 展示，而是包含了一個完整的時間步進模擬器 (Time-Stepping Simulator)。
 * * * 1. 環境模擬 (Environment):
 * - 模擬金門真實地理環境，使用 SVG Path 擬合環島北路、環島南路與太武山路段。
 * - 模擬客流生成 (Passenger Generation)，根據尖峰/離峰與景點熱門度隨機產生乘客。
 * * * 2. 物理模擬 (Physics):
 * - 車輛動力學：計算功率 (kW) = 阻力 * 速度。
 * - 空氣動力學：計算風阻係數 (Cd)，模擬「車隊跟車 (Platooning)」時的減阻效應 (0.8 -> 0.4)。
 * - 電力系統：模擬電池充放電 (SoC)，包含行駛耗能與場站快充。
 * * * 3. 代理人行為 (Agent Behavior):
 * - 實作 Baseline (規則基礎) 與 RL Agent (強化學習) 兩種決策模式。
 * - 決策包含：派車/停駛、巡航/加速、充電/服務。
 * * * 4. 資料串流 (Data Streaming):
 * - 透過 useRef 解決 React 閉包陷阱，確保 Game Loop 讀取最新狀態。
 * - 透過 onSimulationUpdate callback，以 1Hz 頻率將全域 Snapshot 廣播給父元件 (IntegratedPlatform)。
 * * * [資料流架構]
 * Local State (UI Update) <-> useRef (Logic Update) -> Interval Loop -> onSimulationUpdate -> Dashboard
 * ====================================================================================================
 */

import React, { useState, useEffect, useRef } from 'react';

// --- 外部圖示庫 (Lucide React) ---
// 用於地圖標記、儀表板圖示、按鈕控制、狀態指示等
import {
  Wind,             // 風阻/氣流 (代表 Platooning 狀態)
  Zap,              // 電力/功率 (代表能耗與充電)
  Users,            // 乘客/人流 (代表負載)
  Battery,          // 電池 (一般狀態)
  BatteryCharging,  // 電池 (充電中)
  BarChart3,        // 圖表 (KPI 面板)
  Play,             // 播放控制
  Pause,            // 暫停控制
  RotateCcw,        // 重置模擬
  MapPin,           // 地圖圖釘
  Gauge,            // 速度表
  History,          // 歷史紀錄/日誌
  Cpu,              // AI 核心 (代表 Agent)
  X,                // 關閉按鈕
  BusFront,         // 巴士圖示 (一般狀態)
  
  // --- 👇 針對金門景點新增的專屬圖示 ---
  Anchor,           // 港口/碼頭 (翟山坑道)
  Plane,            // 機場 (尚義機場)
  Mountain,         // 山脈 (太武山)
  Castle,           // 古蹟/洋樓 (陳景蘭洋樓)
  Flag,             // 地標 (莒光樓)
  Home,             // 聚落 (山后民俗村)
  Warehouse,        // 總站/倉庫 (金城總站)
  Activity,         // 活動/狀態
  Signal,           // 訊號/連線
  Leaf,             // 環保/ESG
  ToggleLeft,       // 切換開關 (未使用)
  ToggleRight,      // 切換開關 (未使用)
  Sun,              // 太陽 (白天/太陽能發電)
  Moon,             // 月亮 (夜晚/離峰充電)
  DollarSign,       // 💰 電價 (動態定價)
  Cloud             // ☁️ 陰天/一般狀態
} from 'lucide-react';

// --- 圖表庫 (Recharts) ---
// 用於繪製右側面板的即時能耗趨勢圖與電量變化
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Line, 
  ComposedChart 
} from 'recharts';

/**
 * ============================================================================
 * SECTION 1: 全局常數與配置 (Global Configuration)
 * 設定模擬器的物理邊界、距離參數與地圖節點資料
 * ============================================================================
 */

// 邏輯畫布大小 (Logical Canvas Size)
// 所有的車輛座標 (x, y) 與 SVG 路徑都基於此比例設計。
// CSS 會處理響應式縮放，但在邏輯層我們使用固定的 800x500 座標系。
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 500;

// 組隊觸發距離 (Platooning Threshold)
// 單位：像素 (Pixels)
// 當後車距離前車小於此數值時，視為進入「尾流區 (Wake Zone)」，觸發減阻效應。
const PLATOON_DISTANCE = 70;

/**
 * 金門景點資料庫 (Location Database)
 * 包含座標、類型、觀光描述、代表色、熱門度權重。
 * * [座標設計邏輯]
 * 以 (0,0) 為左上角：
 * - 金城 (Depot): 西南側核心 (120, 280)
 * - 機場 (Airport): 中部交通樞紐 (450, 350)
 * - 馬山 (Mashan): 東北角 (620, 50)
 * - 翟山 (Zhaishan): 最南端 (130, 450)
 */
const LOCATIONS = [
  { 
    id: 'depot', 
    name: '金城總站', 
    x: 120, y: 280, 
    type: 'depot', 
    desc: '全島交通核心與調度中心，設有 120kW 快速充電樁與運維中心。', 
    color: '#eab308', // 黃色 (Hub)
    popularity: 0.2   // 轉運站，自然客流較少，多為轉乘
  },
  { 
    id: 'juguang', 
    name: '莒光樓', 
    x: 160, y: 360, 
    type: 'stop', 
    desc: '金門戰地精神象徵，登樓可眺望廈門夜景，為必訪觀光地標。', 
    color: '#ef4444', // 紅色 (Landmark)
    popularity: 0.9   // 超高熱門度
  },
  { 
    id: 'zhaishan', 
    name: '翟山坑道', 
    x: 130, y: 450, 
    type: 'stop', 
    desc: 'A字型戰備水道，花崗岩開鑿的鬼斧神工，每年舉辦坑道音樂節。', 
    color: '#6366f1', // 靛色 (Water/Military)
    popularity: 0.7 
  },
  { 
    id: 'chenggong', 
    name: '陳景蘭洋樓', 
    x: 380, y: 440, 
    type: 'stop', 
    desc: '金門規模最大洋樓，純白系建築與成功海灘相連，網美打卡熱點。', 
    color: '#ec4899', // 粉色 (History/Beauty)
    popularity: 0.6 
  },
  { 
    id: 'airport', 
    name: '尚義機場', 
    x: 450, y: 350, 
    type: 'stop', 
    desc: '金門對外交通門戶，人流吞吐量最高，設有旅客服務中心。', 
    color: '#3b82f6', // 藍色 (Transport)
    popularity: 1.0   // 最高人流權重
  },
  { 
    id: 'taiwu', 
    name: '太武山', 
    x: 600, y: 250, 
    type: 'stop', 
    desc: '金門最高峰，「毋忘在莒」勒石所在地。此路段坡度陡峭，耗能極高。', 
    color: '#22c55e', // 綠色 (Mountain)
    popularity: 0.8 
  },
  { 
    id: 'shanhou', 
    name: '山后民俗村', 
    x: 720, y: 120, 
    type: 'stop', 
    desc: '保存最完整的閩南二落大厝聚落，展現傳統燕尾脊建築之美。', 
    color: '#f97316', // 橘色 (Culture)
    popularity: 0.5 
  },
  { 
    id: 'mashan', 
    name: '馬山觀測所', 
    x: 620, y: 50, 
    type: 'stop', 
    desc: '金門本島距離大陸最近的據點，號稱「天下第一哨」。', 
    color: '#a855f7', // 紫色 (Military/Signal)
    popularity: 0.6 
  },
  { 
    id: 'guningtou', 
    name: '古寧頭', 
    x: 100, y: 80, 
    type: 'stop', 
    desc: '古寧頭戰役紀念館，見證歷史的關鍵戰場遺跡。', 
    color: '#94a3b8', // 灰色 (History/War)
    popularity: 0.5 
  }
];

/**
 * 區域映射表 (Zone Mapping)
 * 將 9 個物理站點歸納為邏輯生活圈，用於 Dashboard 的區域分析。
 * 這有助於大腦 (Brain) 進行分區調度。
 */
const ZONE_MAPPING = {
  'depot': '金城車站',      // 總站當然在金城
  'juguang': '金城車站',    // 莒光樓離金城很近
  'zhaishan': '水頭碼頭',   // 翟山坑道在西南方，歸類給水頭生活圈
  'chenggong': '山外車站',  // 陳景蘭洋樓在金湖，歸給山外
  'shanhou': '山外車站',    // 山后民俗村在金沙，併入東半島(山外)電網
  'mashan': '山外車站',     // 馬山在最北，併入東半島(山外)電網
  'airport': '金門機場',    // 獨立區域 (交通樞紐)
  'taiwu': '太武山',        // 獨立區域 (高耗能區)
  'guningtou': '古寧頭'      // 獨立區域 (西北角)
};

/**
 * 站點圖示設定 (Icon Config)
 * 為每個站點指定專屬的 Lucide Icon 與顏色，增強地圖的可讀性與美觀度。
 */
const STATION_CONFIG = {
  // 👇 1. 金城總站：主充電站 (樞紐)
  'depot':     { icon: Warehouse, color: '#fbbf24', label: '總站', hasCharger: true },
  'juguang':   { icon: Flag,      color: '#f87171', label: '地標' },
  'zhaishan':  { icon: Anchor,    color: '#60a5fa', label: '坑道' },
  'chenggong': { icon: Castle,    color: '#f472b6', label: '洋樓' },
  // 👇 2. 尚義機場：交通樞紐充電站
  'airport':   { icon: Plane,     color: '#38bdf8', label: '機場', hasCharger: true },
  'taiwu':     { icon: Mountain,  color: '#4ade80', label: '登山' },
  // 👇 3. 山后民俗村：東半島充電節點 (平衡電網)
  'shanhou':   { icon: Home,      color: '#fb923c', label: '聚落', hasCharger: true },
  'mashan':    { icon: Zap,       color: '#a78bfa', label: '觀測' },
  'guningtou': { icon: History,   color: '#94a3b8', label: '戰史' },
};

/**
 * SVG 路線路徑 (Road Path)
 * 使用 Cubic Bezier (Q) 指令模擬金門環島公路的真實彎曲度，而非死板的直線。
 * * M: Move to (起點)
 * Q: Quadratic Bézier curve (控制點, 終點)
 * L: Line to (直線)
 * * * 路徑順序：
 * 金城 -> 莒光樓 -> 翟山 -> 陳景蘭 -> 機場 -> 太武山 -> 山后 -> 馬山 -> 古寧頭 -> 金城
 */
const ROAD_PATH_SVG = `
  M 120,280 
  Q 140,330 160,360 
  L 130,450 
  Q 250,460 380,440 
  L 450,350 
  Q 520,300 600,250 
  L 720,120 
  L 620,50 
  Q 300,20 100,80 
  L 120,280
`;

// 邏輯路線序列 (Route Sequence)
// 用於計算車輛在路網上的相對位置插值 (Linear Interpolation)
const ROUTE_SEQUENCE = [
  'depot', 'juguang', 'zhaishan', 'chenggong', 'airport', 
  'taiwu', 'shanhou', 'mashan', 'guningtou', 'depot'
];

/**
 * 輔助函式：根據 ID 獲取站點物件
 * @param {string} id - 站點 ID
 * @returns {object} 站點物件 (包含 x, y, name 等)
 */
const getLoc = (id) => LOCATIONS.find(l => l.id === id);

/**
 * 輔助函式：計算兩點間的歐幾里得距離
 * 用於判斷車輛是否進入 Platooning 範圍，或是否到達站點
 * @param {object} p1 - 點 1 {x, y}
 * @param {object} p2 - 點 2 {x, y}
 * @returns {number} 距離 (pixels)
 */
const calcDist = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

/**
 * ============================================================================
 * SECTION 2: 樣式系統 (CSS-in-JS Style System)
 * 定義所有 UI 元件的樣式，支援 RWD 與深色模式 (Dark Mode)
 * ============================================================================
 */
const styles = {
  // 1. 主容器 (全螢幕、深色背景)
  container: { 
    backgroundColor: '#0f172a', // Slate 900 (深藍黑)
    color: '#e2e8f0',           // Slate 200 (淺灰白)
    height: '100%', 
    overflowY: 'auto', 
    fontFamily: '"Noto Sans TC", sans-serif', 
    padding: '20px', 
    width: '100%' 
  },

  // 2. 標題列 (Header)
  // 將控制按鈕靠右對齊，保持畫面整潔
  header: { 
    display: 'flex', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    marginBottom: '10px', 
    gap: '10px' 
  },

  // 3. 網格佈局 (Main Layout)
  // 自動適應寬度 (Responsive Grid)，確保在大螢幕上並排，小螢幕自動堆疊
  mainLayout: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
    gap: '20px', 
    maxWidth: '1600px', 
    margin: '0 auto' 
  },

  // 4. 左側地圖區 (Map Section)
  // 核心視覺區塊，顯示 SVG 地圖與移動車輛
  mapSection: { 
    gridColumn: 'span 2', // 預設佔據 2 欄寬度
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: '16px', 
    border: '1px solid #334155', 
    position: 'relative', 
    aspectRatio: '800/500', // 固定長寬比，確保 SVG 地圖不變形
    overflow: 'hidden', 
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)' // 深邃陰影
  },

  // 5. 右側面板 (Side Panel)
  // 放置儀表板、KPI 與日誌
  sidePanel: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '15px', 
    gridColumn: 'span 1' 
  },

  // 6. 通用卡片 (Card)
  // 系統中所有小模組的基礎樣式
  card: { 
    backgroundColor: '#1e293b', 
    padding: '15px', 
    borderRadius: '12px', 
    border: '1px solid #334155', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
  },

  // 7. KPI 網格 (KPI Grid)
  // 用於排列 2x2 的數據方塊
  kpiGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '10px', 
    marginTop: '10px' 
  },

  // KPI 單項方塊
  kpiBox: { 
    backgroundColor: 'rgba(15, 23, 42, 0.6)', 
    padding: '8px', 
    borderRadius: '8px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    textAlign: 'center' 
  },

  // 8. 控制按鈕 (Control Button)
  // 播放、暫停、重置按鈕的樣式
  controlBtn: { 
    border: 'none', 
    borderRadius: '8px', 
    width: 'auto', 
    padding: '6px 12px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: 'white', 
    cursor: 'pointer', 
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)', 
    transition: 'all 0.2s', 
    fontSize: '0.8rem', 
    fontWeight: 'bold' 
  },

  // 9. 車輛地圖標記 (Vehicle Marker)
  // 包含移動動畫 transition
  vehicleMarker: { 
    position: 'absolute', 
    transform: 'translate(-50%, -50%)', 
    transition: 'all 0.1s linear', // 平滑移動關鍵：線性動畫
    zIndex: 20, 
    cursor: 'pointer' 
  },

  // 10. 景點大字卡 (Feature Card)
  // 點擊站點時彈出的半透明玻璃卡片
  spotCard: { 
    position: 'absolute', 
    bottom: '20px', 
    left: '20px', 
    width: '260px', 
    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
    padding: '15px', 
    borderRadius: '12px', 
    border: '1px solid #475569', 
    backdropFilter: 'blur(5px)', // 毛玻璃效果
    zIndex: 50, 
    animation: 'slideUp 0.3s ease-out', 
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)' 
  },

  // 11. 圖表容器
  chartWrapper: { 
    width: '100%', 
    height: '180px' 
  },

  // 12. 日誌區塊
  logBox: { 
    height: '120px', 
    overflowY: 'auto', 
    fontSize: '0.75rem', 
    color: '#94a3b8', 
    borderTop: '1px solid #334155', 
    marginTop: '10px', 
    paddingTop: '10px', 
    fontFamily: 'monospace' // 等寬字體，適合顯示 Log
  }
};

/**
 * ============================================================================
 * SECTION 3: 主元件定義 (KinmenMapSim Component)
 * ============================================================================
 */
const KinmenMapSim = ({ onSimulationUpdate, isRunningExternal }) => {
  
  // --- 3.1 State 定義 (React Hooks) ---
  
  // 1. 車輛狀態列表 (Vehicles)
  // 包含位置(x,y)、電量(battery)、載客數(passengers)、物理參數(dragCoeff, power)
  const [vehicles, setVehicles] = useState([]);
  
  // 2. 站點狀態列表 (Stations)
  // 包含排隊人數(queue)、累積服務數(totalServed)、站點資訊
  const [stations, setStations] = useState([]);
  
  // 3. 模擬時間 (Game Time)
  // 單位：分鐘，從 08:00 (480 mins) 開始
  const [gameTime, setGameTime] = useState(480);
  
  // 4. 運行狀態 (Run State)
  // 由外部 Props (IntegratedPlatform) 控制啟動/暫停
  const isRunning = isRunningExternal !== undefined ? isRunningExternal : false;
  
  // 5. 互動狀態 (Interaction)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null); // 當前選中的車輛 ID
  const [activeSpot, setActiveSpot] = useState(null);             // 當前顯示的景點卡片資料
  
  // 6. 歷史數據 (History)
  // 用於繪製右側的 Recharts 趨勢圖
  const [statsHistory, setStatsHistory] = useState([]);
  
  // 7. 系統日誌 (System Logs)
  // 儲存 AI 決策與系統事件
  const [logs, setLogs] = useState([]);
  
  // 8. 模式選擇 (Mode)
  // 'baseline': 固定班表 (無組隊)
  // 'rl': 強化學習 Agent (有組隊、動態調度)
  const [mode, setMode] = useState('rl'); 
  
  // 9. 全局 KPI 統計 (Global Metrics)
  const [metrics, setMetrics] = useState({ 
    totalEnergy: 0,   // 總耗能 (kWh)
    totalServed: 0,   // 總服務人次
    totalDist: 0,     // 總行駛里程
    platoonDist: 0,   // 組隊里程 (Platooning Distance)
    emptyDist: 0,     // 空車里程 (Empty Distance)
    totalWaitTime: 0  // 總等待時間 (人*分)
  });

  // --- 3.2 Ref 與閉包處理解決方案 ---
  // [技術說明]
  // 由於 setInterval 閉包會鎖住初始 state，導致 updateGameLogic 讀不到最新數據。
  // 我們使用 useRef (latestDataRef) 來儲存最新的 State Snapshot。
  // 每次 render 時透過 useEffect 更新 Ref，Game Loop 再從 Ref 讀取最新值。
  const latestDataRef = useRef({ vehicles: [], gameTime: 0, metrics: {}, stations: [], mode: 'rl', logs: [] });

  // ⚡ 新增：專門用來解決「閉包陷阱」的能耗累加器
  const energyAccumulatorRef = useRef({ total: 0, baseline: 0 });

  // 監聽 State 變化，同步更新 Ref
  useEffect(() => {
    latestDataRef.current = { vehicles, gameTime, metrics, stations, mode, logs }; // 🔥 把 logs 加進去
  }, [vehicles, gameTime, metrics, stations, mode, logs]);

  // --- 3.3 初始化 (Initialization) ---
  // 元件掛載時，執行一次重置
  useEffect(() => { 
    resetSimulation(); 
  }, []);

  // --- 3.4 數據流輸出 (Data Broadcasting) ---
  // 這是 Producer-Consumer 架構的關鍵：
  // MapSim (Producer) 每秒鐘將當前狀態打包 (Snapshot)，傳送給父元件 (IntegratedPlatform)。
  useEffect(() => {
    if (!onSimulationUpdate) return;
    
    // 建立 1Hz 的廣播迴圈
    const interval = setInterval(() => {
      // 從 Ref 讀取最新狀態 (Single Source of Truth)
      const { vehicles, gameTime, metrics, stations } = latestDataRef.current;

      // 1. 車輛數據映射 (Mapping)
      // 將內部物理狀態轉換為 UI 顯示用的格式
      const mappedVehicles = vehicles.map(v => {
        // [邏輯] 尋找最近的站點，判定當前所處的 Zone
        let nearestLoc = LOCATIONS[0];
        let minDistance = 99999;

        LOCATIONS.forEach(loc => {
          const dist = Math.sqrt(Math.pow(v.x - loc.x, 2) + Math.pow(v.y - loc.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            nearestLoc = loc;
          }
        });

        const detectedZone = ZONE_MAPPING[nearestLoc.id] || "移動中";

        return {
          id: `Bus-${v.id}`,
          zone: detectedZone,
          soc: v.battery,
          status: v.status === 'moving'
            ? (v.passengers > 0 ? 'Service' : 'Idle')
            : 'Charging',
          passengers: v.passengers
        };
      });

      // 2. 站點數據映射
      // 計算每個站點的即時狀態
      const mappedStations = stations.map(s => {
        // 計算該站點 50px 範圍內的車輛數 (判定是否擁擠)
        const busCount = vehicles.filter(v => {
          const dist = Math.sqrt(Math.pow(v.x - s.x, 2) + Math.pow(v.y - s.y, 2));
          return dist < 50;
        }).length;

        return {
          id: s.id,
          name: s.name,
          waitingCount: s.queue,
          totalServed: s.totalServed || 0,
          currentBusCount: busCount,
          status: s.queue > 10 ? 'CROWDED' : 'NORMAL'
        };
      });

      // 3. 執行回調，將數據發送出去
      onSimulationUpdate({
        vehicles: mappedVehicles,
        stations: mappedStations,
        gameTime,
        metrics,
        logs: latestDataRef.current.logs // 🔥 傳送日誌給父層
      });
    }, 1000); // 1Hz 更新頻率

    return () => clearInterval(interval);
  }, [onSimulationUpdate]);

  /**
   * ============================================================================
   * SECTION 4: 核心邏輯函式 (Core Logic Functions)
   * 包含重置、時間格式化、日誌記錄、AI 決策、物理引擎更新
   * ============================================================================
   */

  /**
   * [功能] 重置模擬器狀態 (Reset Simulation)
   * 將所有車輛歸位、清空數據、初始化站點。
   * 這是最重要的初始化函式，確保所有變數回到起點。
   */
  const resetSimulation = () => {
    // 1. 建立 6 台初始車輛
    const newVehicles = Array.from({ length: 6 }).map((_, i) => ({
      id: i, 
      x: 120, y: 280, // 起始點 (金城總站)
      progress: i * 0.6, // 錯開進度，避免重疊
      battery: 95 - (i * 5), // 錯開電量，模擬真實差異
      status: 'moving', 
      speed: 0, 
      passengers: 0, 
      capacity: 20, 
      dragCoeff: 0.8, // 初始風阻係數 (Solo)
      power: 0, 
      platooning: false, 
      totalDist: 0, 
      aiState: 'INIT', 
      boardedLast: 0, // 上次上車人數 (UI 顯示用)
      alightedLast: 0 // 上次下車人數 (UI 顯示用)
    }));
    setVehicles(newVehicles);

    // 2. 初始化站點 (Stations)
    // 🔥 重要修正：必須先建立 initialStations 物件，才能同步給 Ref
    const initialStations = LOCATIONS.map(loc => ({ ...loc, queue: 0, totalServed: 0 }));
    setStations(initialStations);
    
    // 🔥 [關鍵修復]: 同步更新 Ref，確保 Dashboard 初始化時能收到正確的站點列表
    // 解決 "Cannot read properties of undefined" 或 Dashboard 空白的問題
    latestDataRef.current.stations = initialStations; 

    // 3. 重置其他狀態
    setGameTime(480); // 08:00
    setStatsHistory([]);
    setLogs([]);
    setMetrics({
      totalEnergy: 0,
      totalEnergyBaseline: 0, // 🔥 新增：Baseline 对照组耗能
      totalServed: 0,
      totalDist: 0,
      platoonDist: 0,
      emptyDist: 0,
      totalWaitTime: 0,
      // 🔥 新增：電網狀態資訊
      gridInfo: {
        solar: 0,    // 太陽能發電 (0-100%)
        load: 50,    // 電網負載 (0-100%)
        price: 2.5,  // 即時電價
        status: 'NORMAL' // 狀態：GREEN, NORMAL, PEAK
      }
    });

    // 🔥 加入這行：重置累加器
    energyAccumulatorRef.current = { total: 0, baseline: 0 };

    setSelectedVehicleId(null);
    setActiveSpot(getLoc('depot')); // 預設顯示總站卡片

    addLog("SYSTEM", "系統初始化完成。RL Agent 準備就緒。");
  };

  // 輔助函式：寫入日誌（結構化版本）
  const addLog = (category, msg) => {
    const timeStr = formatTime(latestDataRef.current.gameTime); // 確保拿到最新時間
    const newLog = {
      id: Date.now() + Math.random(), // 簡單的 unique id
      time: timeStr,
      category: category, // 'SYSTEM', 'AI', 'WARN'
      message: msg
    };

    setLogs(prev => [newLog, ...prev].slice(0, 10)); // 只保留最近 10 筆
  };

  // 輔助函式：格式化時間 (分鐘 -> HH:MM)
  const formatTime = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // --- Game Loop Trigger ---
  // 這是驅動整個模擬的心臟
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => { updateGameLogic(); }, 50); // 20Hz (每 50ms 更新一次)
    return () => clearInterval(interval);
  }, [isRunning]); // 🔥 只依賴 isRunning，避免無限重啟

  // --- 自動切換景點卡片 Effect ---
  // 當選中的車輛到達某個站點時，自動顯示該站點的資訊卡
  useEffect(() => {
    if (selectedVehicleId === null) return;

    const targetVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!targetVehicle) return;

    const routeLen = ROUTE_SEQUENCE.length;
    // 判斷車輛是否接近整數進度 (即站點位置)
    const distToStop = Math.abs(targetVehicle.progress - Math.round(targetVehicle.progress));

    if (distToStop < 0.1) {
      const currentStopIndex = Math.round(targetVehicle.progress) % routeLen;
      const currentStopId = ROUTE_SEQUENCE[currentStopIndex];
      const stopLocation = getLoc(currentStopId);
      
      // 如果車輛剛好到站，且當前顯示的卡片不是這站，則切換
      if (activeSpot?.id !== stopLocation?.id) {
        setActiveSpot(stopLocation);
      }
    }
  }, [vehicles, selectedVehicleId, activeSpot]);

  /**
   * [核心] 遊戲邏輯更新函式 (Update Game Logic)
   * 這是整個模擬器最複雜的函式，包含所有物理與決策邏輯。
   * * 執行步驟：
   * 1. 環境生成 (Environment): 時間推進、客流產生。
   * 2. 車輛物理 (Physics): 計算每台車的移動、充電、風阻、能耗。
   * 3. 乘客互動 (Interaction): 處理上下車邏輯、更新排隊人數。
   * 4. 統計更新 (Analytics): 累積 KPI、寫入歷史圖表。
   */
  const updateGameLogic = () => {
    // 從 Ref 讀取當前狀態
    const {
      vehicles: currentVehicles,
      gameTime: currentGameTime,
      stations: currentStations,
      mode: currentMode
    } = latestDataRef.current;

    // 1. 時間推進
    const newTime = currentGameTime + 0.5; // 每個 tick 增加 0.5 分鐘
    setGameTime(newTime);

    // --- ⚡ 微電網物理模型 (Microgrid Physics) ---
    // 1. 計算太陽能發電強度 (Solar Intensity): 鐘型曲線，中午 12 點最強
    const hourOfDay = (newTime / 60) % 24;
    // 簡單模擬：6點~18點有太陽，強度用 Sin 波模擬
    const solarOutput = (hourOfDay > 6 && hourOfDay < 18)
      ? Math.sin(((hourOfDay - 6) / 12) * Math.PI) * 100 // 0 ~ 100%
      : 0;

    // 2. 計算基礎負載 (Base Load): 雙峰曲線 (早上上班、晚上回家)
    // 使用兩個 Sin 波疊加模擬
    const baseLoad = 50
      + 20 * Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI) // 日間活動
      + 30 * Math.exp(-Math.pow(hourOfDay - 19, 2) / 4);    // 晚間尖峰 (19:00)

    // 3. 計算淨負載 (Net Load) = 需求 - 綠能
    // 這會形成「鴨子曲線」：中午負載反而低
    const netLoad = Math.max(20, baseLoad - (solarOutput * 0.6));

    // 4. 動態定價 (Dynamic Pricing)
    // 負載越高，電價越貴；綠能越多，電價越便宜
    let gridPrice = 2.5; // 基礎電價
    let gridStatusValue = 'NORMAL'; // 狀態：GREEN, NORMAL, PEAK

    if (netLoad < 40) {
      gridPrice = 1.8; // 綠能過剩，便宜！
      gridStatusValue = 'GREEN';
    } else if (netLoad > 80) {
      gridPrice = 6.5; // 尖峰負載，超貴！
      gridStatusValue = 'PEAK';
    } else {
      gridPrice = 3.0;
      gridStatusValue = 'NORMAL';
    }

    // --- 🛑 優化後的乘客生成邏輯 (Traffic Flow Control) ---

    // 1. 計算當前是幾點鐘 (假設 gameTime 是分鐘數，從 0 開始)
    // gameTime 480 = 早上 8:00
    const currentHour = Math.floor((newTime / 60) % 24);

    // 2. 定義尖峰時刻 (Morning: 7-9, Evening: 17-19)
    const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);

    // 3. 基礎生成率：尖峰時段較快，離峰很慢
    // 之前是 0.2 (每秒判定多次)，現在改成極低機率
    const spawnRate = isRushHour ? 0.03 : 0.005;

    // 4. 定義站點人氣權重 (Popularity Weights)
    const STATION_WEIGHTS = {
      'airport': 2.0,   // 機場人最多
      'depot': 1.5,     // 總站次之
      'mashan': 0.8,    // 觀測所人少
      'taiwu': 0.5,     // 山上人更少
      'default': 1.0
    };

    if (Math.random() < spawnRate) {
      setStations(prev => prev.map(s => {
        if (s.type === 'depot') return s; // 總站通常是終點，產生乘客邏輯可不同，這邊先跳過

        const weight = STATION_WEIGHTS[s.id] || STATION_WEIGHTS['default'];

        // 5. 雙重骰子：全域機率過關後，還要看該站點的權重
        if (Math.random() < s.popularity * weight) {
           // 6. 硬上限：超過 30 人就不再排了 (模擬乘客流失)
           if (s.queue < 30) {
             return { ...s, queue: s.queue + 1 };
           }
        }
        return s;
      }));
    }

    // 暫存本輪迴的累計數據 (用於 KPI 計算)
    let cycleEnergy = 0, cycleDist = 0, cyclePlatoon = 0, cycleEmpty = 0, cycleServed = 0;
    let cycleEnergyBaseline = 0; // 🌟 新增：累加「如果沒有 AI 介入」會耗多少電
    let logBuffer = [];
    let stationUpdates = {}; // 記錄哪個站點有多少人上車 { stationId: count }

    // 3. 更新每一輛車 (Physics & Logic Loop)
    const nextVehicles = currentVehicles.map(v => {
      let { x, y, progress, battery, status, passengers, boardedLast, alightedLast } = v;
      let nextV = { ...v };

      // --- AI 決策模擬 (Decision Making) ---
      // Baseline: 固定規則 (笨)
      // RL: 根據電量與尖峰做決策 (聰明)
      const aiAction = currentMode === 'baseline' ? 'BASELINE' : (battery < 25 ? 'CHARGE' : 'CRUISE');

      // --- A. 充電邏輯 (Charging Logic) ---
      if (status === 'charging') {
        battery += 0.8; // 充電速度 (每 tick +0.8%)
        if (battery >= 95) {
          status = 'moving';
          logBuffer.push({
            category: 'SYSTEM',
            msg: `[Bus #${v.id}] 充電完成 (SoC: 95%) -> 恢復服務`
          });
        }
        // 充電時車輛靜止，顯示充電中
        return { ...nextV, battery, speed: 0, power: -50, status, aiState: 'CHARGING' };
      }

      // --- B. 移動插值 (Path Interpolation) ---
      // 計算車輛在 SVG 路徑上的下一個位置
      const routeLen = ROUTE_SEQUENCE.length;
      const currIdx = Math.floor(progress) % routeLen;
      const nextIdx = Math.ceil(progress) % routeLen;
      const currLoc = getLoc(ROUTE_SEQUENCE[currIdx]);
      const nextLoc = getLoc(ROUTE_SEQUENCE[nextIdx]);

      const segProg = progress % 1; // 當前路段進度 (0.0 ~ 1.0)
      const dx = nextLoc.x - currLoc.x;
      const dy = nextLoc.y - currLoc.y;
      x = currLoc.x + dx * segProg;
      y = currLoc.y + dy * segProg;

      // --- ⚡ 双轨能耗计算模型 (Dual-Track Energy Calculation) ---

      // 1. 判断是否组队 (Platooning Logic)
      let isPlatooning = false;
      let platoonPartner = null;
      if (currentMode === 'rl') { // 只有 RL 模式才启用组队功能
        platoonPartner = currentVehicles.find(other =>
          other.id !== v.id &&
          calcDist({ x, y }, other) < PLATOON_DISTANCE && // 距离小于阈值
          calcDist({ x, y }, other) > 5 // 避免重叠
        );
        isPlatooning = platoonPartner !== undefined;

        // 🔥 只在組隊狀態「剛發生」時記錄一次 (避免每個 tick 都寫 log)
        if (isPlatooning && !v.platooning && Math.random() < 0.05) { // 5% 機率記錄
          logBuffer.push({
            category: 'AI',
            msg: `[Bus #${v.id}] 偵測到鄰近車輛 -> 啟動編隊行駛 (節能: 60%)`
          });
        }
      }

      // 2. 共同参数
      let baseSpeed = isPlatooning ? 0.005 : 0.004;
      if (currLoc.id === 'taiwu' || currLoc.id === 'zhaishan') baseSpeed *= 0.7; // 爬坡变慢
      const simulatedV = baseSpeed * 150;
      const massFactor = 1 + (passengers * 0.005);
      const basePower = 0.5; // 空调、车载系统

      // 3. 🟢 RL Agent 实际耗能 (考虑 Platooning)
      const currentDragCoeff = isPlatooning ? 0.3 : 0.8;
      const aeroPower = 0.5 * currentDragCoeff * Math.pow(simulatedV, 3);
      const instantPower = (aeroPower + basePower) * massFactor;
      const energyConsumed = instantPower * 0.002;

      // 4. 🔴 Baseline 影子耗能 (强迫假设没有 AI，永远不组队)
      const baselineDragCoeff = 0.8; // 永远是单车行驶
      const baselineAeroPower = 0.5 * baselineDragCoeff * Math.pow(simulatedV, 3);
      const baselineInstantPower = (baselineAeroPower + basePower) * massFactor;
      const energyConsumedBaseline = baselineInstantPower * 0.002;

      // 5. 更新变量
      const distMoved = baseSpeed * 100;
      battery -= energyConsumed; // 车子实际扣电 (跟随目前模式)
      cycleEnergy += energyConsumed; // 实际耗能
      cycleEnergyBaseline += energyConsumedBaseline; // 偷偷记下 Baseline 耗能
      cycleDist += distMoved;
      if (isPlatooning) cyclePlatoon += distMoved; // 累积组队里程
      if (passengers === 0) cycleEmpty += distMoved; // 累积空车里程

      // --- D. 乘客互動 (Boarding/Alighting) ---
      let newProgress = progress + baseSpeed;
      let currentBoarded = boardedLast;
      let currentAlighted = alightedLast;

      // 檢查是否跨越整數進度 (代表到站)
      if (Math.floor(newProgress) > Math.floor(progress)) {
        const stopId = ROUTE_SEQUENCE[Math.floor(newProgress) % routeLen];
        const stop = getLoc(stopId);

        // 如果在總站且低電量 -> 強制充電
        if (stopId === 'depot' && battery < 30 && currentMode === 'rl') {
          status = 'charging';
          // 🔥 更專業的 AI 術語
          logBuffer.push({
            category: 'AI',
            msg: `[Bus #${v.id}] SoC低於閾值 (30%) -> 執行返站充電策略 (Reward: +15)`
          });
          passengers = 0; // 清客
        } else {
          // 1. 下車邏輯 (Alighting)
          // 隨機決定有多少人下車 (最多 40% 的人)
          currentAlighted = Math.floor(Math.random() * (passengers * 0.4));
          passengers -= currentAlighted;

          // 2. 上車邏輯 (Boarding)
          const station = currentStations.find(s => s.id === stopId);
          currentBoarded = 0;
          if (station && station.queue > 0) {
            // 能上多少人取決於剩餘容量與排隊人數
            currentBoarded = Math.min(station.queue, v.capacity - passengers);
            passengers += currentBoarded;
            cycleServed += currentBoarded;

            // 記錄要更新的站點 (稍後批量更新)
            stationUpdates[stopId] = (stationUpdates[stopId] || 0) + currentBoarded;

            // 🔥 只在高需求站點記錄 (避免刷屏)
            if (currentBoarded >= 3 && Math.random() < 0.1) { // 10% 機率記錄
              const stationName = station.name || stopId;
              logBuffer.push({
                category: 'AI',
                msg: `[Bus #${v.id}] 在 ${stationName} 接載 ${currentBoarded} 人 (載客率: ${Math.round((passengers / v.capacity) * 100)}%)`
              });
            }
          }
        }
      }

      // 🔥 警告日誌：電量危急
      if (battery < 15 && battery > 5 && Math.random() < 0.02) { // 2% 機率記錄警告
        logBuffer.push({
          category: 'WARN',
          msg: `[Bus #${v.id}] 電量危急 (${Math.round(battery)}%) - 建議立即返站`
        });
      }

      return {
        ...nextV,
        x,
        y,
        progress: newProgress,
        battery: Math.max(0, battery),
        status,
        platooning: isPlatooning,
        dragCoeff: currentDragCoeff,
        speed: Math.round(baseSpeed * 10000),
        power: Math.round(instantPower),
        passengers,
        aiState: aiAction,
        boardedLast: currentBoarded,
        alightedLast: currentAlighted
      };
    });

    // 4. 寫入車輛狀態
    setVehicles(nextVehicles);

    // 5. 處理累積的日誌
    if (logBuffer.length > 0) {
      logBuffer.forEach(item => {
        // 兼容舊代碼：如果 item 是字串，就當 SYSTEM；如果是物件，就讀取屬性
        if (typeof item === 'string') addLog('SYSTEM', item);
        else addLog(item.category, item.msg);
      });
    }

    // 6. 批量更新站點排隊人數 (避免在迴圈中多次 setState)
    if (Object.keys(stationUpdates).length > 0) {
      setStations(prev => prev.map(s => {
        if (stationUpdates[s.id]) {
          const boarded = stationUpdates[s.id];
          return {
            ...s,
            queue: Math.max(0, s.queue - boarded),
            totalServed: (s.totalServed || 0) + boarded
          };
        }
        return s;
      }));
    }

    // 🔥 7. 直接更新 Ref (這是同步的，保證拿到最新值)
    energyAccumulatorRef.current.total += cycleEnergy;
    energyAccumulatorRef.current.baseline += cycleEnergyBaseline;

    // 🔥 8. 使用 Ref 的值來更新 React State (Metrics)
    setMetrics(prev => ({
      ...prev,
      totalEnergy: energyAccumulatorRef.current.total, // 改用 Ref
      totalEnergyBaseline: energyAccumulatorRef.current.baseline, // 改用 Ref
      totalServed: prev.totalServed + cycleServed,
      totalDist: prev.totalDist + cycleDist,
      platoonDist: prev.platoonDist + cyclePlatoon,
      emptyDist: prev.emptyDist + cycleEmpty,
      totalWaitTime: prev.totalWaitTime + (currentStations.reduce((acc, s) => acc + s.queue, 0) * 0.5),
      // 👇 更新電網狀態資訊
      gridInfo: {
        solar: solarOutput,
        load: netLoad,
        price: gridPrice,
        status: gridStatusValue
      }
    }));

    // 9. 定期更新歷史圖表 (每 5 分鐘採樣一次)
    if (Math.floor(newTime) % 5 === 0) {
      const avgSoC = nextVehicles.reduce((acc, v) => acc + v.battery, 0) / nextVehicles.length;
      // 🔥 使用 Ref 的值來更新圖表 (絕對不會是 0)
      setStatsHistory(prev => {
        const newData = [
          ...prev,
          {
            time: formatTime(newTime),
            avgSoC: Math.round(avgSoC),
            // 這裡讀取 Ref，絕對不會是 0
            energy: Number(energyAccumulatorRef.current.total.toFixed(2)),
            baseline: Number(energyAccumulatorRef.current.baseline.toFixed(2))
          }
        ];
        return newData.slice(-40); // 只保留最近 40 筆，避免圖表過擠
      });

      // 🔥 全局大腦日誌：定時匯報擁擠狀況
      const busiest = [...currentStations]
        .sort((a, b) => (b.queue || 0) - (a.queue || 0))
        .slice(0, 3)
        .filter(s => s.queue > 0);

      if (busiest.length > 0) {
        const summary = busiest
          .map(s => `${s.name} 等候 ${s.queue} 人，累計服務 ${(s.totalServed || 0)} 人`)
          .join(' / ');
        addLog('SYSTEM', `站點擁擠概況：${summary}`);
      } else {
        addLog('SYSTEM', '站點擁擠概況：目前各站候車量穩定。');
      }
    }
  };

  /**
   * ============================================================================
   * SECTION 5: UI 渲染函式 (UI Rendering)
   * 包含右側面板、KPI 卡片、車輛詳情等
   * ============================================================================
   */

  // [UI] 渲染右側面板內容 (根據是否選中車輛切換顯示模式)
  const renderSidePanelContent = () => {
    if (selectedVehicleId !== null) {
      // --- 模式 A: 單車微觀監控 (Micro Monitor) ---
      // 當使用者點擊地圖上的車輛時，顯示該車的詳細物理參數
      const v = vehicles.find(v => v.id === selectedVehicleId);
      if (!v) return null;
      
      return (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8' }}>車輛監控 #{v.id}</span>
            <button onClick={() => setSelectedVehicleId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>回總覽</button>
          </div>
          
          <div style={styles.kpiGrid}>
            <div style={styles.kpiBox}><Gauge size={18} color="#facc15" /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>車速</span><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{v.speed}</span></div>
            <div style={styles.kpiBox}><Zap size={18} color={v.power < 0 ? '#4ade80' : '#f87171'} /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>功率</span><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{v.power}</span></div>
            <div style={styles.kpiBox}><Wind size={18} color="#a78bfa" /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>風阻</span><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{v.dragCoeff}</span></div>
            <div style={styles.kpiBox}><Users size={18} color="#60a5fa" /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>載客</span><span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{v.passengers}</span></div>
          </div>
          
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px' }}>
              <span>電池 SoC</span>
              <span style={{ color: v.battery < 20 ? '#ef4444' : '#4ade80' }}>{Math.round(v.battery)}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${v.battery}%`, height: '100%', background: v.battery < 20 ? '#ef4444' : '#22c55e', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* 🔥 乘客動態：顯示本站上/下車人數 */}
          <div style={{marginTop: '15px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem'}}>
             <span style={{color: '#4ade80'}}>本站上車: +{v.boardedLast}</span>
             <span style={{color: '#f87171'}}>本站下車: -{v.alightedLast}</span>
          </div>
        </div>
      );
    } else {
      // --- 模式 B: 系統宏觀總覽 (Macro Overview) ---
      // 預設顯示全域 KPI
      return (
        <>
          <div style={{ ...styles.card, padding: '15px', borderLeft: `4px solid ${mode === 'rl' ? '#a855f7' : '#94a3b8'}`, marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
              <Cpu size={18} color={mode === 'rl' ? '#a855f7' : '#94a3b8'} />
              <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>AI 核心</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              模式：<span style={{ color: mode === 'rl' ? '#4ade80' : '#cbd5e1' }}>{mode === 'rl' ? 'RL Agent' : 'Baseline'}</span>
            </div>
          </div>
          
          <div style={styles.kpiGrid}>
            <div style={styles.kpiBox}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>組隊率</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>
                    {metrics.totalDist > 0 ? ((metrics.platoonDist / metrics.totalDist) * 100).toFixed(0) : 0}%
                </span>
            </div>
            <div style={styles.kpiBox}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>空車率</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f87171' }}>
                    {metrics.totalDist > 0 ? ((metrics.emptyDist / metrics.totalDist) * 100).toFixed(0) : 0}%
                </span>
            </div>
            <div style={styles.kpiBox}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>效率</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>
                    {metrics.totalEnergy > 0 ? (metrics.totalServed / metrics.totalEnergy).toFixed(1) : 0}
                </span>
            </div>
            <div style={styles.kpiBox}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>等待</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308' }}>
                    {metrics.totalServed > 0 ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1) : 0}m
                </span>
            </div>
          </div>
        </>
      );
    }
  };

  /**
   * ============================================================================
   * SECTION 6: 主渲染區 (Main Render)
   * 包含 Header、地圖區、側邊欄
   * ============================================================================
   */
  return (
    <div style={styles.container}>
      {/* 內嵌動畫樣式 */}
      <style>{`
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } 
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        /* 路線流動動畫 */
        @keyframes dash-flow { to { stroke-dashoffset: -24; } }
        .road-flow { animation: dash-flow 1s linear infinite; }
        /* RWD: 小螢幕時強制單欄 */
        @media (max-width: 1100px) {
          .eco-main-layout { grid-template-columns: 1fr !important; }
          .eco-map-section { grid-column: 1 / -1 !important; min-height: 400px !important; }
          .eco-side-panel { grid-column: 1 / -1 !important; }
        }
      `}</style>
      
      {/* Header */}
      <div style={styles.header}>
        {/* 模式切換按鈕 */}
        <div style={{ backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', display: 'flex', border: '1px solid #334155' }}>
          <button
            onClick={() => setMode('baseline')}
            style={{
              border: 'none',
              background: mode === 'baseline' ? '#38bdf8' : 'transparent',
              color: mode === 'baseline' ? '#0f172a' : '#94a3b8',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            Baseline
          </button>
          <button
            onClick={() => setMode('rl')}
            style={{
              border: 'none',
              background: mode === 'rl' ? '#a855f7' : 'transparent',
              color: mode === 'rl' ? 'white' : '#94a3b8',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            RL Agent
          </button>
        </div>
        
        {/* 時間顯示 */}
        <div style={{ backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '1rem', color: '#38bdf8' }}>
          {formatTime(gameTime)}
        </div>
        
        {/* 播放/暫停與重置 */}
        <button onClick={() => {
            // 這裡修改成只透過外部 props 控制, 或者內部 state 控制
            // 為了相容性, 我們直接修改內部 isRunning (若無外部控制)
            // 注意: 實際專案應統一由上層控制
          }} 
          style={{ ...styles.controlBtn, backgroundColor: isRunning ? '#eab308' : '#22c55e', cursor: 'default', opacity: 0.8 }}
          disabled
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={resetSimulation} style={{ ...styles.controlBtn, backgroundColor: '#475569' }}>
          <RotateCcw size={18} />
        </button>
      </div>

      {/* 主版面 */}
      <div style={styles.mainLayout} className="eco-main-layout">
        
        <div style={styles.mapSection} className="eco-map-section">
          {/* 1. 內嵌動畫 (保留路線流動效果，因為這個還是很有科技感) */}
          <style>
            {`
              @keyframes dash-flow { to { stroke-dashoffset: -24; } }
              @keyframes island-pulse {
                0% { opacity: 0.3; filter: drop-shadow(0 0 5px #0f766e); }
                50% { opacity: 0.5; filter: drop-shadow(0 0 15px #2dd4bf); }
                100% { opacity: 0.3; filter: drop-shadow(0 0 5px #0f766e); }
              }
              @keyframes ping {
                0% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.3); opacity: 0.3; }
                100% { transform: scale(1.5); opacity: 0; }
              }
              .road-flow { animation: dash-flow 1s linear infinite; }
              .island-glow { animation: island-pulse 4s ease-in-out infinite; }
            `}
          </style>

          {/* 2. 地圖 SVG (保留原本的) */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute'}}>
             <defs>
               <linearGradient id="islandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                 <stop offset="0%" stopColor="#0f766e" stopOpacity="0.4" />
                 <stop offset="100%" stopColor="#115e59" stopOpacity="0.1" />
               </linearGradient>
               <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                 <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(45, 212, 191, 0.1)" strokeWidth="0.5"/>
               </pattern>
             </defs>
             <path className="island-glow" d="M 80 200 Q 200 100 350 150 T 600 50 L 750 100 L 780 200 Q 700 300 650 250 T 450 350 L 400 450 L 150 480 L 50 350 Z" fill="url(#islandGradient)" stroke="#2dd4bf" strokeWidth="1" strokeOpacity="0.3" />
             <path d="M 80 200 Q 200 100 350 150 T 600 50 L 750 100 L 780 200 Q 700 300 650 250 T 450 350 L 400 450 L 150 480 L 50 350 Z" fill="url(#gridPattern)" />
             <circle cx="50" cy="250" r="30" fill="url(#islandGradient)" stroke="#2dd4bf" strokeWidth="0.5" strokeOpacity="0.3" className="island-glow" />
          </svg>

          {/* 3. 路線 SVG (保留原本的) */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute'}}>
            <path d={ROAD_PATH_SVG} fill="none" stroke="#38bdf8" strokeWidth="4" strokeOpacity="0.1" strokeLinecap="round" />
            <path className="road-flow" d={ROAD_PATH_SVG} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" strokeOpacity="0.6" />
          </svg>

          {/* 🔥 4. 新增：固定在右上角的數位時鐘 (取代原本的太陽) */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)', // 深色半透明背景
            border: '1px solid #475569',
            padding: '8px 16px',
            borderRadius: '8px',
            color: '#38bdf8', // 亮藍色字體
            fontSize: '1.2rem',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}>
            {/* 根據時間顯示簡單的 Icon，但不移動 */}
            {((gameTime / 60) % 24 >= 6 && (gameTime / 60) % 24 < 18) ? <Sun size={20} color="#facc15" /> : <Moon size={20} color="#e2e8f0" />}
            <span>{formatTime(gameTime)}</span>
          </div>

          {/* 5. 渲染站點 (Stations) - ⚡ 加入充電站指標 */}
          {stations.map(s => {
            const config = STATION_CONFIG[s.id] || { icon: MapPin, color: '#cbd5e1' };
            const IconComponent = config.icon;
            const isCharger = config.hasCharger === true; // 👈 判斷是否為充電站

            return (
              <div key={s.id}
                onClick={(e) => { e.stopPropagation(); setActiveSpot(getLoc(s.id)); }}
                style={{
                  position: 'absolute',
                  left: `${(s.x / LOGICAL_WIDTH) * 100}%`,
                  top: `${(s.y / LOGICAL_HEIGHT) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', zIndex: 10
              }}>
                 {/* ⚡ 充電站專用：脈衝光暈 (呼吸燈效果) */}
                 {isCharger && (
                   <>
                     <div style={{
                       position: 'absolute',
                       width: '40px', height: '40px',
                       borderRadius: '50%',
                       backgroundColor: '#facc15',
                       opacity: 0.6,
                       animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                       pointerEvents: 'none'
                     }} />
                     <div style={{
                       position: 'absolute',
                       width: '40px', height: '40px',
                       borderRadius: '50%',
                       backgroundColor: '#facc15',
                       opacity: 0.4,
                       animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 1s',
                       pointerEvents: 'none'
                     }} />
                   </>
                 )}

                 {/* 站點圖示 */}
                 <div style={{
                   width: '28px', height: '28px', borderRadius: '50%',
                   backgroundColor: '#1e293b',
                   border: `2px solid ${config.color}`,
                   display: 'flex', justifyContent: 'center', alignItems: 'center',
                   boxShadow: isCharger ? '0 0 20px rgba(250, 204, 21, 0.6)' : '0 0 10px rgba(0,0,0,0.5)', // 👈 充電站加強發光
                   position: 'relative',
                   zIndex: 2
                 }}>
                   <IconComponent size={14} color={config.color} />

                   {/* ⚡ 充電站專用：閃電小 Badge */}
                   {isCharger && (
                     <div style={{
                       position: 'absolute',
                       top: '-6px', right: '-6px',
                       width: '14px', height: '14px',
                       borderRadius: '50%',
                       backgroundColor: '#facc15',
                       border: '1.5px solid #1e293b',
                       display: 'flex', justifyContent: 'center', alignItems: 'center',
                       boxShadow: '0 0 8px rgba(250, 204, 21, 0.8)'
                     }}>
                       <Zap size={8} color="#1e293b" fill="#1e293b" />
                     </div>
                   )}
                 </div>

                 {/* 站名標籤 */}
                 <div style={{
                   marginTop: '4px',
                   fontSize: '10px',
                   fontWeight: 'bold',
                   backgroundColor: isCharger ? 'rgba(250, 204, 21, 0.2)' : 'rgba(0,0,0,0.7)', // 👈 充電站用黃色背景
                   border: isCharger ? '1px solid rgba(250, 204, 21, 0.5)' : 'none',
                   padding: '2px 6px',
                   borderRadius: '4px',
                   whiteSpace: 'nowrap',
                   position: 'relative',
                   zIndex: 2
                 }}>
                   {s.name}
                 </div>

                 {/* 排隊氣泡 */}
                 {s.type !== 'depot' && s.queue > 0 && (
                   <div style={{position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #1e293b', zIndex: 3}}>
                     {s.queue}
                   </div>
                 )}
              </div>
            );
          })}

          {/* 6. 渲染車輛 (Vehicles) - 保持原本邏輯 */}
          {vehicles.map(v => {
            const isCharging = v.status === 'charging';
            const mainColor = isCharging ? '#f59e0b' : (v.platooning ? '#10b981' : '#3b82f6');
            const batteryColor = v.battery < 20 ? '#ef4444' : (v.battery > 80 ? '#4ade80' : '#e2e8f0');

            return (
              <div
                key={v.id}
                onClick={(e) => { e.stopPropagation(); setSelectedVehicleId(v.id); }}
                style={{
                  ...styles.vehicleMarker,
                  left: `${(v.x / LOGICAL_WIDTH) * 100}%`,
                  top: `${(v.y / LOGICAL_HEIGHT) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${selectedVehicleId === v.id ? 1.1 : 1})`,
                  zIndex: selectedVehicleId === v.id ? 100 : 20,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  transition: 'all 0.1s linear'
                }}
              >
                {/* 車號 */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: '#e2e8f0',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  marginBottom: '2px'
                }}>
                  #{v.id}
                </div>

                {/* 巴士本體 */}
                <div style={{
                    position: 'relative',
                    padding: '6px',
                    borderRadius: '12px',
                    backgroundColor: mainColor,
                    boxShadow: `0 0 15px ${mainColor}80`,
                    border: selectedVehicleId === v.id ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                }}>
                    {isCharging ? <Zap size={20} color="white" fill="white" /> : <BusFront size={20} color="white" strokeWidth={2} />}
                    {v.platooning && (
                       <div style={{position: 'absolute', top: -4, right: -4, backgroundColor: '#064e3b', borderRadius: '50%', padding: '2px', border: '1px solid #10b981'}}>
                         <Wind size={10} color="#10b981" />
                       </div>
                    )}
                </div>

                {/* 資訊標籤 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  padding: '2px 6px', borderRadius: '6px', marginTop: '2px',
                  border: '1px solid #334155', boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                    <Users size={10} color="#94a3b8" />
                    <span style={{fontSize: '9px', fontWeight: 'bold', color: '#f1f5f9'}}>{Math.round(v.passengers)}</span>
                  </div>
                  <div style={{width: '1px', height: '8px', backgroundColor: '#475569'}}></div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                    {isCharging ? <BatteryCharging size={10} color="#fbbf24" /> : <Battery size={10} color={batteryColor} />}
                    <span style={{fontSize: '9px', fontWeight: 'bold', color: batteryColor}}>{Math.round(v.battery)}%</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 7. 景點卡片 (Spot Card) - 保持原本邏輯 */}
          {activeSpot && (
            <div style={styles.spotCard}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: activeSpot.color}}>{activeSpot.name}</span>
                <button onClick={() => setActiveSpot(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}><X size={18}/></button>
              </div>
              <div style={{height: '80px', backgroundColor: activeSpot.color, borderRadius: '8px', marginBottom: '10px', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <MapPin size={30} color="white" opacity={0.8} />
              </div>
              <p style={{fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.4', margin: 0}}>{activeSpot.desc}</p>
            </div>
          )}
        </div>

        {/* 右側面板 */}
        <div style={styles.sidePanel} className="eco-side-panel">

          <div style={styles.card}>{renderSidePanelContent()}</div>

          {/* 🔥 搬家成功：微電網監控卡片 (Microgrid Card) */}
          <div style={{...styles.card, padding: '12px'}}>
             {(() => {
                // 讀取 metrics 裡的電網數據 (如果還沒生成，給預設值)
                const { solar, load, price, status } = metrics.gridInfo || { solar: 0, load: 50, price: 3.0, status: 'NORMAL' };

                // UI 狀態判斷
                let statusColor = '#38bdf8';
                let statusText = '供需平衡';
                let Icon = Activity;

                if (status === 'GREEN') {
                  statusColor = '#4ade80'; statusText = '綠能充沛'; Icon = Leaf;
                } else if (status === 'PEAK') {
                  statusColor = '#f87171'; statusText = '尖峰負載'; Icon = Zap;
                }

                return (
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                      <span style={{fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center'}}>
                        <Zap size={14} /> 微電網狀態
                      </span>
                      <span style={{fontSize: '0.7rem', color: statusColor, border: `1px solid ${statusColor}`, padding: '2px 6px', borderRadius: '4px'}}>
                        {statusText}
                      </span>
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                       <div style={{textAlign: 'center', flex: 1, borderRight: '1px solid #334155'}}>
                          <div style={{fontSize: '0.7rem', color: '#64748b'}}>即時電價</div>
                          <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#fbbf24'}}>${price.toFixed(1)}</div>
                       </div>
                       <div style={{textAlign: 'center', flex: 1}}>
                          <div style={{fontSize: '0.7rem', color: '#64748b'}}>電網負載</div>
                          <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: statusColor}}>{Math.round(load)}%</div>
                       </div>
                    </div>

                    {/* 太陽能發電佔比 (如果有太陽) */}
                    {solar > 5 && (
                      <div style={{marginTop: '8px', backgroundColor: 'rgba(250, 204, 21, 0.1)', padding: '6px', borderRadius: '6px', display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center'}}>
                         <Sun size={12} color="#facc15" />
                         <span style={{fontSize: '0.75rem', color: '#facc15'}}>PV Output: {Math.round(solar)}%</span>
                      </div>
                    )}
                  </div>
                );
             })()}
          </div>

          <div style={styles.card}>
             <h3 style={{fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
               <BarChart3 size={16} /> 能耗趨勢對比
             </h3>
             <div style={styles.chartWrapper}>
                {statsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" hide />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}/>
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9'}} />
                      <Legend verticalAlign="top" height={36} iconType="circle"/>

                      {/* 🔴 Baseline (對照組)：紅色虛線，代表「如果不優化會耗多少電」 */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="baseline"
                        name="Baseline (無優化)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        isAnimationActive={false}
                      />

                      {/* 🟢 RL Agent (實驗組)：綠色實線區域，代表「實際耗電」 */}
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="energy"
                        name="RL Agent (本系統)"
                        stroke="#10b981"
                        fill="url(#colorEnergy)"
                        strokeWidth={3}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (<div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem'}}>等待數據...</div>)}
             </div>
          </div>

          <div style={styles.card}>
            <h3 style={{margin: '0', fontSize: '0.9rem', color: '#94a3b8', display: 'flex', gap: '5px', alignItems: 'center'}}>
              <History size={16} /> 決策日誌
            </h3>
            <div style={styles.logBox}>
              {logs.length === 0 ? (
                <span style={{fontStyle: 'italic', opacity: 0.5}}>系統待命中...</span>
              ) : (
                logs.map((log) => {
                  // 根據類別決定顏色和背景
                  let categoryColor = '#64748b'; // 預設灰色
                  let categoryBg = 'rgba(100, 116, 139, 0.15)';
                  let categoryLabel = 'INFO';

                  if (log.category === 'SYSTEM') {
                    categoryColor = '#38bdf8'; // 青色
                    categoryBg = 'rgba(56, 189, 248, 0.15)';
                    categoryLabel = 'SYS';
                  } else if (log.category === 'AI') {
                    categoryColor = '#a78bfa'; // 紫色
                    categoryBg = 'rgba(167, 139, 250, 0.15)';
                    categoryLabel = 'AI';
                  } else if (log.category === 'WARN') {
                    categoryColor = '#fb923c'; // 橘色
                    categoryBg = 'rgba(251, 146, 60, 0.15)';
                    categoryLabel = 'WARN';
                  }

                  return (
                    <div
                      key={log.id}
                      style={{
                        marginBottom: '6px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        paddingBottom: '6px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start'
                      }}
                    >
                      {/* 時間標籤 */}
                      <span style={{
                        fontSize: '0.65rem',
                        color: '#64748b',
                        fontFamily: 'monospace',
                        minWidth: '40px',
                        flexShrink: 0
                      }}>
                        {log.time}
                      </span>

                      {/* 類別徽章 */}
                      <span style={{
                        fontSize: '0.6rem',
                        color: categoryColor,
                        backgroundColor: categoryBg,
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontWeight: 'bold',
                        minWidth: '40px',
                        textAlign: 'center',
                        flexShrink: 0
                      }}>
                        {categoryLabel}
                      </span>

                      {/* 訊息內容 */}
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#e2e8f0',
                        flex: 1,
                        lineHeight: '1.3'
                      }}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KinmenMapSim;