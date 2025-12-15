/**
 * ====================================================================================================
 * Eco-MaaS 全域翻譯字典 (Global Translation Dictionary)
 * 支援語言：繁體中文 (zh-TW) / English (en-US)
 * ====================================================================================================
 */

const translations = {
  // ============================================================================
  // 中文 (Traditional Chinese)
  // ============================================================================
  'zh-TW': {
    // --- 通用 (Common) ---
    common: {
      language: '語言',
      chinese: '中文',
      english: 'English',
      loading: '載入中...',
      noData: '等待數據...',
      close: '關閉',
      back: '返回',
      overview: '總覽',
      status: 'NORMAL'
    },

    // --- Platform (整合平台) ---
    platform: {
      title: '金門 Eco-MaaS 戰情中心',
      systemRunning: '系統運行中',
      startSimulation: '啟動模擬',
      fieldMonitor: '場域監控',
      frlAnalysis: 'FRL 數據分析',
      globalBrain: '全域站點觀測 (Global Brain)'
    },

    // --- Dashboard Monitor (監控面板) ---
    dashboard: {
      // 演算法資訊
      algorithm: '演算法',
      privacy: '隱私保護',
      algorithmValue: 'PPO + FedBuff',
      privacyValue: 'DP-SGD Enabled',

      // 核心指標標籤
      simTime: '模擬時間',
      epoch: '訓練輪次',
      activeFleet: '執勤車隊',
      vehicles: '輛',
      minutes: '分',

      // KPI 卡片
      kpi: {
        greenEnergyUsage: '綠能使用率',
        carbonReduction: '減碳貢獻',
        avgWait: '平均等待',
        gridBalance: '電網平衡分',
        emptyRate: '空車率',
        carpoolRatio: '組隊比例',
        serviceLevel: '服務水準',
        v2gContribution: 'V2G 貢獻',
        resourceIdle: '資源閒置',
        avgPassengers: '平均載客',
        trees: '棵樹 🌲',
        phoneCharges: '手機充電',
        times: '次 📱'
      },

      // 風力場景
      windScenarios: {
        balanced: '供需平衡',
        abundant: '綠能充沛',
        peak: '尖峰負載'
      },

      // 永續影響力區塊
      sustainability: {
        title: '永續影響力 - AI 優化成效',
        energySaved: '節省電力',
        carbonReduced: '減少碳排',
        treesEquivalent: '相當於種樹',
        phoneCharges: '可充手機',
        kwh: '度 (kWh)',
        kgCO2: 'kg CO₂e',
        trees: '棵 (年吸碳量)',
        charges: '次 (完整充電)',
        energyReduction: '能耗降低'
      },

      // 圖表標題
      charts: {
        frlTraining: 'FRL 訓練收斂 (Loss/Reward)',
        microgrid: '微電網供需動態',
        solarGeneration: '太陽能發電',
        gridLoad: '電網負載',
        timeAxis: 'Time (min)',
        percentAxis: '%'
      },

      // 即時車隊分佈
      fleetDistribution: {
        title: '即時車隊分佈 (Zone Distribution)',
        statusService: 'Service',
        statusCharging: 'Charging',
        statusIdle: 'Idle',
        vehicleCount: '輛'
      },
    },

    // --- Map Simulator (地圖模擬器) ---
    map: {
      // 模式切換
      mode: {
        baseline: 'Baseline',
        rlAgent: 'RL Agent'
      },

      // 站點名稱
      locations: {
        depot: '金城總站',
        juguang: '莒光樓',
        zhaishan: '翟山坑道',
        chenggong: '陳景蘭洋樓',
        airport: '尚義機場',
        taiwu: '太武山',
        shanhou: '山后民俗村',
        mashan: '馬山觀測所',
        guningtou: '古寧頭'
      },

      // 站點描述
      descriptions: {
        depot: '全島交通核心與調度中心，設有 120kW 快速充電樁與運維中心。',
        juguang: '金門戰地精神象徵，登樓可眺望廈門夜景，為必訪觀光地標。',
        zhaishan: 'A字型戰備水道，花崗岩開鑿的鬼斧神工，每年舉辦坑道音樂節。',
        chenggong: '金門規模最大洋樓，純白系建築與成功海灘相連，網美打卡熱點。',
        airport: '金門對外交通門戶，人流吞吐量最高，設有旅客服務中心。',
        taiwu: '金門最高峰，「毋忘在莒」勒石所在地。此路段坡度陡峭，耗能極高。',
        shanhou: '保存最完整的閩南二落大厝聚落，展現傳統燕尾脊建築之美。',
        mashan: '金門本島距離大陸最近的據點，號稱「天下第一哨」。',
        guningtou: '古寧頭戰役紀念館,見證歷史的關鍵戰場遺跡。'
      },

      // 區域映射
      zones: {
        jincheng: '金城車站',
        shanwai: '山外車站',
        shueitou: '水頭碼頭',
        airport: '金門機場',
        guningtou: '古寧頭',
        taiwu: '太武山',
        moving: '移動中'
      },

      // 車輛監控面板
      vehicleMonitor: {
        title: '車輛監控',
        speed: '車速',
        power: '功率',
        dragCoeff: '風阻',
        passengers: '載客',
        battery: '電池 SoC',
        boardedLast: '本站上車',
        alightedLast: '本站下車',
        backToOverview: '回總覽'
      },

      // AI 核心狀態
      aiCore: {
        title: 'AI 核心',
        mode: '模式',
        modeRL: 'RL Agent',
        modeBaseline: 'Baseline'
      },

      // KPI 指標
      kpi: {
        platoonRate: '組隊率',
        emptyRate: '空車率',
        efficiency: '效率',
        waiting: '等待'
      },

      // 微電網監控
      microgrid: {
        title: '微電網狀態',
        statusBalanced: '供需平衡',
        statusGreen: '綠能充沛',
        statusPeak: '尖峰負載',
        electricityPrice: '即時電價',
        gridLoad: '電網負載',
        pvOutput: 'PV Output'
      },

      // 能耗趨勢圖表
      energyChart: {
        title: '能耗趨勢對比',
        baseline: 'Baseline (無優化)',
        rlAgent: 'RL Agent (本系統)',
        unit: 'kWh',
        waiting: '等待數據...'
      },

      // 決策日誌
      decisionLog: {
        title: '決策日誌',
        waiting: '系統待命中...',
        categorySystem: 'SYS',
        categoryAI: 'AI',
        categoryWarn: 'WARN'
      },

      // 系統訊息
      messages: {
        systemInit: '系統初始化完成。RL Agent 準備就緒。',
        chargeComplete: '充電完成 (SoC: 95%) -> 恢復服務',
        lowBatteryCharge: 'SoC低於閾值 (30%) -> 執行返站充電策略 (Reward: +15)',
        platoonActivated: '偵測到鄰近車輛 -> 啟動編隊行駛 (節能: 60%)',
        passengerBoarded: '接載',
        loadRate: '載客率',
        batteryWarning: '電量危急',
        recommendCharge: '- 建議立即返站',
        stationCongestion: '站點擁擠概況：',
        waiting: '等候',
        totalServed: '累計服務',
        people: '人',
        stationStable: '目前各站候車量穩定。'
      }
    }
  },

  // ============================================================================
  // 英文 (English)
  // ============================================================================
  'en-US': {
    // --- Common ---
    common: {
      language: 'Language',
      chinese: '中文',
      english: 'English',
      loading: 'Loading...',
      noData: 'Waiting for data...',
      close: 'Close',
      back: 'Back',
      overview: 'Overview',
      status: 'NORMAL'
    },

    // --- Platform ---
    platform: {
      title: 'Kinmen Eco-MaaS Command Center',
      systemRunning: 'System Running',
      startSimulation: 'Start Simulation',
      fieldMonitor: 'Field Monitor',
      frlAnalysis: 'FRL Analytics',
      globalBrain: 'Global Station Observer (Global Brain)'
    },

    // --- Dashboard Monitor ---
    dashboard: {
      // Algorithm Info
      algorithm: 'Algorithm',
      privacy: 'Privacy',
      algorithmValue: 'PPO + FedBuff',
      privacyValue: 'DP-SGD Enabled',

      // Core Metrics Labels
      simTime: 'Sim Time',
      epoch: 'Epoch',
      activeFleet: 'Active Fleet',
      vehicles: 'vehs',
      minutes: 'min',

      // KPI Cards
      greenEnergyUsage: 'Green Energy Usage',
      carbonReduction: 'Carbon Reduction',
      avgWaitTime: 'Avg Wait Time',
      gridBalanceScore: 'Grid Balance',
      emptyRate: 'Empty Rate',
      carpoolRatio: 'Platoon Ratio',

      // KPI Subtitles
      serviceLevel: 'Service Level',
      v2gContribution: 'V2G Contribution',
      resourceIdle: 'Resource Idle',
      avgPassengers: 'Avg Passengers',

      // Wind Scenarios
      windScenarios: {
        balanced: 'Balanced',
        abundant: 'Green Abundant',
        peak: 'Peak Load'
      },

      // Sustainability Impact
      sustainability: {
        title: 'Sustainability Impact - AI Optimization',
        energySaved: 'Energy Saved',
        carbonReduced: 'Carbon Reduced',
        treesEquivalent: 'Trees Equivalent',
        phoneCharges: 'Phone Charges',
        kwh: 'kWh',
        kgCO2: 'kg CO₂e',
        trees: 'trees (annual)',
        charges: 'charges (full)',
        reductionRate: 'Energy Reduction'
      },

      // Chart Titles
      charts: {
        frlTraining: 'FRL Training Convergence (Loss/Reward)',
        microgrid: 'Microgrid Supply & Demand',
        solarGeneration: 'Solar Generation',
        gridLoad: 'Grid Load',
        timeAxis: 'Time (min)',
        percentAxis: '%'
      },

      // Fleet Distribution
      fleetDistribution: {
        title: 'Real-time Fleet Distribution',
        statusService: 'Service',
        statusCharging: 'Charging',
        statusIdle: 'Idle',
        vehicleCount: 'vehicles'
      },

      // AI Decision Stream
      aiStream: {
        title: 'AI Decision Stream',
        waiting: 'Waiting for decision data...',
        prefixSystem: 'SYS',
        prefixAI: 'RL-AGENT',
        prefixWarn: 'ALERT'
      }
    },

    // --- Map Simulator ---
    map: {
      // Mode Switch
      mode: {
        baseline: 'Baseline',
        rlAgent: 'RL Agent'
      },

      // Location Names (keep original for English)
      locations: {
        depot: 'Jincheng Depot',
        juguang: 'Juguang Tower',
        zhaishan: 'Zhaishan Tunnel',
        chenggong: 'Chen Jing-lan Mansion',
        airport: 'Shangyi Airport',
        taiwu: 'Mt. Taiwu',
        shanhou: 'Shanhou Folk Village',
        mashan: 'Mashan Observatory',
        guningtou: 'Guningtou'
      },

      // Descriptions
      descriptions: {
        depot: 'Main transportation hub and dispatch center with 120kW fast charging stations.',
        juguang: 'Symbol of Kinmen\'s wartime spirit, offering views of Xiamen. A must-visit landmark.',
        zhaishan: 'A-shaped military water tunnel carved through granite, hosting annual music festivals.',
        chenggong: 'Kinmen\'s largest Western-style mansion with pristine white architecture by the beach.',
        airport: 'Main gateway to Kinmen with the highest passenger traffic and service center.',
        taiwu: 'Kinmen\'s highest peak featuring the famous "Never Forget Ju Kuang" inscription. Steep terrain.',
        shanhou: 'Best-preserved traditional Minnan architectural complex showcasing swallow-tail roofs.',
        mashan: 'The closest point to mainland China, known as "The First Sentry Post".',
        guningtou: 'Battle of Guningtou Memorial, a critical historical battlefield site.'
      },

      // Zone Mapping
      zones: {
        jincheng: 'Jincheng Station',
        shanwai: 'Shanwai Station',
        shueitou: 'Shueitou Pier',
        airport: 'Kinmen Airport',
        guningtou: 'Guningtou',
        taiwu: 'Mt. Taiwu',
        moving: 'In Transit'
      },

      // Vehicle Monitor Panel
      vehicleMonitor: {
        title: 'Vehicle Monitor',
        speed: 'Speed',
        power: 'Power',
        dragCoeff: 'Drag',
        passengers: 'Passengers',
        battery: 'Battery SoC',
        boardedLast: 'Boarded',
        alightedLast: 'Alighted',
        backToOverview: 'Back to Overview'
      },

      // AI Core Status
      aiCore: {
        title: 'AI Core',
        mode: 'Mode',
        modeRL: 'RL Agent',
        modeBaseline: 'Baseline'
      },

      // KPI Metrics
      kpi: {
        platoonRate: 'Platoon Rate',
        emptyRate: 'Empty Rate',
        efficiency: 'Efficiency',
        waiting: 'Waiting'
      },

      // Microgrid Monitor
      microgrid: {
        title: 'Microgrid Status',
        statusBalanced: 'Balanced',
        statusGreen: 'Green Abundant',
        statusPeak: 'Peak Load',
        electricityPrice: 'Electricity Price',
        gridLoad: 'Grid Load',
        pvOutput: 'PV Output'
      },

      // Energy Chart
      energyChart: {
        title: 'Energy Consumption Comparison',
        baseline: 'Baseline (No Optimization)',
        rlAgent: 'RL Agent (This System)',
        unit: 'kWh',
        waiting: 'Waiting for data...'
      },

      // Decision Log
      decisionLog: {
        title: 'Decision Log',
        waiting: 'System standby...',
        categorySystem: 'SYS',
        categoryAI: 'AI',
        categoryWarn: 'WARN'
      },

      // System Messages
      messages: {
        systemInit: 'System initialized. RL Agent ready.',
        chargeComplete: 'Charge complete (SoC: 95%) -> Resume service',
        lowBatteryCharge: 'SoC below threshold (30%) -> Executing return-to-depot charging (Reward: +15)',
        platoonActivated: 'Nearby vehicle detected -> Platoon mode activated (Energy saved: 60%)',
        passengerBoarded: 'Picked up',
        loadRate: 'Load rate',
        batteryWarning: 'Battery critical',
        recommendCharge: '- Return to depot recommended',
        stationCongestion: 'Station congestion status:',
        waiting: 'waiting',
        totalServed: 'total served',
        people: 'pax',
        stationStable: 'All stations have stable passenger queue.'
      }
    }
  }
};

export default translations;
