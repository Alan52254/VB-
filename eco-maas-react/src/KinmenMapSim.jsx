// KinmenMapSim.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Wind, Users, BarChart3, RotateCcw, MapPin, Zap, Gauge, History, Cpu, X, BusFront, Battery, BatteryCharging } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';

const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 500;
const PLATOON_DISTANCE = 70;

const LOCATIONS = [
  { id: 'depot', name: '金城總站', x: 120, y: 280, type: 'depot', desc: '調度中心', color: '#eab308', popularity: 0.2 },
  { id: 'juguang', name: '莒光樓', x: 160, y: 360, type: 'stop', desc: '戰地地標', color: '#ef4444', popularity: 0.9 },
  { id: 'zhaishan', name: '翟山坑道', x: 130, y: 450, type: 'stop', desc: '戰備水道', color: '#6366f1', popularity: 0.7 },
  { id: 'chenggong', name: '陳景蘭洋樓', x: 380, y: 440, type: 'stop', desc: '白色洋樓', color: '#ec4899', popularity: 0.6 },
  { id: 'airport', name: '尚義機場', x: 450, y: 350, type: 'stop', desc: '交通樞紐', color: '#3b82f6', popularity: 1.0 },
  { id: 'taiwu', name: '太武山', x: 600, y: 250, type: 'stop', desc: '毋忘在莒', color: '#22c55e', popularity: 0.8 },
  { id: 'shanhou', name: '山后民俗村', x: 720, y: 120, type: 'stop', desc: '閩南聚落', color: '#f97316', popularity: 0.5 },
  { id: 'mashan', name: '馬山觀測所', x: 620, y: 50, type: 'stop', desc: '天下第一哨', color: '#a855f7', popularity: 0.6 },
  { id: 'guningtou', name: '古寧頭', x: 100, y: 80, type: 'stop', desc: '戰役紀念館', color: '#94a3b8', popularity: 0.5 },
];

// 🔥 地理歸戶邏輯 (將 9 個物理景點 映射到 6 個邏輯分區)
const ZONE_MAPPING = {
  'depot': '金城車站',      // 總站當然在金城
  'juguang': '金城車站',    // 莒光樓離金城很近
  'zhaishan': '水頭碼頭',   // 翟山坑道在西南方，歸類給水頭生活圈
  'chenggong': '山外車站',  // 陳景蘭洋樓在金湖，歸給山外
  'shanhou': '山外車站',    // 山后民俗村在金沙，併入東半島(山外)電網
  'mashan': '山外車站',     // 馬山在最北，併入東半島(山外)電網
  'airport': '金門機場',    // 獨立區域
  'taiwu': '太武山',        // 獨立區域
  'guningtou': '古寧頭'     // 獨立區域
};

const ROAD_PATH_SVG = `M 120,280 Q 140,330 160,360 L 130,450 Q 250,460 380,440 L 450,350 Q 520,300 600,250 L 720,120 L 620,50 Q 300,20 100,80 L 120,280`;
const ROUTE_SEQUENCE = ['depot', 'juguang', 'zhaishan', 'chenggong', 'airport', 'taiwu', 'shanhou', 'mashan', 'guningtou', 'depot'];

const getLoc = (id) => LOCATIONS.find(l => l.id === id);
const calcDist = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const styles = {
  container: { backgroundColor: '#0f172a', color: '#e2e8f0', height: '100%', overflowY: 'auto', fontFamily: '"Noto Sans TC", sans-serif', padding: '20px', width: '100%' },
  // 優化 Header 佈局，讓它只靠右顯示按鈕
  header: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '10px', gap: '10px' },
  mainLayout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', maxWidth: '1600px', margin: '0 auto' },
  mapSection: { gridColumn: 'span 2', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', position: 'relative', aspectRatio: '800/500', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  sidePanel: { display: 'flex', flexDirection: 'column', gap: '15px', gridColumn: 'span 1' },
  card: { backgroundColor: '#1e293b', padding: '15px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' },
  kpiBox: { backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  controlBtn: { border: 'none', borderRadius: '8px', width: 'auto', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'all 0.2s', fontSize: '0.8rem', fontWeight: 'bold' },
  vehicleMarker: { position: 'absolute', transform: 'translate(-50%, -50%)', transition: 'all 0.1s linear', zIndex: 20, cursor: 'pointer' },
  spotCard: { position: 'absolute', bottom: '20px', left: '20px', width: '260px', backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: '15px', borderRadius: '12px', border: '1px solid #475569', backdropFilter: 'blur(5px)', zIndex: 50, animation: 'slideUp 0.3s ease-out', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' },
  chartWrapper: { width: '100%', height: '180px' },
  logBox: { height: '120px', overflowY: 'auto', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid #334155', marginTop: '10px', paddingTop: '10px', fontFamily: 'monospace' }
};

const KinmenMapSim = ({ onSimulationUpdate, isRunningExternal }) => {
  const [vehicles, setVehicles] = useState([]);
  const [stations, setStations] = useState([]);
  const [gameTime, setGameTime] = useState(480);
  const isRunning = isRunningExternal !== undefined ? isRunningExternal : false;
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [activeSpot, setActiveSpot] = useState(null);
  const [statsHistory, setStatsHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [mode, setMode] = useState('rl');
  const [metrics, setMetrics] = useState({ totalEnergy: 0, totalServed: 0, totalDist: 0, platoonDist: 0, emptyDist: 0, totalWaitTime: 0 });

  // 1. Ref 解決閉包
  const latestDataRef = useRef({ vehicles: [], gameTime: 0, metrics: {}, stations: [], mode: 'rl' });

  // 2. 同步狀態
  useEffect(() => {
    latestDataRef.current = { vehicles, gameTime, metrics, stations, mode };
  }, [vehicles, gameTime, metrics, stations, mode]);

  // 初始化
  useEffect(() => { resetSimulation(); }, []);

  // 3. 數據傳送 (包含 Zone 邏輯)
  useEffect(() => {
    if (!onSimulationUpdate) return;
    const interval = setInterval(() => {
      const { vehicles, gameTime, metrics } = latestDataRef.current;

      const mappedVehicles = vehicles.map(v => {

        // --- 🔥 核心優化：最近鄰搜索算法 (Nearest Neighbor Search) ---

        // 1. 找出這台車離哪個「物理景點」最近
        let nearestLoc = LOCATIONS[0];
        let minDistance = 99999;

        LOCATIONS.forEach(loc => {
          const dist = Math.sqrt(Math.pow(v.x - loc.x, 2) + Math.pow(v.y - loc.y, 2));
          if (dist < minDistance) {
            minDistance = dist;
            nearestLoc = loc;
          }
        });

        // 2. 查表找出該景點對應的邏輯分區
        // 所有車輛都會被歸類到最近的景點所屬的分區（不會出現"移動中"）
        const detectedZone = ZONE_MAPPING[nearestLoc.id] || "移動中";

        return {
          id: `Bus-${v.id}`,
          zone: detectedZone, // 這裡傳出去的一定是 "金城車站"、"山外車站" 等六大區之一
          soc: v.battery,
          status: v.status === 'moving' ? (v.passengers > 0 ? 'Service' : 'Idle') : 'Charging',
          passengers: v.passengers
        };
      });

      onSimulationUpdate({ vehicles: mappedVehicles, gameTime, metrics });
    }, 1000);
    return () => clearInterval(interval);
  }, [onSimulationUpdate]);

  const resetSimulation = () => {
    const newVehicles = Array.from({ length: 6 }).map((_, i) => ({
      id: i, x: 120, y: 280, progress: i * 0.6, battery: 95 - (i * 5),
      status: 'moving', speed: 0, passengers: 0, capacity: 20, dragCoeff: 0.8,
      power: 0, platooning: false, totalDist: 0, aiState: 'INIT', boardedLast: 0, alightedLast: 0
    }));
    setVehicles(newVehicles);
    setStations(LOCATIONS.map(loc => ({ ...loc, queue: 0 })));
    setGameTime(480);
    setStatsHistory([]);
    setLogs([]);
    setMetrics({ totalEnergy: 0, totalServed: 0, totalDist: 0, platoonDist: 0, emptyDist: 0, totalWaitTime: 0 });
    setSelectedVehicleId(null);
    setActiveSpot(getLoc('depot'));
    addLog("System", "系統初始化完成。");
  };

  const addLog = (source, msg) => { setLogs(prev => [`[${formatTime(gameTime)}] ${source}: ${msg}`, ...prev.slice(0, 5)]); };
  const formatTime = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => { updateGameLogic(); }, 50);
    return () => clearInterval(interval);
  }, [isRunning]); // 🔥 只依賴 isRunning，避免無限循環

  // 🔥 修復方案：專門用一個 Effect 來監聽「選中的車輛」是否到站
  useEffect(() => {
    // 如果沒選車，就不動作
    if (selectedVehicleId === null) return;

    // 找到那台被選中的車
    const targetVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!targetVehicle) return;

    // 計算它現在到哪一站了
    const routeLen = ROUTE_SEQUENCE.length;
    // 使用 Math.round 比較準確抓到「附近」的站點
    const currentStopIndex = Math.round(targetVehicle.progress) % routeLen;
    const currentStopId = ROUTE_SEQUENCE[currentStopIndex];
    const stopLocation = getLoc(currentStopId);

    // 判斷車輛是否「剛好」在站點附近 (容許誤差 0.1)
    const distToStop = Math.abs(targetVehicle.progress - Math.round(targetVehicle.progress));

    // 只有當車子離站點很近，且目前的 ActiveSpot 還不是這個站點時，才更新
    if (distToStop < 0.1 && activeSpot?.id !== stopLocation?.id) {
       setActiveSpot(stopLocation);
    }
  }, [vehicles, selectedVehicleId, activeSpot]);

  // 將此函式替換原本 KinmenMapSim.jsx 裡的 updateGameLogic
  const updateGameLogic = () => {
    // 🔥 從 ref 讀取最新狀態，避免閉包問題
    const { vehicles: currentVehicles, gameTime: currentGameTime, stations: currentStations, mode: currentMode } = latestDataRef.current;

    const newTime = currentGameTime + 0.5;
    setGameTime(newTime);

    // 隨機產生乘客
    if (Math.random() < 0.2) {
      setStations(prev => prev.map(s => {
        if (s.type === 'depot') return s;
        return Math.random() < s.popularity ? { ...s, queue: s.queue + 1 } : s;
      }));
    }

    let cycleEnergy = 0, cycleDist = 0, cyclePlatoon = 0, cycleEmpty = 0, cycleServed = 0;

    // 🔥 暫存變數：先收集要更新的資料，不要直接在 map 裡面 set State
    let logBuffer = [];
    let stationUpdates = {}; // 記錄哪個站點有多少人上車 { stationId: count }

    // 使用當前的 vehicles 進行計算
    const nextVehicles = currentVehicles.map(v => {
      let { x, y, progress, battery, status, passengers, boardedLast, alightedLast } = v;
      let nextV = { ...v }; // 複製一份

      const aiAction = currentMode === 'baseline' ? 'BASELINE' : (battery < 25 ? 'CHARGE' : 'CRUISE');

      if (status === 'charging') {
        battery += 0.8;
        if (battery >= 95) {
            status = 'moving';
            logBuffer.push(`Bus #${v.id}: 充電完成。`); // 收集 Log
        }
        return { ...nextV, battery, speed: 0, power: -50, status, aiState: 'CHARGING' };
      }

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

      let isPlatooning = false;
      if (currentMode === 'rl') {
          isPlatooning = currentVehicles.some(other => other.id !== v.id && calcDist({x,y}, other) < PLATOON_DISTANCE && calcDist({x,y}, other) > 10);
      }

      const currentDragCoeff = isPlatooning ? 0.4 : 0.8;
      let baseSpeed = isPlatooning ? 0.005 : 0.004;
      if (currLoc.id === 'taiwu' || currLoc.id === 'zhaishan') baseSpeed *= 0.8;

      const loadFactor = 1 + (passengers * 0.02);
      const terrainFactor = (currLoc.id === 'taiwu') ? 1.5 : 1.0;
      const instantPower = (isPlatooning ? 12 : 20) * loadFactor * terrainFactor;
      const energyConsumed = instantPower * (50/3600/1000) * 10;
      const distMoved = baseSpeed * 100;

      battery -= energyConsumed;
      cycleEnergy += energyConsumed;
      cycleDist += distMoved;
      if (isPlatooning) cyclePlatoon += distMoved;
      if (passengers === 0) cycleEmpty += distMoved;

      let newProgress = progress + baseSpeed;
      let currentBoarded = boardedLast;
      let currentAlighted = alightedLast;

      if (Math.floor(newProgress) > Math.floor(progress)) {
        const stopId = ROUTE_SEQUENCE[Math.floor(newProgress) % routeLen];
        const stop = getLoc(stopId);

        if (stopId === 'depot' && battery < 30 && currentMode === 'rl') {
          status = 'charging';
          logBuffer.push(`AI Agent: 指令 Bus #${v.id} 返站充電。`); // 收集 Log
          passengers = 0;
        } else {
          currentAlighted = Math.floor(Math.random() * (passengers * 0.4));
          passengers -= currentAlighted;

          // 從 ref 讀取最新的 stations 狀態
          const station = currentStations.find(s => s.id === stopId);
          currentBoarded = 0;
          if (station && station.queue > 0) {
            // 簡單處理：如果同一個 tick 有多台車到站，這裡可能會搶客，但在模擬中可接受
            currentBoarded = Math.min(station.queue, v.capacity - passengers);
            passengers += currentBoarded;
            cycleServed += currentBoarded;

            // 記錄要扣掉的人數
            stationUpdates[stopId] = (stationUpdates[stopId] || 0) + currentBoarded;
          }
        }
      }

      return {
          ...nextV, x, y, progress: newProgress, battery: Math.max(0, battery),
          status, platooning: isPlatooning, dragCoeff: currentDragCoeff,
          speed: Math.round(baseSpeed * 10000), power: Math.round(instantPower),
          passengers, aiState: aiAction, boardedLast: currentBoarded, alightedLast: currentAlighted
      };
    });

    // 🔥 統一在這裡更新 State (批次處理)
    setVehicles(nextVehicles);

    if (logBuffer.length > 0) {
        logBuffer.forEach(msg => addLog("System", msg));
    }

    if (Object.keys(stationUpdates).length > 0) {
        setStations(prev => prev.map(s => {
            if (stationUpdates[s.id]) {
                return { ...s, queue: Math.max(0, s.queue - stationUpdates[s.id]) };
            }
            return s;
        }));
    }

    setMetrics(prev => ({
        totalEnergy: prev.totalEnergy + cycleEnergy,
        totalServed: prev.totalServed + cycleServed,
        totalDist: prev.totalDist + cycleDist,
        platoonDist: prev.platoonDist + cyclePlatoon,
        emptyDist: prev.emptyDist + cycleEmpty,
        totalWaitTime: prev.totalWaitTime + (currentStations.reduce((acc,s)=>acc+s.queue,0) * 0.5)
    }));

    if (Math.floor(newTime) % 5 === 0) {
      const avgSoC = nextVehicles.reduce((acc, v) => acc + v.battery, 0) / nextVehicles.length;
      setStatsHistory(prev => {
          const newData = [...prev, { time: formatTime(newTime), avgSoC: Math.round(avgSoC), energy: Math.round(metrics.totalEnergy + cycleEnergy) }];
          return newData.slice(-40);
      });
    }
  };

  const renderSidePanelContent = () => {
    if (selectedVehicleId !== null) {
      const v = vehicles.find(v => v.id === selectedVehicleId);
      if (!v) return null;
      return (
        <div style={{animation: 'fadeIn 0.3s'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '10px'}}>
            <span style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8'}}>車輛監控 #{v.id}</span>
            <button onClick={() => setSelectedVehicleId(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}>回總覽</button>
          </div>
          <div style={styles.kpiGrid}>
             <div style={styles.kpiBox}><Gauge size={18} color="#facc15" /><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>車速</span><span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.speed}</span></div>
             <div style={styles.kpiBox}><Zap size={18} color={v.power < 0 ? '#4ade80' : '#f87171'} /><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>功率</span><span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.power}</span></div>
             <div style={styles.kpiBox}><Wind size={18} color="#a78bfa" /><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>風阻</span><span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.dragCoeff}</span></div>
             <div style={styles.kpiBox}><Users size={18} color="#60a5fa" /><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>載客</span><span style={{fontSize: '1.1rem', fontWeight: 'bold'}}>{v.passengers}</span></div>
          </div>
          <div style={{marginTop: '15px'}}><div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '5px'}}><span>電池 SoC</span><span style={{color: v.battery < 20 ? '#ef4444' : '#4ade80'}}>{Math.round(v.battery)}%</span></div><div style={{width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden'}}><div style={{width: `${v.battery}%`, height: '100%', background: v.battery < 20 ? '#ef4444' : '#22c55e', transition: 'width 0.3s'}} /></div></div>
        </div>
      );
    } else {
      return (
        <>
           <div style={{...styles.card, padding: '15px', borderLeft: `4px solid ${mode==='rl'?'#a855f7':'#94a3b8'}`, marginBottom: '15px'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}><Cpu size={18} color={mode==='rl'?'#a855f7':'#94a3b8'} /><span style={{fontWeight: 'bold', color: '#e2e8f0'}}>AI 核心</span></div>
             <div style={{fontSize: '0.8rem', color: '#94a3b8'}}>模式：<span style={{color: mode==='rl'?'#4ade80':'#cbd5e1'}}>{mode === 'rl' ? 'RL Agent' : 'Baseline'}</span></div>
           </div>
           <div style={styles.kpiGrid}>
             <div style={styles.kpiBox}><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>組隊率</span><span style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80'}}>{metrics.totalDist > 0 ? ((metrics.platoonDist / metrics.totalDist) * 100).toFixed(0) : 0}%</span></div>
             <div style={styles.kpiBox}><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>空車率</span><span style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#f87171'}}>{metrics.totalDist > 0 ? ((metrics.emptyDist / metrics.totalDist) * 100).toFixed(0) : 0}%</span></div>
             <div style={styles.kpiBox}><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>效率</span><span style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8'}}>{metrics.totalEnergy > 0 ? (metrics.totalServed / metrics.totalEnergy).toFixed(1) : 0}</span></div>
             <div style={styles.kpiBox}><span style={{fontSize: '0.75rem', color: '#94a3b8'}}>等待</span><span style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308'}}>{metrics.totalServed > 0 ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1) : 0}m</span></div>
           </div>
        </>
      );
    }
  };

  return (
    <div style={styles.container}>
      {/* Header 只保留控制項 */}
      <div style={styles.header}>
        <div style={{backgroundColor: '#1e293b', padding: '4px', borderRadius: '8px', display: 'flex', border: '1px solid #334155'}}>
            <button onClick={() => setMode('baseline')} style={{border: 'none', background: mode === 'baseline' ? '#38bdf8' : 'transparent', color: mode === 'baseline' ? '#0f172a' : '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'}}>Baseline</button>
            <button onClick={() => setMode('rl')} style={{border: 'none', background: mode === 'rl' ? '#a855f7' : 'transparent', color: mode === 'rl' ? 'white' : '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'}}>RL Agent</button>
        </div>
        <div style={{backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '1rem', color: '#38bdf8'}}>
            {formatTime(gameTime)}
        </div>
        <button onClick={resetSimulation} style={{...styles.controlBtn, backgroundColor: '#475569'}}><RotateCcw size={18} /></button>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.mapSection}>
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute', opacity: 0.2}}>
             <path d="M 80 200 Q 200 100 350 150 T 600 50 L 750 100 L 780 200 Q 700 300 650 250 T 450 350 L 400 450 L 150 480 L 50 350 Z" fill="#0f766e" />
             <circle cx="50" cy="250" r="30" fill="#0f766e" />
          </svg>
          <svg width="100%" height="100%" viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`} preserveAspectRatio="none" style={{position: 'absolute'}}>
            <path d={ROAD_PATH_SVG} fill="none" stroke="#475569" strokeWidth="3" strokeDasharray="8 4" />
          </svg>

          {stations.map(s => (
            <div key={s.id} onClick={(e) => { e.stopPropagation(); setActiveSpot(getLoc(s.id)); }} style={{ position: 'absolute', left: `${(s.x / LOGICAL_WIDTH) * 100}%`, top: `${(s.y / LOGICAL_HEIGHT) * 100}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
               <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: s.type === 'depot' ? '#eab308' : '#2dd4bf', border: '2px solid white', boxShadow: '0 0 10px #2dd4bf' }} />
               <div style={{marginTop: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap'}}>{s.name}</div>
               {s.type !== 'depot' && s.queue > 0 && <div style={{marginTop: '2px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', color: '#f87171'}}><Users size={10} /> {s.queue}</div>}
            </div>
          ))}

          {/* ✅ 第二階段:加上車號與詳細數據標籤 */}
          {vehicles.map(v => {
            // 決定顏色邏輯
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
                  gap: '2px', // 讓元件之間有一點點空隙
                  transition: 'all 0.1s linear' // 讓移動更滑順
                }}
              >
                {/* 1. 頭頂車號 (Badge) */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)', // 深色半透明背景
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

                {/* 2. 巴士主體 (維持上一階段的設計) */}
                <div style={{
                    position: 'relative',
                    padding: '6px',
                    borderRadius: '12px',
                    backgroundColor: mainColor,
                    boxShadow: `0 0 15px ${mainColor}80`, // 讓光暈更明顯一點
                    border: selectedVehicleId === v.id ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                }}>
                    {/* 如果是充電中,顯示閃電圖示,否則顯示巴士 */}
                    {isCharging ? <Zap size={20} color="white" fill="white" /> : <BusFront size={20} color="white" strokeWidth={2} />}

                    {/* 組隊標記 */}
                    {v.platooning && (
                       <div style={{position: 'absolute', top: -4, right: -4, backgroundColor: '#064e3b', borderRadius: '50%', padding: '2px', border: '1px solid #10b981'}}>
                         <Wind size={10} color="#10b981" />
                       </div>
                    )}
                </div>

                {/* 3. 腳下資訊列 (新功能!) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', // 深黑背景
                  padding: '2px 6px',
                  borderRadius: '6px',
                  marginTop: '2px',
                  border: '1px solid #334155',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                }}>
                  {/* 載客數 */}
                  <div style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                    <Users size={10} color="#94a3b8" />
                    <span style={{fontSize: '9px', fontWeight: 'bold', color: '#f1f5f9'}}>{Math.round(v.passengers)}</span>
                  </div>

                  {/* 分隔線 */}
                  <div style={{width: '1px', height: '8px', backgroundColor: '#475569'}}></div>

                  {/* 電量 */}
                  <div style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
                    {/* 根據狀態顯示不同電池圖示 */}
                    {isCharging ? <BatteryCharging size={10} color="#fbbf24" /> : <Battery size={10} color={batteryColor} />}
                    <span style={{fontSize: '9px', fontWeight: 'bold', color: batteryColor}}>{Math.round(v.battery)}%</span>
                  </div>
                </div>

              </div>
            );
          })}

          {activeSpot && (
            <div style={styles.spotCard}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}><span style={{fontSize: '1.2rem', fontWeight: 'bold', color: activeSpot.color}}>{activeSpot.name}</span><button onClick={() => setActiveSpot(null)} style={{background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer'}}><X size={18}/></button></div>
              <div style={{height: '80px', backgroundColor: activeSpot.color, borderRadius: '8px', marginBottom: '10px', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><MapPin size={30} color="white" opacity={0.8} /></div>
              <p style={{fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.4', margin: 0}}>{activeSpot.desc}</p>
            </div>
          )}
        </div>

        <div style={styles.sidePanel}>
          <div style={styles.card}>{renderSidePanelContent()}</div>
          <div style={styles.card}>
             <h3 style={{fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px'}}><BarChart3 size={16} /> 能耗趨勢</h3>
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
                      <Area yAxisId="left" type="monotone" dataKey="avgSoC" stroke="#4ade80" fill="url(#colorEnergy)" />
                      <Line yAxisId="right" type="monotone" dataKey="energy" stroke="#f87171" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.8rem'}}>等待數據...</div>}
             </div>
          </div>
          <div style={styles.card}>
            <h3 style={{margin: '0', fontSize: '0.9rem', color: '#94a3b8', display: 'flex', gap: '5px', alignItems: 'center'}}><History size={16} /> 決策日誌</h3>
            <div style={styles.logBox}>
              {logs.length === 0 ? <span style={{fontStyle: 'italic', opacity: 0.5}}>...</span> : logs.map((l, i) => <div key={i} style={{marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px'}}>{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KinmenMapSim;
