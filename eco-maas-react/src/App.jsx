// src/App.jsx
import React from 'react';
import IntegratedPlatform from './IntegratedPlatform'; // 引入你的合併組件
import './index.css'; // 確保載入樣式

function App() {
  return (
    // 這裡直接回傳我們寫好的整合平台
    <div className="w-full h-screen">
      <IntegratedPlatform />
    </div>
  );
}

export default App;