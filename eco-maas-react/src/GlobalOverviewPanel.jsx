// src/GlobalOverviewPanel.jsx 或 src/components/GlobalOverviewPanel.jsx
import React from 'react';
import { Users, Bus, Clock } from 'lucide-react';

const GlobalOverviewPanel = ({ stations }) => {
  if (!stations || stations.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 italic">
        等待站點數據同步...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2 overflow-y-auto h-full">
      {stations.map(station => (
        <div
          key={station.id}
          className={`p-3 rounded-lg border shadow-sm ${
            station.waitingCount > 10
              ? 'bg-red-900/30 border-red-500/70 shadow-[0_0_10px_rgba(248,113,113,0.3)]'
              : 'bg-slate-800 border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-slate-100 text-sm truncate">{station.name}</h4>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                station.waitingCount > 10
                  ? 'bg-red-500 text-white'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {station.waitingCount > 10 ? '擁擠' : '正常'}
            </span>
          </div>

          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>
                候車：<b className="text-white text-sm">{station.waitingCount ?? 0}</b>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Bus size={12} />
              <span>
                在庫：<b className="text-white text-sm">{station.currentBusCount ?? 0}</b>
              </span>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <Clock size={11} /> 累積服務：{station.totalServed ?? 0} 人
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlobalOverviewPanel;
