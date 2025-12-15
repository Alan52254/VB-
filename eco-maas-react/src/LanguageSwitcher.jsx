/**
 * ====================================================================================================
 * Language Switcher Component
 * 風格俐落的語言切換按鈕 (Cyberpunk Slate-900 風格)
 * ====================================================================================================
 */

import React from 'react';
import { useLanguage } from './i18n/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageSwitcher = ({ position = 'header' }) => {
  const { language, changeLanguage, isChinese } = useLanguage();

  const handleToggle = () => {
    changeLanguage(isChinese ? 'en-US' : 'zh-TW');
  };

  // 根據位置決定樣式變體
  const isHeader = position === 'header';

  return (
    <button
      onClick={handleToggle}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg font-bold
        transition-all duration-300 border
        ${isHeader
          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
          : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
        }
        text-slate-300 hover:text-cyan-400
        shadow-md hover:shadow-lg hover:shadow-cyan-500/20
        group
      `}
      title={isChinese ? 'Switch to English' : '切換至中文'}
    >
      {/* 圖示 */}
      <Globe
        size={18}
        className="transition-transform duration-300 group-hover:rotate-12 text-cyan-400"
      />

      {/* 語言代碼 */}
      <span className="text-sm font-mono tracking-wider">
        {language === 'zh-TW' ? '中文' : 'EN'}
      </span>

      {/* 指示燈 */}
      <div className={`
        w-2 h-2 rounded-full transition-all duration-300
        ${isChinese ? 'bg-emerald-400' : 'bg-blue-400'}
        shadow-lg
        ${isChinese ? 'shadow-emerald-400/50' : 'shadow-blue-400/50'}
        group-hover:animate-pulse
      `} />
    </button>
  );
};

export default LanguageSwitcher;
