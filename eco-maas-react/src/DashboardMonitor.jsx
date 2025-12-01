// DashboardMonitor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  Activity, BatteryCharging, Wind, Users, Cpu, Zap, MapPin, RotateCcw, Terminal, ShieldCheck, Clock, Layers, Car
} from 'lucide-react';

// --- 參數設定 ---
const ZONES = ["金城車站", "山外車站", "水頭碼頭", "金門機場", "古寧頭", "太武山"];
const AGGREGATION_INTERVAL = 10;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomFloat = (min, max) => Math.random() * (max - min) + min;

const DashboardMonitor = ({ externalData }) => {
  // --- State ---
  const [step, setStep] = useState(0);
  const [globalEpoch, setGlobalEpoch] = useState(0);
  const [trainingMetrics, setTrainingMetrics] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [kpiStats, setKpiStats] = useState({
    avgWaitTime: 15.2, energySaving: 0, emptyRate: 45, gridBalanceScore: 80, carpoolRatio: 1.2, greenEnergyUsage: 30
  });
  const [windScenario, setWindScenario] = useState("中風能");
  const logEndRef = useRef(null);

  // 自動捲動 Log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  // --- 核心邏輯：接收外部數據 ---
  useEffect(() => {
    if (!externalData) return;
    const { vehicles, gameTime, metrics } = externalData;

    const currentStep = Math.floor(gameTime);
    setStep(currentStep);

    if (currentStep % AGGREGATION_INTERVAL === 0 && currentStep > 0) {
      setGlobalEpoch(prev => prev + 1);
    }

    // 模擬 FRL 訓練圖表
    if (currentStep % 5 === 0) {
      const decay = Math.exp(-currentStep / 200);
      const actorLoss = 2.5 * decay + randomFloat(-0.2, 0.2);
      const criticLoss = 1.5 * decay + randomFloat(-0.1, 0.1);
      const reward = -100 * decay + 50 + randomFloat(-10, 20);

      setTrainingMetrics(prev => {
        const newHistory = [...prev, { step: currentStep, actorLoss: Math.max(0, actorLoss).toFixed(4), criticLoss: Math.max(0, criticLoss).toFixed(4), reward: reward.toFixed(2) }];
        if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
        return newHistory;
      });
    }

    // 模擬環境風力
    const windBase = 50 + 40 * Math.sin(currentStep * 0.1);
    const currentWind = Math.max(0, Math.min(100, windBase + randomInt(-10, 10)));
    let currentScenario = "中風能";
    if (currentWind > 80) currentScenario = "高風能";
    else if (currentWind < 30) currentScenario = "低風能";
    setWindScenario(currentScenario);

    // 模擬電網數據
    if (currentStep % 2 === 0) {
      const avgSoc = vehicles.reduce((acc, v) => acc + v.soc, 0) / (vehicles.length || 1);
      setEnergyData(prev => {
        const newData = [...prev, { time: currentStep, windSupply: currentWind.toFixed(1), fleetDemand: (vehicles.length * 2 - avgSoc * 0.5).toFixed(1), gridLoad: (60 + 20 * Math.sin(currentStep * 0.2)).toFixed(1) }];
        if (newData.length > 30) return newData.slice(newData.length - 30);
        return newData;
      });
    }

    // 更新 KPI
    if (metrics && vehicles.length > 0) {
      const idleCount = vehicles.filter(v => v.status === 'Idle' || v.status !== 'Service').length;
      const totalPassengers = vehicles.reduce((acc, v) => acc + (v.passengers || 0), 0);

      setKpiStats({
        avgWaitTime: metrics.totalWaitTime && metrics.totalServed > 0 ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1) : '15.2',
        energySaving: metrics.platoonDist && metrics.totalDist > 0 ? ((metrics.platoonDist / metrics.totalDist) * 40).toFixed(1) : '0',
        emptyRate: ((idleCount / vehicles.length) * 100).toFixed(1),
        gridBalanceScore: (80 + (currentWind > 80 ? 10 : 0) - (currentWind < 30 ? 5 : 0)).toFixed(0),
        carpoolRatio: (1 + totalPassengers / vehicles.length).toFixed(2),
        greenEnergyUsage: (currentWind * 0.6).toFixed(1)
      });
    }
  }, [externalData]);

  const displayVehicles = externalData ? externalData.vehicles : [];

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 font-sans p-4 flex flex-col gap-4">

      {/* 頂部數據列 (取代原本的大標題) */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
           <Activity className="text-cyan-400" size={20} />
           <span className="text-sm text-slate-300 font-mono">Algorithm: <span className="text-cyan-300">PPO + FedBuff</span></span>
           <span className="text-slate-600">|</span>
           <span className="text-sm text-slate-300 font-mono">Privacy: <span className="text-emerald-400">DP-SGD Enabled</span></span>
        </div>

        {/* 三個小卡片顯示核心狀態 */}
        <div className="col-span-4 lg:col-span-1 bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 flex gap-1"><Clock size={10}/> Sim Time</span>
            <span className="text-lg font-mono font-bold text-cyan-300">{step} <span className="text-xs">min</span></span>
        </div>
        <div className="col-span-4 lg:col-span-1 bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 flex gap-1"><Layers size={10}/> Epoch</span>
            <span className="text-lg font-mono font-bold text-purple-400">{globalEpoch}</span>
        </div>
        <div className="col-span-4 lg:col-span-2 bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 flex gap-1"><Car size={10}/> Active Fleet</span>
            <span className="text-lg font-mono font-bold text-green-400">{displayVehicles.length} <span className="text-xs">vehs</span></span>
        </div>
      </div>

      <main className="grid grid-cols-12 gap-4">
        {/* KPI 卡片區 */}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={Wind} label="綠能使用率" value={`${kpiStats.greenEnergyUsage}%`} sub={windScenario} color="text-green-400" />
          <KpiCard icon={Zap} label="節能效率" value={`${kpiStats.energySaving}%`} sub="vs Baseline" color="text-yellow-400" />
          <KpiCard icon={Users} label="平均等待" value={`${kpiStats.avgWaitTime}m`} sub="服務水準" color="text-blue-400" />
          <KpiCard icon={BatteryCharging} label="電網平衡分" value={kpiStats.gridBalanceScore} sub="V2G 貢獻" color="text-purple-400" />
          <KpiCard icon={RotateCcw} label="空車率" value={`${kpiStats.emptyRate}%`} sub="資源閒置" color="text-red-400" />
          <KpiCard icon={Users} label="組隊比例" value={kpiStats.carpoolRatio} sub="平均載客" color="text-cyan-400" />
        </div>

        {/* 圖表區 */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 h-[250px]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2"><Activity size={16} /> FRL 訓練收斂 (Loss/Reward)</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trainingMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="step" stroke="#94a3b8" tick={{fontSize: 10}} />
                  <YAxis yAxisId="left" stroke="#ef4444" tick={{fontSize: 10}} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px' }} itemStyle={{ color: '#f1f5f9' }} />
                  <Line yAxisId="left" type="monotone" dataKey="actorLoss" stroke="#ef4444" dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="reward" stroke="#10b981" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 h-[250px]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2"><Wind size={16} /> 微電網供需預測</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energyData}>
                  <defs>
                    <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{fontSize: 10}} />
                  <YAxis stroke="#94a3b8" tick={{fontSize: 10}} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="windSupply" stroke="#06b6d4" fillOpacity={1} fill="url(#colorWind)" />
                  <Area type="monotone" dataKey="gridLoad" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLoad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 狀態與 Log 區 */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {/* 即時車隊分佈 (這裡需要 KinmenMapSim 傳送正確的 Zone 名稱) */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 min-h-[300px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300"><MapPin size={16} /> 即時車隊分佈 (Zone Distribution)</h3>
              <div className="flex gap-2 text-[10px]">
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Service</span>
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">Charging</span>
                <span className="px-2 py-1 rounded bg-slate-700 text-slate-400">Idle</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ZONES.map(zone => {
                const vehiclesInZone = displayVehicles.filter(v => v.zone === zone);
                return (
                  <div key={zone} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-300">{zone}</span>
                      <span className="text-xs text-slate-500">{vehiclesInZone.length} 輛</span>
                    </div>
                    <div className="flex flex-wrap gap-1 min-h-[16px]">
                      {vehiclesInZone.map(v => (
                        <div key={v.id} className={`w-2 h-2 rounded-full ${v.status === 'Service' ? 'bg-emerald-400' : v.status === 'Charging' ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} title={v.id} />
                      ))}
                    </div>
                    <div className="mt-2 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500/50" style={{ width: `${Math.min(100, vehiclesInZone.length * 15 + 10)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1 flex flex-col font-mono h-[200px]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2 border-b border-slate-800 pb-2"><Terminal size={16} /> Agent 決策日誌</h3>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2 text-xs">
              {agentLogs.length === 0 && <div className="text-slate-600 italic">等待決策數據...</div>}
              {agentLogs.map((log) => (
                <div key={log.id} className="flex gap-2"><span>{log.action}</span></div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col justify-between hover:bg-slate-800/80 transition-colors">
    <div className="flex justify-between items-start mb-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
      <Icon size={14} className={color} />
    </div>
    <div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  </div>
);

export default DashboardMonitor;
