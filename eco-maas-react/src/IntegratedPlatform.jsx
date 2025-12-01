// IntegratedPlatform.jsx
import React, { useState } from 'react';
import KinmenMapSim from './KinmenMapSim';
import DashboardMonitor from './DashboardMonitor';
import { Map, BarChart3, Play, Pause } from 'lucide-react'; // 記得引入 Play, Pause

const IntegratedPlatform = () => {
  const [realTimeData, setRealTimeData] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [isSystemRunning, setIsSystemRunning] = useState(false); // 🔥 新增：全域系統開關

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      
      {/* 頂部導航列 */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-md z-10">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          金門 Eco-MaaS 戰情中心
        </h1>

        {/* 🔥 新增：中央控制按鈕 */}
        <button
          onClick={() => setIsSystemRunning(!isSystemRunning)}
          className={`flex items-center gap-2 px-6 py-1.5 rounded-full font-bold transition-all border ${
            isSystemRunning 
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30' 
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
          }`}
        >
          {isSystemRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {isSystemRunning ? "系統運行中" : "啟動模擬"}
        </button>
        
        {/* ... 右邊的分頁按鈕保持不變 ... */}
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
           {/* ... 原本的 Tab Buttons ... */}
           <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Map size={18} /><span>場域監控</span></button>
           <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><BarChart3 size={18} /><span>FRL 數據分析</span></button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* 地圖層：把開關狀態傳進去 */}
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${activeTab === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           {/* 🔥 重點：傳入 isRunning prop */}
           <KinmenMapSim onSimulationUpdate={setRealTimeData} isRunningExternal={isSystemRunning} />
        </div>

        {/* 儀表板層 */}
        <div className={`absolute inset-0 w-full h-full bg-slate-950 overflow-y-auto transition-opacity duration-300 ${activeTab === 'dashboard' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
           <div className="p-4 min-h-full">
              <DashboardMonitor externalData={realTimeData} />
           </div>
        </div>
      </div>
    </div>
  );
};

export default IntegratedPlatform;