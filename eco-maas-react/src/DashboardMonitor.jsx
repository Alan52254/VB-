import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  Activity,
  Battery,
  BatteryCharging,
  Wind,
  Users,
  Server,
  Cpu,
  Zap,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Terminal,
  ShieldCheck
} from 'lucide-react';

// --- 模擬參數與常數 ---
const ZONES = ["金城車站", "山外車站", "水頭碼頭", "金門機場", "古寧頭", "太武山"];
const AGGREGATION_INTERVAL = 10; // 每10個 Step 進行一次聯邦聚合
const WIND_SCENARIOS = ["高風能", "中風能", "低風能", "極端無風"];

// --- 輔助函式：產生隨機數據 ---
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// 1. 接收 externalData
const DashboardMonitor = ({ externalData }) => {
  // --- State 管理 ---
  const [step, setStep] = useState(0);
  const [globalEpoch, setGlobalEpoch] = useState(0);
  
  // 數據集 State (保留 UI 相關的 state)
  const [trainingMetrics, setTrainingMetrics] = useState([]);
  const [energyData, setEnergyData] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [kpiStats, setKpiStats] = useState({
    avgWaitTime: 15.2,
    energySaving: 0,
    emptyRate: 45,
    gridBalanceScore: 80,
    carpoolRatio: 1.2,
    greenEnergyUsage: 30
  });
  const [windScenario, setWindScenario] = useState("中風能");

  // 滾動日誌參考
  const logEndRef = useRef(null);

  // --- 自動滾動日誌 ---
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  // 2. 監聽 externalData 的變化，更新儀表板數據
  useEffect(() => {
    if (!externalData) return;

    const { vehicles, gameTime, metrics } = externalData;

    // 更新 step (使用 gameTime 作為 step)
    const currentStep = Math.floor(gameTime);
    setStep(currentStep);

    // 每10步更新一次全局 epoch
    if (currentStep % AGGREGATION_INTERVAL === 0 && currentStep > 0) {
      setGlobalEpoch(prev => prev + 1);
    }

    // 更新訓練指標歷史 (每5分鐘記錄一次)
    if (currentStep % 5 === 0) {
      const decay = Math.exp(-currentStep / 200);
      const actorLoss = 2.5 * decay + randomFloat(-0.2, 0.2);
      const criticLoss = 1.5 * decay + randomFloat(-0.1, 0.1);
      const reward = -100 * decay + 50 + randomFloat(-10, 20);

      const newMetric = {
        step: currentStep,
        actorLoss: Math.max(0, actorLoss).toFixed(4),
        criticLoss: Math.max(0, criticLoss).toFixed(4),
        reward: reward.toFixed(2),
      };

      setTrainingMetrics(prev => {
        const newHistory = [...prev, newMetric];
        if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
        return newHistory;
      });
    }

    // 計算風力情境 (基於時間模擬)
    const windBase = 50 + 40 * Math.sin(currentStep * 0.1);
    const currentWind = Math.max(0, Math.min(100, windBase + randomInt(-10, 10)));
    let currentScenario = "中風能";
    if (currentWind > 80) currentScenario = "高風能";
    else if (currentWind < 30) currentScenario = "低風能";
    setWindScenario(currentScenario);

    // 更新能量供需圖表
    if (currentStep % 2 === 0) {
      const avgSoc = vehicles.reduce((acc, v) => acc + v.soc, 0) / (vehicles.length || 1);
      const newEnergyData = {
        time: currentStep,
        windSupply: currentWind.toFixed(1),
        fleetDemand: (vehicles.length * 2 - avgSoc * 0.5).toFixed(1),
        gridLoad: (60 + 20 * Math.sin(currentStep * 0.2)).toFixed(1)
      };

      setEnergyData(prev => {
        const newData = [...prev, newEnergyData];
        if (newData.length > 30) return newData.slice(newData.length - 30);
        return newData;
      });
    }

    // 更新 KPI 統計 (使用真實的 metrics 數據)
    if (metrics && vehicles.length > 0) {
      const idleCount = vehicles.filter(v => v.status === 'Idle' || v.status !== 'Service').length;
      const totalPassengers = vehicles.reduce((acc, v) => acc + (v.passengers || 0), 0);

      setKpiStats({
        avgWaitTime: metrics.totalWaitTime && metrics.totalServed > 0
          ? (metrics.totalWaitTime / metrics.totalServed).toFixed(1)
          : '15.2',
        energySaving: metrics.platoonDist && metrics.totalDist > 0
          ? ((metrics.platoonDist / metrics.totalDist) * 40).toFixed(1)
          : '0',
        emptyRate: ((idleCount / vehicles.length) * 100).toFixed(1),
        gridBalanceScore: (80 + (currentWind > 80 ? 10 : 0) - (currentWind < 30 ? 5 : 0)).toFixed(0),
        carpoolRatio: (1 + totalPassengers / vehicles.length).toFixed(2),
        greenEnergyUsage: (currentWind * 0.6).toFixed(1)
      });
    }

  }, [externalData]);

  // 3. 使用 externalData 的車輛資料
  const displayVehicles = externalData ? externalData.vehicles : [];

  // --- 顏色配置 ---
  const colors = {
    primary: "#06b6d4", // Cyan
    secondary: "#8b5cf6", // Violet
    success: "#10b981", // Emerald
    warning: "#f59e0b", // Amber
    danger: "#ef4444", // Red
    background: "#0f172a", // Slate 900
    card: "#1e293b", // Slate 800
    text: "#f1f5f9" // Slate 100
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 overflow-hidden flex flex-col">

      {/* --- Header --- */}
      <header className="flex justify-between items-center mb-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Activity className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              金門 Eco-MaaS 聯邦式強化學習監控儀表板
            </h1>
            <div className="flex gap-4 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1"><Server size={12}/> 架構: 階層式雲-邊-端 FRL</span>
              <span className="flex items-center gap-1"><Cpu size={12}/> 算法: PPO + FedBuff</span>
              <span className="flex items-center gap-1"><ShieldCheck size={12}/> 隱私保護: 啟用 (DP-SGD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-400">Simulation Time</div>
            <div className="font-mono text-xl text-cyan-300">{step.toLocaleString()} min</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Global Epoch</div>
            <div className="font-mono text-xl text-purple-400">{globalEpoch}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Active Vehicles</div>
            <div className="font-mono text-xl text-green-400">{displayVehicles.length}</div>
          </div>
        </div>
      </header>

      {/* --- Main Grid Layout --- */}
      <main className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-y-auto">
        
        {/* --- Top KPI Row (橫跨) --- */}
        <div className="col-span-12 grid grid-cols-6 gap-4">
          <KpiCard icon={Wind} label="綠能使用率" value={`${kpiStats.greenEnergyUsage}%`} sub={windScenario} color="text-green-400" />
          <KpiCard icon={Zap} label="節能效率" value={`${kpiStats.energySaving}%`} sub="vs Baseline" color="text-yellow-400" />
          <KpiCard icon={Users} label="平均等待" value={`${kpiStats.avgWaitTime}m`} sub="服務水準" color="text-blue-400" />
          <KpiCard icon={BatteryCharging} label="電網平衡分" value={kpiStats.gridBalanceScore} sub="V2G 貢獻" color="text-purple-400" />
          <KpiCard icon={RotateCcw} label="空車率" value={`${kpiStats.emptyRate}%`} sub="資源閒置" color="text-red-400" />
          <KpiCard icon={Users} label="組隊比例" value={kpiStats.carpoolRatio} sub="平均載客" color="text-cyan-400" />
        </div>

        {/* --- Left Column: FRL Metrics & Energy (5/12) --- */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* FRL Training Chart */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex-1 min-h-[250px]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-4">
              <Activity size={16} /> FRL 訓練收斂指標 (Loss & Reward)
            </h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trainingMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="step" stroke="#94a3b8" tick={{fontSize: 10}} />
                  <YAxis yAxisId="left" stroke="#ef4444" tick={{fontSize: 10}} label={{ value: 'Loss', angle: -90, position: 'insideLeft', fill: '#ef4444' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{fontSize: 10}} label={{ value: 'Reward', angle: 90, position: 'insideRight', fill: '#10b981' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px' }}
                    itemStyle={{ color: '#f1f5f9' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="actorLoss" stroke="#ef4444" dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="reward" stroke="#10b981" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Energy Grid Chart */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex-1 min-h-[250px]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-4">
              <Wind size={16} /> 微電網供需與風力情境樹預測
            </h3>
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
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="windSupply" stroke="#06b6d4" fillOpacity={1} fill="url(#colorWind)" name="風力發電量" />
                  <Area type="monotone" dataKey="gridLoad" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLoad)" name="電網負載" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* --- Right Column: Fleet Status & Logs (7/12) --- */}
        <div className="col-span-7 flex flex-col gap-4">
          
          {/* Fleet Status Grid */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 min-h-[300px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <MapPin size={16} /> 即時車隊分佈與狀態 (金門場域)
              </h3>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Service</span>
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">Charging</span>
                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400">V2G</span>
                <span className="px-2 py-1 rounded bg-slate-700 text-slate-400">Idle</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {ZONES.map(zone => {
                const vehiclesInZone = displayVehicles.filter(v => v.zone === zone);
                return (
                  <div key={zone} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-300">{zone}</span>
                      <span className="text-xs text-slate-500">{vehiclesInZone.length} 輛</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {vehiclesInZone.length === 0 ? (
                        <span className="text-[10px] text-slate-600 italic">無車輛</span>
                      ) : (
                        vehiclesInZone.map(v => (
                          <div
                            key={v.id}
                            className={`w-2 h-2 rounded-full ${
                              v.status === 'Service' ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]' :
                              v.status === 'Charging' ? 'bg-blue-400 animate-pulse' :
                              v.status === 'V2G' ? 'bg-purple-400 shadow-[0_0_5px_#a78bfa]' :
                              'bg-slate-600'
                            }`}
                            title={`${v.id} | SOC: ${v.soc ? v.soc.toFixed(0) : 0}% | ${v.status}`}
                          />
                        ))
                      )}
                    </div>
                    {/* 簡單的區域需求指示條 */}
                    <div className="mt-2 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/50"
                        style={{ width: `${Math.min(100, vehiclesInZone.length * 15 + 20)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agent Decision Log (Terminal Style) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1 flex flex-col font-mono">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2 border-b border-slate-800 pb-2">
              <Terminal size={16} /> Agent 決策日誌 (State-Action-Reward)
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2 h-[200px] text-xs">
              {agentLogs.length === 0 && (
                <div className="text-slate-600 italic">等待系統啟動...</div>
              )}
              {agentLogs.map((log) => (
                <div key={log.id} className="flex gap-2 hover:bg-slate-900 p-1 rounded transition-colors">
                  <span className="text-slate-500">[{String(log.id).split('.')[0].slice(-4)}]</span>
                  <span className="text-cyan-400 font-bold w-16">{log.agentId}</span>
                  <span className="text-yellow-500 w-20">@{log.loc}</span>
                  <span className="text-slate-300 flex-1">{log.action}</span>
                  <span className={`font-bold w-12 text-right ${
                    log.reward > 0 ? 'text-green-400' : log.reward < 0 ? 'text-red-400' : 'text-slate-500'
                  }`}>
                    R:{log.reward}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

// --- 子組件：KPI 卡片 ---
const KpiCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-1">
      <span className="text-xs text-slate-400">{label}</span>
      <Icon size={14} className={color} />
    </div>
    <div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  </div>
);

export default DashboardMonitor;