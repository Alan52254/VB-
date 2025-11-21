import React, { useState, useEffect, useRef } from 'react';
import { 
  Wind, Zap, Users, BatteryCharging, BarChart3, Play, Pause, RotateCcw, 
  MapPin, Gauge, History, Info, Cpu, X, Signal, Leaf, Activity, ToggleLeft
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart
} from 'recharts';

// --- 1. 地理參數與路線設定 (Geography) ---
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 500;
const PLATOON_DISTANCE = 70; // 觸發組隊的像素距離

// 金門景點資料 (加入描述與圖片意象顏色，符合真實相對位置)
const LOCATIONS = [
  { id: 'depot', name: '金城總站', x: 120, y: 280, type: 'depot', desc: '調度中心與快速充電站 (Hub)', color: '#eab308', popularity: 0.2 },
  { id: 'juguang', name: '莒光樓', x: 160, y: 360, type: 'stop', desc: '戰地精神地標，登樓可眺望廈門。', color: '#ef4444', popularity: 0.9 },
  { id: 'zhaishan', name: '翟山坑道', x: 130, y: 450, type: 'stop', desc: 'A字型戰備水道，花崗岩地質。', color: '#6366f1', popularity: 0.7 },
  { id: 'chenggong', name: '陳景蘭洋樓', x: 380, y: 440, type: 'stop', desc: '金門最大洋樓，純白系建築。', color: '#ec4899', popularity: 0.6 },
  { id: 'airport', name: '尚義機場', x: 450, y: 350, type: 'stop', desc: '交通樞紐，人流吞吐量最高。', color: '#3b82f6', popularity: 1.0 },
  { id: 'taiwu', name: '太武山', x: 600, y: 250, type: 'stop', desc: '最高峰，「毋忘在莒」勒石 (爬坡)。', color: '#22c55e', popularity: 0.8 },
  { id: 'shanhou', name: '山后民俗村', x: 720, y: 120, type: 'stop', desc: '完整的閩南二落大厝聚落。', color: '#f97316', popularity: 0.5 },
  { id: 'mashan', name: '馬山觀測所', x: 620, y: 50, type: 'stop', desc: '距大陸最近據點，天下第一哨。', color: '#a855f7', popularity: 0.6 },
  { id: 'guningtou', name: '古寧頭', x: 100, y: 80, type: 'stop', desc: '古寧頭戰役紀念館，歷史戰場。', color: '#94a3b8', popularity: 0.5 },
];

// 路線 SVG (模擬真實金門環島公路的彎曲度，取代原本的直線 Polyline)
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

const ROUTE_SEQUENCE = [
  'depot', 'juguang', 'zhaishan', 'chenggong', 'airport', 
  'taiwu', 'shanhou', 'mashan', 'guningtou', 'depot'
];

const getLoc = (id) => LOCATIONS.find(l => l.id === id);
const calcDist = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

// --- 2. 樣式設定 (CSS-in-JS) ---
const styles = {
  container: { backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh', fontFamily: '"Noto Sans TC", sans-serif', padding: '20px', width: '100%', overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  title: { fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: '800', background: 'linear-gradient(90deg, #2dd4bf, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 },
  mainLayout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', maxWidth: '1600px', margin: '0 auto' },
  mapSection: { gridColumn: 'span 2', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', position: 'relative', aspectRatio: '800/500', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  sidePanel: { display: 'flex', flexDirection: 'column', gap: '15px', gridColumn: 'span 1' },
  card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' },
  kpiBox: { backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  controlBtn: { border: 'none', borderRadius: '8px', width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'all 0.2s', fontSize: '0.9rem', fontWeight: 'bold' },
  vehicleMarker: { position: 'absolute', transform: 'translate(-50%, -50%)', transition: 'all 0.1s linear', zIndex: 20, cursor: 'pointer' },
  marker: { position: 'absolute', transform: 'translate(-50%, -50%)', cursor: 'pointer', transition: 'all 0.2s' },
  spotCard: { position: 'absolute', bottom: '20px', left: '20px', width: '280px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '12px', border: '1px solid #475569', backdropFilter: 'blur(5px)', zIndex: 50, animation: 'slideUp 0.3s ease-out', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' },
  chartWrapper: { width: '100%', height: '200px' },
  logBox: { height: '120px', overflowY: 'auto', fontSize: '0.85rem', color: '#94a3b8', borderTop: '1px solid #334155', marginTop: '10px', paddingTop: '10px', fontFamily: 'monospace' }
};

// --- 3. 主程式邏輯 ---
const KinmenAdvancedSim = () => {
  // State
  const [vehicles, setVehicles] = useState([]);
  const [stations, setStations] = useState([]);
  const [gameTime, setGameTime] = useState(480); // 分鐘 (從 08:00 開始)
  const [isRunning, setIsRunning] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [activeSpot, setActiveSpot] = useState(null); // 當前顯示的景點卡片
  const [statsHistory, setStatsHistory] = useState([]);
  const [logs, setLogs] = useState([]); 
  
  // 🔥 新增：模式切換與全局 KPI 統計
  const [mode, setMode] = useState('rl'); // 'baseline' | 'rl'
  const [metrics, setMetrics] = useState({
    totalEnergy: 0,
    totalServed: 0,
    totalDist: 0,
    platoonDist: 0,
    emptyDist: 0,
    totalWaitTime: 0
  });

  // 初始化
  useEffect(() => {
    resetSimulation();
  }, []);

  const resetSimulation = () => {
    // 初始化 6 台車
    const newVehicles = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      x: 120, y: 280, 
      progress: i * 0.6, 
      battery: 95 - (i * 5), // 錯開電量
      status: 'moving', 
      speed: 0, 
      passengers: 0,
      capacity: 20,
      dragCoeff: 0.8, 
      power: 0, 
      platooning: false,
      targetIndex: 1,
      totalDist: 0,
      aiState: 'INIT',
      // 🔥 新增：上下車紀錄 (給 UI 顯示)
      boardedLast: 0,
      alightedLast: 0
    }));
    setVehicles(newVehicles);

    // 初始化站點
    const newStations = LOCATIONS.map(loc => ({
      ...loc,
      queue: 0
    }));
    setStations(newStations);

    setGameTime(480); // 8:00 AM
    setStatsHistory([]);
    setLogs([]);
    setMetrics({ totalEnergy: 0, totalServed: 0, totalDist: 0, platoonDist: 0, emptyDist: 0, totalWaitTime: 0 });
    setIsRunning(false);
    setSelectedVehicleId(null);
    setActiveSpot(getLoc('depot')); 
    addLog("System", "系統初始化完成。RL Agent 上線監控中。");
  };

  const addLog = (source, msg) => {
    setLogs(prev => [`[${formatTime(gameTime)}] ${source}: ${msg}`, ...prev.slice(0, 5)]);
  };

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // --- 核心迴圈 (Game Loop) ---
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      updateGameLogic();
    }, 50); // 20 FPS
    return () => clearInterval(interval);
  }, [isRunning, vehicles, gameTime, mode]);

  // 模擬後端 AI Agent 的決策邏輯
  const aiAgentDecision = (vehicle, time) => {
    if (mode === 'baseline') return { action: 'BASELINE', reason: '固定班表' };

    // 範例：低電量強制回充
    if (vehicle.battery < 25) return { action: 'CHARGE', reason: '電量過低 (<25%)' };
    // 範例：尖峰時刻加速
    const hour = (time / 60) % 24;
    if ((hour >= 8 && hour <= 9) || (hour >= 16 && hour <= 18)) return { action: 'PEAK_DISPATCH', reason: '尖峰時刻加開' };
    
    return { action: 'CRUISE', reason: '最佳化巡航' };
  };

  const updateGameLogic = () => {
    // 1. 時間推進
    const newTime = gameTime + 0.5; 
    setGameTime(newTime);

    // 2. 客流生成與等待時間累積
    const hour = (newTime / 60) % 24;
    const isPeak = (hour >= 8 && hour <= 9) || (hour >= 16 && hour <= 18);
    
    // 累積等待時間 (簡化模型：每人每 tick 多等 0.5 分鐘)
    const currentQueueTotal = stations.reduce((acc, s) => acc + s.queue, 0);

    if (Math.random() < (isPeak ? 0.2 : 0.05)) {
      setStations(prev => prev.map(s => {
        if (s.type === 'depot') return s;
        const rate = s.popularity * (isPeak ? 2 : 0.8);
        return Math.random() < rate ? { ...s, queue: s.queue + 1 } : s;
      }));
    }

    // 3. 車輛物理與決策
    let cycleEnergy = 0;
    let cycleDist = 0;
    let cyclePlatoon = 0;
    let cycleEmpty = 0;
    let cycleServed = 0;

    setVehicles(prevVehicles => {
      return prevVehicles.map(v => {
        // 呼叫 AI 決策
        const decision = aiAgentDecision(v, newTime);
        const aiAction = decision.action;
        
        let { x, y, progress, battery, status, passengers, boardedLast, alightedLast } = v;
        
        // --- A. 狀態檢查 ---
        if (status === 'charging') {
          battery += 0.8; // 快充模擬
          if (battery >= 95) {
            status = 'moving';
            addLog(`Bus #${v.id}`, `充電完成，重新投入營運。`);
          }
          return { ...v, battery, speed: 0, power: -50, status, aiState: 'CHARGING' }; 
        }

        // --- B. 移動邏輯 (地理插值) ---
        const routeLen = ROUTE_SEQUENCE.length;
        const currIdx = Math.floor(progress) % routeLen;
        const nextIdx = Math.ceil(progress) % routeLen;
        const currLoc = getLoc(ROUTE_SEQUENCE[currIdx]);
        const nextLoc = getLoc(ROUTE_SEQUENCE[nextIdx]);

        const segProg = progress % 1; 
        const dx = nextLoc.x - currLoc.x;
        const dy = nextLoc.y - currLoc.y;
        x = currLoc.x + dx * segProg;
        y = currLoc.y + dy * segProg;

        // --- C. 物理感知 (Physics Layer) ---
        // Platooning 判斷 (Baseline 模式下不啟動)
        let isPlatooning = false;
        if (mode === 'rl') {
            isPlatooning = prevVehicles.some(other => 
                other.id !== v.id && 
                calcDist(v, other) < PLATOON_DISTANCE && 
                calcDist(v, other) > 10 
            );
        }

        // 風阻係數變化 (核心節能邏輯)
        const dragCoeff = isPlatooning ? 0.4 : 0.8;
        
        // 速度與地形影響
        let baseSpeed = 0.004; 
        if (isPlatooning) baseSpeed = 0.005; 
        if (aiAction === 'PEAK_DISPATCH') baseSpeed *= 1.2; 
        if (currLoc.id === 'taiwu' || currLoc.id === 'zhaishan') baseSpeed *= 0.8;

        // 功率計算 (kW)
        const loadFactor = 1 + (passengers * 0.02);
        const terrainFactor = (currLoc.id === 'taiwu') ? 1.5 : 1.0;
        const instantPower = (isPlatooning ? 12 : 20) * loadFactor * terrainFactor; 
        const energyConsumed = instantPower * (50/3600/1000) * 10; // kWh (scaled)
        const distMoved = baseSpeed * 100;
        
        battery -= energyConsumed;
        cycleEnergy += energyConsumed;
        cycleDist += distMoved;
        if (isPlatooning) cyclePlatoon += distMoved;
        if (passengers === 0) cycleEmpty += distMoved;

        // --- D. 乘客互動 (上下車) ---
        let newProgress = progress + baseSpeed;
        let currentBoarded = boardedLast;
        let currentAlighted = alightedLast;

        if (Math.floor(newProgress) > Math.floor(progress)) {
          const stopId = ROUTE_SEQUENCE[Math.floor(newProgress) % routeLen];
          const stop = getLoc(stopId);
          
          if (selectedVehicleId === v.id) setActiveSpot(stop);

          if (stopId === 'depot' && battery < 30 && mode === 'rl') {
            status = 'charging';
            addLog("AI Agent", `指令：車輛 #${v.id} 低電量返站充電。`);
            passengers = 0; 
          } else {
            // 下車
            currentAlighted = Math.floor(Math.random() * (passengers * 0.4));
            passengers -= currentAlighted;

            // 上車
            const station = stations.find(s => s.id === stopId);
            currentBoarded = 0;
            if (station && station.queue > 0) {
              currentBoarded = Math.min(station.queue, v.capacity - passengers);
              passengers += currentBoarded;
              cycleServed += currentBoarded;
              setStations(sts => sts.map(s => s.id === stopId ? { ...s, queue: s.queue - currentBoarded } : s));
              
              if (currentBoarded > 0 || currentAlighted > 0) {
                  // 僅在人數多時紀錄 Log
                  if (currentBoarded > 2) addLog(`Bus #${v.id}`, `@${stop.name}: 上 ${currentBoarded} / 下 ${currentAlighted}`);
              }
            }
          }
        }

        return {
          ...v, x, y, progress: newProgress, battery: Math.max(0, battery), 
          status, platooning: isPlatooning, dragCoeff, 
          speed: Math.round(baseSpeed * 10000),
          power: Math.round(instantPower),
          passengers, aiState: decision.action,
          boardedLast: currentBoarded, alightedLast: currentAlighted
        };
      });
    });

    // 更新全局 KPI
    setMetrics(prev => ({
      totalEnergy: prev.totalEnergy + cycleEnergy,
      totalServed: prev.totalServed + cycleServed,
      totalDist: prev.totalDist + cycleDist,
      platoonDist: prev.platoonDist + cyclePlatoon,
      emptyDist: prev.emptyDist + cycleEmpty,
      totalWaitTime: prev.totalWaitTime + (currentQueueTotal * 0.5)
    }));

    // 記錄歷史數據
    if (Math.floor(newTime) % 5 === 0) {
      const avgSoC = vehicles.reduce((acc, v) => acc + v.battery, 0) / vehicles.length;
      setStatsHistory(prev => {
        const newData = [...prev, { 
            time: formatTime(newTime), 
            avgSoC: Math.round(avgSoC), 
            energy: Math.round(metrics.totalEnergy + cycleEnergy) 
        }];
        return newData.slice(-40);
      });
    }
  };

  // --- 渲染右側面板 (儀表板) ---
  const renderSidePanelContent = () => {
    if (selectedVehicleId !== null) {
      // 顯示單車微觀數據
      const v = vehicles.find(v => v.id === selectedVehicleId);
      if (!v) return null;
      return (
        <div style={{animation: 'fadeIn 0.3s'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '10px'}}>
            <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8'}}>車輛監控 #{v.id}</span>
            <button onClick={() => setSelectedVehicleId(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}>回總覽</button>
          </div>
          
          <div style={styles.kpiGrid}>
             <div style={styles.kpiBox}>
               <Gauge size={18} color="#facc15" />
               <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>車速 Speed</span>
               <span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.speed} <small>km/h</small></span>
             </div>
             <div style={styles.kpiBox}>
               <Zap size={18} color={v.power < 0 ? '#4ade80' : '#f87171'} />
               <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>功率 Power</span>
               <span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.power} <small>kW</small></span>
             </div>
             <div style={styles.kpiBox}>
               <Wind size={18} color="#a78bfa" />
               <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>風阻係數 Cd</span>
               <span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.dragCoeff}</span>
             </div>
             <div style={styles.kpiBox}>
               <Users size={18} color="#60a5fa" />
               <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>載客數 Pax</span>
               <span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.passengers}/{v.capacity}</span>
             </div>
          </div>

          <div style={{marginTop: '15px'}}>
             <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px'}}>
               <span>電池電量 (SoC)</span>
               <span style={{color: v.battery < 20 ? '#ef4444' : '#4ade80'}}>{Math.round(v.battery)}%</span>
             </div>
             <div style={{width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden'}}>
               <div style={{width: `${v.battery}%`, height: '100%', background: v.battery < 20 ? '#ef4444' : '#22c55e', transition: 'width 0.3s'}} />
             </div>
          </div>

          {/* 🔥 新增：乘客上下車動態 */}
          <div style={{marginTop: '15px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem'}}>
             <span style={{color: '#4ade80'}}>本站上車: +{v.boardedLast}</span>
             <span style={{color: '#f87171'}}>本站下車: -{v.alightedLast}</span>
          </div>
        </div>
      );
    } else {
      // 顯示全域數據
      return (
        <>
           <div style={{...styles.card, padding: '15px', borderLeft: `4px solid ${mode==='rl'?'#a855f7':'#94a3b8'}`, marginBottom: '15px'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
               <Cpu size={18} color={mode==='rl'?'#a855f7':'#94a3b8'} />
               <span style={{fontWeight: 'bold', color: '#e2e8f0'}}>AI 調度核心 (Core)</span>
             </div>
             <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>
                模式：<span style={{color: mode==='rl'?'#4ade80':'#cbd5e1'}}>{mode === 'rl' ? 'RL Agent (DQN)' : 'Baseline Rule'}</span> | 狀態：Running
             </div>
           </div>

           {/* 🔥 升級：全局 4 大 KPI 卡片 */}
           <div style={styles.kpiGrid}>
             <div style={styles.kpiBox}>
                <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>組隊比例</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#4ade80'}}>
                   {metrics.totalDist > 0 ? ((metrics.platoonDist / metrics.totalDist) * 100).toFixed(0) : 0}<small>%</small>
                </span>
             </div>
             <div style={styles.kpiBox}>
                <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>空車率</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#f87171'}}>
                   {metrics.totalDist > 0 ? ((metrics.emptyDist / metrics.totalDist) * 100).toFixed(0) : 0}<small>%</small>
                </span>
             </div>
             <div style={styles.kpiBox}>
                <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>服務效率</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8'}}>
                   {metrics.totalEnergy > 0 ? (metrics.totalServed / metrics.totalEnergy).toFixed(1) : 0}<small> p/kWh</small>
                </span>
             </div>
             <div style={styles.kpiBox}>
                <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>平均等待</span>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#eab308'}}>
                   {metrics.totalServed > 0 ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1) : 0}<small> min</small>
                </span>
             </div>
           </div>
        </>
      );
    }
  };

  return (
    <div style={styles.container}>
      <style>{`@keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      
      {/* Header */}
      <div style={styles.header}>
        <div>
           <h1 style={styles.title}>Eco-MaaS: 金門智慧觀光車隊</h1>
           <p style={{color: '#94a3b8', margin: 0}}>基於強化學習之動態調度系統 (RL-based iCPS)</p>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
           {/* 🔥 新增：模式切換按鈕 */}
           <div style={{backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', display: 'flex', border: '1px solid #334155'}}>
              <button onClick={() => setMode('baseline')} style={{border: 'none', background: mode === 'baseline' ? '#38bdf8' : 'transparent', color: mode === 'baseline' ? '#0f172a' : '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'}}>Baseline</button>
              <button onClick={() => setMode('rl')} style={{border: 'none', background: mode === 'rl' ? '#a855f7' : 'transparent', color: mode === 'rl' ? 'white' : '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'}}>RL Agent</button>
           </div>

           <div style={{backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '20px', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '1.1rem', color: '#38bdf8'}}>
             {formatTime(gameTime)}
           </div>
           <button onClick={() => setIsRunning(!isRunning)} style={{...styles.controlBtn, backgroundColor: isRunning ? '#eab308' : '#22c55e'}}>
             {isRunning ? <Pause size={20} /> : <Play size={20} />}
           </button>
           <button onClick={resetSimulation} style={{...styles.controlBtn, backgroundColor: '#475569'}}>
             <RotateCcw size={20} />
           </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={styles.mainLayout}>
        
        {/* 左側地圖區 */}
        <div style={styles.mapSection}>
          {/* 金門地圖背景 */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute', opacity: 0.2}}>
             <path d="M 80 200 Q 200 100 350 150 T 600 50 L 750 100 L 780 200 Q 700 300 650 250 T 450 350 L 400 450 L 150 480 L 50 350 Z" fill="#0f766e" />
             <circle cx="50" cy="250" r="30" fill="#0f766e" />
          </svg>

          {/* 路線軌跡 (使用真實曲線 SVG Path) */}
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute'}}>
            <path d={ROAD_PATH_SVG} fill="none" stroke="#475569" strokeWidth="3" strokeDasharray="8 4" />
          </svg>

          {/* 站點 Marker */}
          {stations.map(s => (
            <div key={s.id} 
              onClick={(e) => { e.stopPropagation(); setActiveSpot(getLoc(s.id)); }}
              style={{
                position: 'absolute', 
                left: `${(s.x / LOGICAL_WIDTH) * 100}%`, 
                top: `${(s.y / LOGICAL_HEIGHT) * 100}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'
              }}
            >
               <div style={{
                 width: '14px', height: '14px', borderRadius: '50%', 
                 backgroundColor: s.type === 'depot' ? '#eab308' : '#2dd4bf',
                 border: '2px solid white', boxShadow: '0 0 10px #2dd4bf'
               }} />
               <div style={{marginTop: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap'}}>
                 {s.name}
               </div>
               {s.type !== 'depot' && (
                 <div style={{marginTop: '2px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', color: s.queue > 10 ? '#f87171' : '#cbd5e1'}}>
                   <Users size={10} /> {s.queue}
                 </div>
               )}
            </div>
          ))}

          {/* 車輛 Marker */}
          {vehicles.map(v => (
            <div key={v.id} 
               onClick={(e) => { e.stopPropagation(); setSelectedVehicleId(v.id); }}
               style={{
                 ...styles.vehicleMarker,
                 left: `${(v.x / LOGICAL_WIDTH) * 100}%`, 
                 top: `${(v.y / LOGICAL_HEIGHT) * 100}%`,
                 transform: `translate(-50%, -50%) scale(${selectedVehicleId === v.id ? 1.3 : 1})`,
                 zIndex: selectedVehicleId === v.id ? 100 : 20
               }}
            >
               <div style={{
                 width: '36px', height: '36px', borderRadius: '8px',
                 backgroundColor: v.status === 'charging' ? '#b45309' : (v.platooning ? '#065f46' : '#1e40af'),
                 border: selectedVehicleId === v.id ? '2px solid #ffffff' : `2px solid ${v.platooning ? '#4ade80' : '#3b82f6'}`,
                 display: 'flex', justifyContent: 'center', alignItems: 'center',
                 color: 'white', fontWeight: 'bold', fontSize: '12px',
                 boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
               }}>
                 {v.id}
                 {v.platooning && <Wind size={14} style={{position: 'absolute', right: '-6px', top: '-6px', color: '#4ade80', backgroundColor: '#064e3b', borderRadius: '50%', padding: '1px'}} />}
               </div>
               <div style={{width: '36px', height: '4px', backgroundColor: '#334155', marginTop: '2px', borderRadius: '2px'}}>
                 <div style={{width: `${v.battery}%`, height: '100%', backgroundColor: v.battery < 20 ? '#ef4444' : '#22c55e'}} />
               </div>
            </div>
          ))}

          {/* 景點特色大字卡 (Overlay) */}
          {activeSpot && (
            <div style={styles.spotCard}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: activeSpot.color}}>{activeSpot.name}</span>
                <button onClick={() => setActiveSpot(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}><X size={18}/></button>
              </div>
              <div style={{height: '80px', backgroundColor: activeSpot.color, borderRadius: '8px', marginBottom: '10px', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <MapPin size={30} color="white" opacity={0.8} />
              </div>
              <p style={{fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.4', margin: 0}}>
                {activeSpot.desc}
              </p>
            </div>
          )}
        </div>

        {/* 右側數據面板 */}
        <div style={styles.sidePanel}>
          
          {/* 1. 數據監控面板 (可切換) */}
          <div style={styles.card}>
            {renderSidePanelContent()}
          </div>

          {/* 2. 全局圖表卡片 (強制高度) */}
          <div style={styles.card}>
             <h3 style={{fontSize: '1rem', color: '#94a3b8', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
               <BarChart3 size={16} /> 能耗與電量趨勢
             </h3>
             <div style={styles.chartWrapper}>
                {statsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statsHistory}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
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
                ) : (
                  <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem'}}>
                    等待模擬數據...
                  </div>
                )}
             </div>
          </div>

          {/* 3. 系統決策日誌 */}
          <div style={styles.card}>
            <h3 style={{margin: '0', fontSize: '0.9rem', color: '#94a3b8', display: 'flex', gap: '5px', alignItems: 'center'}}>
              <History size={16} /> 系統決策日誌
            </h3>
            <div style={styles.logBox}>
              {logs.length === 0 ? <span style={{fontStyle: 'italic', opacity: 0.5}}>系統待命中...</span> : 
                logs.map((l, i) => <div key={i} style={{marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px'}}>{l}</div>)
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default KinmenAdvancedSim;