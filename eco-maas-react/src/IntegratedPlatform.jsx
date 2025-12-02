// src/IntegratedPlatform.jsx
import React, { useState } from 'react';
import KinmenMapSim from './KinmenMapSim';
import DashboardMonitor from './DashboardMonitor';
import GlobalOverviewPanel from './GlobalOverviewPanel';
import { Map, BarChart3, Play, Pause, Radio } from 'lucide-react';

const IntegratedPlatform = () => {
  const [realTimeData, setRealTimeData] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [isSystemRunning, setIsSystemRunning] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-md z-10 shrink-0">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          金門 Eco-MaaS 戰情中心
        </h1>

        <button
          onClick={() => setIsSystemRunning(!isSystemRunning)}
          className={`flex items-center gap-2 px-6 py-1.5 rounded-full font-bold transition-all border ${
            isSystemRunning
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
          }`}
        >
          {isSystemRunning ? <Pause size={18} /> : <Play size={18} />}
          {isSystemRunning ? '系統運行中' : '啟動模擬'}
        </button>

        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'map'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Map size={18} />
            <span>場域監控</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'dashboard'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <BarChart3 size={18} />
            <span>FRL 數據分析</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* 地圖層 */}
        <div
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            activeTab === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <KinmenMapSim onSimulationUpdate={setRealTimeData} isRunningExternal={isSystemRunning} />
        </div>

        {/* 儀表板層 */}
        <div
          className={`absolute inset-0 w-full h-full bg-slate-950 overflow-y-auto transition-opacity duration-300 ${
            activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <div className="p-4 h-full grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8 h-full overflow-y-auto rounded-xl">
              <DashboardMonitor externalData={realTimeData} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
                <Radio className="text-red-400 animate-pulse" size={18} />
                <span className="font-bold text-slate-200">全域站點觀測 (Global Brain)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 bg-slate-900/50">
                <GlobalOverviewPanel stations={realTimeData?.stations || []} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegratedPlatform;
