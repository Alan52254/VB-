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
  ToggleRight       // 切換開關 (未使用)
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
  'depot':     { icon: Warehouse, color: '#fbbf24', label: '總站' },
  'juguang':   { icon: Flag,      color: '#f87171', label: '地標' },
  'zhaishan':  { icon: Anchor,    color: '#60a5fa', label: '坑道' },
  'chenggong': { icon: Castle,    color: '#f472b6', label: '洋樓' },
  'airport':   { icon: Plane,     color: '#38bdf8', label: '機場' },
  'taiwu':     { icon: Mountain,  color: '#4ade80', label: '登山' },
  'shanhou':   { icon: Home,      color: '#fb923c', label: '聚落' },
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
  const latestDataRef = useRef({ vehicles: [], gameTime: 0, metrics: {}, stations: [], mode: 'rl' });

  // 監聽 State 變化，同步更新 Ref
  useEffect(() => {
    latestDataRef.current = { vehicles, gameTime, metrics, stations, mode };
  }, [vehicles, gameTime, metrics, stations, mode]);

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
        metrics
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
    setMetrics({ totalEnergy: 0, totalServed: 0, totalDist: 0, platoonDist: 0, emptyDist: 0, totalWaitTime: 0 });
    setSelectedVehicleId(null);
    setActiveSpot(getLoc('depot')); // 預設顯示總站卡片
    
    addLog("System", "系統初始化完成。RL Agent 準備就緒。");
  };

  // 輔助函式：寫入日誌
  const addLog = (source, msg) => {
    setLogs(prev => [`[${formatTime(gameTime)}] ${source}: ${msg}`, ...prev.slice(0, 5)]);
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

    // 2. 客流生成 (Passenger Generation)
    // 簡單的隨機模型：有 20% 機率在隨機站點產生乘客
    if (Math.random() < 0.2) { 
      setStations(prev => prev.map(s => {
        if (s.type === 'depot') return s; // 總站不產生初始客流
        // 根據站點熱門度 (popularity) 決定是否增加排隊人數
        return Math.random() < s.popularity ? { ...s, queue: s.queue + 1 } : s;
      }));
    }

    // 暫存本輪迴的累計數據 (用於 KPI 計算)
    let cycleEnergy = 0, cycleDist = 0, cyclePlatoon = 0, cycleEmpty = 0, cycleServed = 0;
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
          logBuffer.push(`Bus #${v.id}: 充電完成。`);
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

      // --- C. 物理感知 (Physics Awareness) ---
      
      // 1. 判斷是否組隊 (Platooning Check)
      let isPlatooning = false;
      if (currentMode === 'rl') { // 只有 RL 模式才啟用組隊功能
        isPlatooning = currentVehicles.some(other =>
          other.id !== v.id &&
          calcDist({ x, y }, other) < PLATOON_DISTANCE && // 距離小於閾值
          calcDist({ x, y }, other) > 10 // 避免重疊
        );
      }

      // 2. 風阻係數 (Cd Calculation)
      // 這就是我們的核心技術亮點：組隊時風阻減半！
      const currentDragCoeff = isPlatooning ? 0.4 : 0.8; 
      
      // 3. 速度計算
      let baseSpeed = isPlatooning ? 0.005 : 0.004; // 組隊稍快 (跟車效應)
      // 地形影響：太武山或翟山附近為上坡，速度變慢
      if (currLoc.id === 'taiwu' || currLoc.id === 'zhaishan') baseSpeed *= 0.8; 

      // 4. 功率計算 (kW)
      const loadFactor = 1 + (passengers * 0.02); // 載重因子
      const terrainFactor = (currLoc.id === 'taiwu') ? 1.5 : 1.0; // 地形因子
      const instantPower = (isPlatooning ? 12 : 20) * loadFactor * terrainFactor; // 組隊省電
      
      // 5. 能耗計算 (kWh)
      const energyConsumed = instantPower * (50 / 3600 / 1000) * 10;
      const distMoved = baseSpeed * 100;

      // 更新變數
      battery -= energyConsumed;
      cycleEnergy += energyConsumed;
      cycleDist += distMoved;
      if (isPlatooning) cyclePlatoon += distMoved; // 累積組隊里程
      if (passengers === 0) cycleEmpty += distMoved; // 累積空車里程

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
          logBuffer.push(`AI Agent: 指令 Bus #${v.id} 返站充電。`);
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
          }
        }
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
      logBuffer.forEach(msg => addLog("System", msg));
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

    // 7. 更新 KPI 累積值 (Metrics Accumulation)
    setMetrics(prev => ({
      totalEnergy: prev.totalEnergy + cycleEnergy,
      totalServed: prev.totalServed + cycleServed,
      totalDist: prev.totalDist + cycleDist,
      platoonDist: prev.platoonDist + cyclePlatoon,
      emptyDist: prev.emptyDist + cycleEmpty,
      // 累積等待時間 = 總排隊人數 * 時間步長
      totalWaitTime: prev.totalWaitTime + (currentStations.reduce((acc, s) => acc + s.queue, 0) * 0.5)
    }));

    // 8. 定期更新歷史圖表 (每 5 分鐘採樣一次)
    if (Math.floor(newTime) % 5 === 0) {
      const avgSoC = nextVehicles.reduce((acc, v) => acc + v.battery, 0) / nextVehicles.length;
      setStatsHistory(prev => {
        const newData = [
          ...prev,
          {
            time: formatTime(newTime),
            avgSoC: Math.round(avgSoC),
            energy: Math.round(metrics.totalEnergy + cycleEnergy)
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
        addLog('Global', `站點擁擠概況：${summary}`);
      } else {
        addLog('Global', '站點擁擠概況：目前各站候車量穩定。');
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
        
        {/* 左側地圖區塊 */}
        <div style={styles.mapSection} className="eco-map-section">
          
          {/* 金門背景 (SVG) */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{ position: 'absolute', opacity: 0.2 }}>
             <path d="M 80 200 Q 200 100 350 150 T 600 50 L 750 100 L 780 200 Q 700 300 650 250 T 450 350 L 400 450 L 150 480 L 50 350 Z" fill="#0f766e" />
             <circle cx="50" cy="250" r="30" fill="#0f766e" />
          </svg>

          {/* 路線軌跡 (動態流動) */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{ position: 'absolute' }}>
            <path d={ROAD_PATH_SVG} fill="none" stroke="#475569" strokeWidth="4" strokeOpacity="0.3" strokeLinecap="round" />
            <path 
              className="road-flow" 
              d={ROAD_PATH_SVG} 
              fill="none" 
              stroke="#94a3b8" 
              strokeWidth="2" 
              strokeDasharray="6 6" 
              strokeOpacity="0.6" 
            />
          </svg>

          {/* 渲染站點 */}
          {stations.map(s => {
            const config = STATION_CONFIG[s.id] || { icon: MapPin, color: '#cbd5e1' };
            const IconComponent = config.icon;
            
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
                 {/* 站點圖示 */}
                 <div style={{
                   width: '28px', height: '28px', borderRadius: '50%', 
                   backgroundColor: '#1e293b', border: `2px solid ${config.color}`, 
                   display: 'flex', justifyContent: 'center', alignItems: 'center',
                   boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                 }}>
                   <IconComponent size={14} color={config.color} />
                 </div>
                 
                 {/* 站名標籤 */}
                 <div style={{marginTop: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap'}}>
                   {s.name}
                 </div>
                 
                 {/* 排隊氣泡 */}
                 {s.type !== 'depot' && s.queue > 0 && (
                   <div style={{position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #1e293b'}}>
                     {s.queue}
                   </div>
                 )}
              </div>
            );
          })}

          {/* 渲染車輛 */}
          {vehicles.map(v => {
            const isCharging = v.status === 'charging';
            
            // 🔥 黃色蛋形充電樣式 vs 一般巴士樣式
            const vehicleBodyStyle = {
              width: isCharging ? '32px' : '36px', 
              height: isCharging ? '40px' : '36px', 
              borderRadius: isCharging ? '999px' : '8px', 
              backgroundColor: isCharging ? '#fbbf24' : (v.platooning ? '#065f46' : (mode === 'baseline' ? '#64748b' : '#1e40af')), 
              border: selectedVehicleId === v.id ? '2px solid #ffffff' : `2px solid ${isCharging ? '#f59e0b' : (v.platooning ? '#4ade80' : '#3b82f6')}`, 
              display: 'flex', justifyContent: 'center', alignItems: 'center', 
              color: isCharging ? '#78350f' : 'white', 
              fontWeight: 'bold', fontSize: '12px', 
              boxShadow: isCharging ? '0 0 15px rgba(251, 191, 36, 0.8)' : '0 4px 10px rgba(0,0,0,0.5)',
              transition: 'all 0.3s ease'
            };

            return (
              <div key={v.id} onClick={(e) => { e.stopPropagation(); setSelectedVehicleId(v.id); }}
                 style={{...styles.vehicleMarker, left: `${(v.x / LOGICAL_WIDTH) * 100}%`, top: `${(v.y / LOGICAL_HEIGHT) * 100}%`, transform: `translate(-50%, -50%) scale(${selectedVehicleId === v.id ? 1.3 : 1})`, zIndex: selectedVehicleId === v.id ? 100 : 20}}>
                 
                 <div style={vehicleBodyStyle}>
                   {isCharging ? <Zap size={18} className="animate-pulse" /> : v.id}
                   
                   {/* 組隊標記 */}
                   {v.platooning && <Wind size={14} style={{position: 'absolute', right: '-6px', top: '-6px', color: '#4ade80', backgroundColor: '#064e3b', borderRadius: '50%', padding: '1px'}} />}
                 </div>
                 
                 {/* 電量條 */}
                 <div style={{width: '36px', height: '4px', backgroundColor: '#334155', marginTop: '2px', borderRadius: '2px'}}>
                   <div style={{width: `${v.battery}%`, height: '100%', backgroundColor: v.battery < 20 ? '#ef4444' : '#22c55e'}} />
                 </div>
              </div>
            );
          })}

          {/* 景點特色卡片 */}
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
          
          <div style={styles.card}>
             <h3 style={{fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
               <BarChart3 size={16} /> 能耗趨勢
             </h3>
             <div style={styles.chartWrapper}>
                {statsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs><linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" hide />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={10} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={10} />
                      <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9'}} />
                      <Legend wrapperStyle={{fontSize: '10px'}} />
                      <Area yAxisId="left" type="monotone" dataKey="avgSoC" stroke="#4ade80" fill="url(#colorEnergy)" name="平均電量 %" />
                      <Line yAxisId="right" type="monotone" dataKey="energy" stroke="#f87171" dot={false} name="總耗能 kWh" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (<div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem'}}>等待模擬數據...</div>)}
             </div>
          </div>

          <div style={styles.card}>
            <h3 style={{margin: '0', fontSize: '0.9rem', color: '#94a3b8', display: 'flex', gap: '5px', alignItems: 'center'}}>
              <History size={16} /> 決策日誌
            </h3>
            <div style={styles.logBox}>
              {logs.length === 0 ? <span style={{fontStyle: 'italic', opacity: 0.5}}>系統待命中...</span> : logs.map((l, i) => <div key={i} style={{marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px'}}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KinmenMapSim;