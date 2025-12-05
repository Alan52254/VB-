import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ⚠️ 安全提醒：正式上線請使用 .env 檔案 (import.meta.env.VITE_GEMINI_API_KEY)
// 這裡為了讓你快速測試，先保留變數，請填入你的 Key
const GEMINI_API_KEY = "請填入你的_GEMINI_API_KEY"; 

const AIChatWidget = ({ externalData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是 **Eco-MaaS 戰情助手** (Llama 3.2)。\n\n我可以幫你分析：\n- 🚍 **車隊狀況**\n- ⚡ **能源效率**\n- 📉 **微電網數據**\n\n請問有什麼指示？' }
  ]);
  const messagesEndRef = useRef(null);

  // 自動捲動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // --- 🧠 核心：產生 AI 的「當下認知」 (Context) ---
  const generateSystemPrompt = () => {
    if (!externalData) return "目前系統尚無數據。";

    const { vehicles, metrics } = externalData;
    const grid = metrics?.gridInfo || {};
    
    // 1. 整理異常車輛
    const lowBatteryVehs = vehicles.filter(v => v.soc < 30).map(v => v.id);
    const idleVehs = vehicles.filter(v => v.status === 'Idle').length;
    
    // 2. 整理電網狀況
    const gridStatus = grid.status === 'PEAK' ? '🔴 尖峰負載 (危險)' : (grid.status === 'GREEN' ? '🟢 綠能充沛 (建議充電)' : '🔵 供需平衡');

    // 3. 整理碳排數據
    const savedCarbon = (Math.max(0, (metrics.totalEnergyBaseline || 0) - metrics.totalEnergy) * 0.495).toFixed(2);

    return `
      你是一個專業的智慧交通與能源管理專家 (Eco-MaaS Copilot)。
      現在時間是模擬時間 ${Math.floor(externalData.gameTime)} 分鐘。
      
      【即時系統快照】：
      1. 微電網狀態：${gridStatus}
         - 電價: $${grid.price?.toFixed(1)} / kWh
         - 負載: ${grid.load?.toFixed(0)}%
         - 太陽能產出: ${grid.solar?.toFixed(0)}%
      
      2. 車隊概況：
         - 總車輛數: ${vehicles.length} 台
         - 閒置車輛: ${idleVehs} 台
         - 低電量警示車輛: ${lowBatteryVehs.length > 0 ? lowBatteryVehs.join(', ') : '無'}
      
      3. 營運績效：
         - 平均等待時間: ${(metrics.totalWaitTime / (metrics.totalServed || 1)).toFixed(1)} 分鐘
         - 累計節省碳排: ${savedCarbon} kg
         - 節能率: ${metrics.totalEnergyBaseline > 0 ? (((metrics.totalEnergyBaseline - metrics.totalEnergy) / metrics.totalEnergyBaseline) * 100).toFixed(1) : 0}%
      
      請根據以上數據回答使用者的問題。
      回答請使用 **Markdown** 格式：
      - 重要數據請使用 **粗體**。
      - 多個項目請使用條列式。
      - 建議或警告請使用引用 (> 符號)。
      請用繁體中文回答。
    `;
  };

  // --- 🚀 發送訊息給 本地 Ollama ---
  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. 立即顯示使用者的訊息
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. 準備 Payload
      const payload = {
        model: "llama3.2", // 👈 請確保對應你本地 ollama list 的模型名稱
        stream: false,     
        messages: [
          { role: "system", content: generateSystemPrompt() }, 
          ...messages.slice(-5), 
          userMessage
        ]
      };

      // 3. 呼叫本地 API
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.message.content;
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "⚠️ 連線錯誤：請確認本地 Ollama 已啟動，並已設定 CORS (OLLAMA_ORIGINS='*')。請先關閉舊的 Ollama 視窗再重新執行指令。" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      
      {/* 聊天視窗 */}
      {isOpen && (
        <div className="mb-4 w-[350px] h-[500px] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                <Sparkles size={18} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Eco-Copilot</h3>
                <p className="text-[10px] text-green-400 flex items-center gap-1">● Llama 3.2 (Local)</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-950/30">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                  {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                
                {/* 📝 訊息氣泡 (Markdown 渲染核心) */}
                <div className={`p-3 rounded-2xl text-sm max-w-[85%] overflow-hidden ${
                  m.role === 'user' 
                    ? 'bg-slate-700 text-white rounded-tr-none' 
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-tl-none shadow-sm'
                }`}>
                  <ReactMarkdown 
                    components={{
                      // 客製化 Markdown 樣式，讓它在深色模式下好看
                      strong: ({node, ...props}) => <span className="font-bold text-indigo-300" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      a: ({node, ...props}) => <a className="text-blue-400 hover:underline" target="_blank" {...props} />,
                      code: ({node, inline, className, children, ...props}) => (
                        inline 
                          ? <code className="bg-slate-900/50 text-orange-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                          : <div className="bg-slate-950 p-2 rounded-lg my-2 border border-slate-700 overflow-x-auto"><code className="text-xs font-mono text-emerald-300" {...props}>{children}</code></div>
                      ),
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-3 py-1 my-2 bg-indigo-500/10 rounded-r text-indigo-200 italic" {...props} />
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
                <div className="p-3 bg-slate-800/50 rounded-2xl rounded-tl-none border border-slate-700/30 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-indigo-400" />
                  <span className="text-xs text-slate-400">Llama 正在思考中...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-800/50 border-t border-slate-700">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="詢問即時車況或能源建議..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-2 rounded-xl transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 浮動按鈕 (Toggle) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-900/50 transition-all hover:scale-110 active:scale-95 group"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} className="group-hover:animate-bounce" />}
      </button>
    </div>
  );
};

export default AIChatWidget;