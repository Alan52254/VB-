//App.jsx
import React from 'react';
import IntegratedPlatform from './IntegratedPlatform'; // 引入你的合併組件
import { LanguageProvider } from './i18n/LanguageContext'; // 🌐 引入 Language Provider
import './index.css'; // 確保載入樣式

function App() {
  return (
    // 🌐 使用 LanguageProvider 包裹整個應用，實現全域語言切換
    <LanguageProvider>
      <div className="w-full h-screen">
        <IntegratedPlatform />
      </div>
    </LanguageProvider>
  );
}

export default App;