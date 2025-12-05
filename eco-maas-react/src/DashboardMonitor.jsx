// DashboardMonitor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  Activity, BatteryCharging, Wind, Users, Cpu, Zap, MapPin, RotateCcw, ShieldCheck, Clock, Layers, Car, Leaf, Smartphone, TrendingDown
} from 'lucide-react';
import AIChatWidget from './AIChatWidget'; // 👈 新增這行

// --- 參數設定 ---
const ZONES = ["金城車站", "山外車站", "水頭碼頭", "金門機場", "古寧頭", "太武山"];
const AGGREGATION_INTERVAL = 10;

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
  const scrollContainerRef = useRef(null); // 用來抓取捲動容器

  // ✅ 智慧滾動邏輯
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 判斷使用者是否「正在看歷史紀錄」(即卷軸不在最底部)
    // 容許 50px 的誤差
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    if (isAtBottom) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  // --- 核心邏輯：接收外部數據 ---
  useEffect(() => {
    if (!externalData) return;
    const { vehicles, gameTime, metrics, logs } = externalData; // 🔥 接收 logs

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

    // 🔥 接收來自 KinmenMapSim 的真實電網數據
    if (metrics && metrics.gridInfo) {
      // 更新風力場景（根據電網狀態）
      let currentScenario = "供需平衡";
      if (metrics.gridInfo.status === 'GREEN') currentScenario = "綠能充沛";
      else if (metrics.gridInfo.status === 'PEAK') currentScenario = "尖峰負載";
      setWindScenario(currentScenario);

      // 更新電網數據圖表（每 2 步更新一次以減少渲染）
      if (currentStep % 2 === 0) {
        setEnergyData(prev => {
          const newData = [
            ...prev,
            {
              time: currentStep,
              // 太陽能發電 (對應原本的 windSupply) - 🔥 轉成數字避免 Recharts 渲染錯誤
              windSupply: Number(metrics.gridInfo.solar.toFixed(1)),
              // 電網負載 - 🔥 轉成數字避免 Recharts 渲染錯誤
              gridLoad: Number(metrics.gridInfo.load.toFixed(1))
            }
          ];
          // 保持最近 40 筆數據
          if (newData.length > 40) return newData.slice(newData.length - 40);
          return newData;
        });
      }
    }

    // 更新 KPI
    if (metrics && vehicles.length > 0) {
      const idleCount = vehicles.filter(v => v.status === 'Idle' || v.status !== 'Service').length;
      const totalPassengers = vehicles.reduce((acc, v) => acc + (v.passengers || 0), 0);
      const gridInfo = metrics.gridInfo || { solar: 0, load: 50, status: 'NORMAL' };

      setKpiStats({
        avgWaitTime: metrics.totalWaitTime && metrics.totalServed > 0 ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1) : '15.2',
        energySaving: metrics.platoonDist && metrics.totalDist > 0 ? ((metrics.platoonDist / metrics.totalDist) * 40).toFixed(1) : '0',
        emptyRate: ((idleCount / vehicles.length) * 100).toFixed(1),
        gridBalanceScore: (80 + (gridInfo.status === 'GREEN' ? 10 : 0) - (gridInfo.status === 'PEAK' ? 5 : 0)).toFixed(0),
        carpoolRatio: (1 + totalPassengers / vehicles.length).toFixed(2),
        greenEnergyUsage: gridInfo.solar.toFixed(1)
      });
    }

    // 🔥 同步日誌 (如果外部有傳 logs 進來)
    if (logs) {
      setAgentLogs(logs);
    }
  }, [externalData]);

  // --- 🌳 碳排放與易讀指標換算 ---
  // 1. 計算節省的度數 (Baseline - RL)
  const currentEnergy = externalData?.metrics?.totalEnergy || 0;
  const baselineEnergy = externalData?.metrics?.totalEnergyBaseline || currentEnergy * 1.2; // fallback

  const savedKwh = Math.max(0, baselineEnergy - currentEnergy);
  const kgCO2 = savedKwh * 0.495; // 台灣電力排碳係數

  // 2. 換算成「有感物品」
  const treesPlanted = (kgCO2 / 10).toFixed(2); // 相當於幾棵樹 (年吸碳量)
  const smartphoneCharges = Math.floor(savedKwh * 60); // 手機充電次數 (1度電充60次)
  const savingsRate = baselineEnergy > 0 ? ((savedKwh / baselineEnergy) * 100).toFixed(1) : 0;

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

          {/* 升級版：減碳貢獻卡片 */}
          <div className="col-span-2 bg-gradient-to-br from-emerald-900/50 to-slate-900 p-3 rounded-xl border border-emerald-700/50 flex flex-col justify-between relative overflow-hidden group hover:from-emerald-900/70 transition-all">
            {/* 背景裝飾圖示 */}
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Leaf size={60} />
            </div>

            <div className="flex justify-between items-start mb-1 z-10">
              <span className="text-[10px] text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12}/> 減碳貢獻
              </span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-900/80 px-2 py-0.5 rounded">
                -{kgCO2.toFixed(1)} kg CO₂
              </span>
            </div>

            <div className="z-10">
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-white">{treesPlanted}</span>
                <span className="text-xs text-emerald-400 mb-1">棵樹 🌲</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                ≈ 手機充電 {smartphoneCharges.toLocaleString()} 次 📱
              </div>
            </div>
          </div>

          <KpiCard icon={Users} label="平均等待" value={`${kpiStats.avgWaitTime}m`} sub="服務水準" color="text-blue-400" />
          <KpiCard icon={BatteryCharging} label="電網平衡分" value={kpiStats.gridBalanceScore} sub="V2G 貢獻" color="text-purple-400" />
          <KpiCard icon={RotateCcw} label="空車率" value={`${kpiStats.emptyRate}%`} sub="資源閒置" color="text-red-400" />
          <KpiCard icon={Users} label="組隊比例" value={kpiStats.carpoolRatio} sub="平均載客" color="text-cyan-400" />
        </div>

        {/* 永續影響力指標 - 讓數據說人話 */}
        <div className="col-span-12 bg-gradient-to-br from-emerald-900/30 to-green-900/20 p-4 rounded-xl border border-emerald-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="text-emerald-400" size={18} />
            <h3 className="text-sm font-semibold text-emerald-300">永續影響力 - AI 優化成效</h3>
            <div className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
              <TrendingDown size={14} />
              <span className="font-mono">{savingsRate}% 能耗降低</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 節省電力 */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="text-yellow-400" size={14} />
                <span className="text-[10px] text-slate-400 uppercase">節省電力</span>
              </div>
              <div className="text-2xl font-bold text-yellow-300">{savedKwh.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">度 (kWh)</div>
            </div>

            {/* 減碳量 */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Wind className="text-cyan-400" size={14} />
                <span className="text-[10px] text-slate-400 uppercase">減少碳排</span>
              </div>
              <div className="text-2xl font-bold text-cyan-300">{kgCO2.toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">kg CO₂e</div>
            </div>

            {/* 相當於種樹 */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Leaf className="text-green-400" size={14} />
                <span className="text-[10px] text-slate-400 uppercase">相當於種樹</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{treesPlanted}</div>
              <div className="text-[10px] text-slate-500">棵 (年吸碳量)</div>
            </div>

            {/* 手機充電次數 */}
            <div className="bg-slate-900/50 p-3 rounded-lg border border-emerald-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="text-blue-400" size={14} />
                <span className="text-[10px] text-slate-400 uppercase">可充手機</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">{smartphoneCharges}</div>
              <div className="text-[10px] text-slate-500">次 (完整充電)</div>
            </div>
          </div>
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2"><Zap size={16} /> 微電網供需動態</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={energyData}>
                  <defs>
                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" tick={{fontSize: 10}} label={{ value: 'Time (min)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{fontSize: 10}} label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="windSupply" name="太陽能發電" stroke="#facc15" fillOpacity={1} fill="url(#colorSolar)" strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="gridLoad" name="電網負載" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLoad)" strokeWidth={2} isAnimationActive={false} />
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

          {/* ===== Agent 決策日誌 (暫時隱藏) ===== */}
          {/* <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700/50 flex-1 flex flex-col min-h-[200px]">
            <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider border-b border-slate-700 pb-2">
              <Terminal size={14} /> AI 決策串流
            </h3>
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto pr-2 font-mono text-xs space-y-2"
            >
              {agentLogs.length === 0 && <div className="text-slate-600 italic text-center mt-4">等待決策數據...</div>}

              {agentLogs.map((log) => {
                // 根據類別決定顏色
                let borderColor = 'border-slate-600';
                let textColor = 'text-slate-300';
                let prefix = 'SYS';

                if (log.category === 'AI') {
                  borderColor = 'border-purple-500';
                  textColor = 'text-purple-300';
                  prefix = 'RL-AGENT';
                } else if (log.category === 'WARN') {
                  borderColor = 'border-yellow-500';
                  textColor = 'text-yellow-300';
                  prefix = 'ALERT';
                }

                return (
                  <div key={log.id} className={`border-l-2 ${borderColor} pl-2 py-1 bg-slate-800/30 rounded-r-md`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`font-bold ${textColor} text-[10px]`}>{prefix}</span>
                      <span className="text-[9px] text-slate-500">{log.time}</span>
                    </div>
                    <div className="text-slate-300 leading-tight">
                      {log.message}
                    </div>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div> */}
        </div>
      </main>
      {/* 🤖 新增：AI 聊天機器人 (浮動在右下角) */}
      <AIChatWidget externalData={externalData} />
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
