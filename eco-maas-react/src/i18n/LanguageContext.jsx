/**
 * ====================================================================================================
 * Language Context Provider
 * 提供全域語言切換功能，使用 React Context API
 * ====================================================================================================
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import translations from './translations';

// 建立 Context
const LanguageContext = createContext();

// 支援的語言列表
export const SUPPORTED_LANGUAGES = {
  'zh-TW': '中文',
  'en-US': 'English'
};

/**
 * Language Provider Component
 * 包裹在最外層，提供語言狀態給所有子組件
 */
export const LanguageProvider = ({ children }) => {
  // 從 localStorage 讀取使用者上次選擇的語言，預設為中文
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('eco-maas-language');
    return saved && SUPPORTED_LANGUAGES[saved] ? saved : 'zh-TW';
  });

  // 當語言改變時，儲存到 localStorage
  useEffect(() => {
    localStorage.setItem('eco-maas-language', language);
    // 可選：設定 HTML lang 屬性，有助於無障礙與 SEO
    document.documentElement.lang = language;
  }, [language]);

  /**
   * 切換語言函式
   * @param {string} newLang - 新語言代碼 ('zh-TW' | 'en-US')
   */
  const changeLanguage = (newLang) => {
    if (SUPPORTED_LANGUAGES[newLang]) {
      setLanguage(newLang);
    }
  };

  /**
   * 取得翻譯文字的函式
   * 支援巢狀路徑，例如：t('dashboard.greenEnergyUsage')
   * @param {string} key - 翻譯鍵值，支援點號分隔的路徑
   * @returns {string} - 翻譯後的文字
   */
  const t = (key) => {
    const keys = key.split('.');
    let result = translations[language];

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        // 如果找不到翻譯，回傳 key 本身 (方便 debug)
        console.warn(`Translation missing: ${language}.${key}`);
        return key;
      }
    }

    return result;
  };

  const value = {
    language,
    changeLanguage,
    t,
    isEnglish: language === 'en-US',
    isChinese: language === 'zh-TW'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Custom Hook: useLanguage
 * 在任何組件中使用此 Hook 來存取語言功能
 *
 * 使用範例：
 * const { t, language, changeLanguage } = useLanguage();
 * <div>{t('dashboard.greenEnergyUsage')}</div>
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
};

export default LanguageContext;
