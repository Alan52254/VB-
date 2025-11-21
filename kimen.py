import pygame
import math
import random
import numpy as np

# --- 1. 系統配置與視覺風格 (Cyberpunk Vibe) ---
WIDTH, HEIGHT = 1400, 900
FPS = 60

# 顏色定義
C_BG = (10, 15, 25)         # 深空黑
C_LAND = (30, 35, 45)       # 島嶼深灰
C_ROAD = (60, 70, 80)       # 道路灰
C_ACCENT = (0, 243, 255)    # 霓虹青 (Cyber Cyan)
C_OK = (0, 255, 157)        # 螢光綠 (Status OK)
C_WARN = (255, 180, 0)      # 警告黃
C_ALERT = (255, 50, 80)     # 警示紅
C_TEXT = (220, 230, 240)    # 文字白
C_PANEL = (20, 25, 35)      # 面板底色

# 模擬參數
NUM_VEHICLES = 5
TRACK_LENGTH_KM = 15.0
PIXELS_PER_METER = 0.05     # 縮放比例

# RL 參數設定
PLATOON_DIST_THRESHOLD = 40 # 公尺 (跟車距離)
WIND_PENALTY_ZONE = [3, 4]  # 太武山、陳景蘭洋樓路段風大

# 金門站點 (座標映射到 1400x900)
STATIONS = [
    {"name": "文化園區(總站)", "type": "HUB", "pos": (950, 200)},
    {"name": "山后民俗村", "type": "SPOT", "pos": (1150, 150)},
    {"name": "獅山砲陣地", "type": "SPOT", "pos": (1250, 300)},
    {"name": "太武山(強風)", "type": "SPOT", "pos": (800, 400)},
    {"name": "陳景蘭洋樓", "type": "SPOT", "pos": (650, 600)},
    {"name": "翟山坑道", "type": "SPOT", "pos": (250, 700)},
    {"name": "莒光樓(市區)", "type": "HUB", "pos": (200, 450)},
    {"name": "古寧頭", "type": "SPOT", "pos": (200, 200)},
]

# --- 2. 輔助運算類別 ---

def get_dist(p1, p2):
    return math.hypot(p2[0]-p1[0], p2[1]-p1[1])

class Track:
    def __init__(self):
        self.points = []
        self.generate_spline_track()
        self.total_pixels = 0
        for i in range(len(self.points)-1):
            self.total_pixels += get_dist(self.points[i], self.points[i+1])

    def generate_spline_track(self):
        # 使用簡單的線性插值建立路徑 (可視化用)
        pts = [s["pos"] for s in STATIONS]
        for i in range(len(pts)):
            p1 = pts[i]
            p2 = pts[(i+1)%len(pts)]
            steps = 50
            for s in range(steps):
                t = s / steps
                x = p1[0] + (p2[0]-p1[0]) * t
                y = p1[1] + (p2[1]-p1[1]) * t
                self.points.append((x, y))

# --- 3. 強化學習核心 (The Brain) ---

class RLAgent:
    def __init__(self, car_id):
        self.id = car_id
        self.q_table = {} # 簡化模擬
        self.last_reward = 0
        
    def get_state(self, front_dist, wind_speed, soc, is_near_station):
        """將環境離散化為狀態"""
        d_state = "FAR"
        if front_dist < 15: d_state = "CRITICAL"
        elif front_dist < PLATOON_DIST_THRESHOLD: d_state = "CLOSE"
        
        w_state = "STRONG" if wind_speed > 10 else "NORMAL"
        s_state = "LOW" if soc < 20 else "OK"
        st_state = "NEAR" if is_near_station else "ROAD"
        
        return (d_state, w_state, s_state, st_state)

    def decide_action(self, state):
        """
        Layer 2 Policy (微觀控制):
        決定加速跟車(Platoon)、巡航(Cruise)、減速(Brake)、充電(Charge)
        """
        (dist, wind, soc, station) = state
        
        # Rule-based Policy (模擬訓練好的 RL 模型)
        if soc == "LOW" and station == "NEAR": return "CHARGE"
        if dist == "CRITICAL": return "BRAKE"
        if dist == "CLOSE" and soc == "OK": return "PLATOON_MODE" # 觸發跟車
        if wind == "STRONG" and dist == "FAR": return "ECO_CRUISE" # 逆風減速
        if station == "NEAR": return "PREPARE_STOP"
        
        return "CRUISE"

    def calculate_reward(self, action, current_cd, speed):
        """計算即時獎勵回饋"""
        reward = 0.0
        # 節能獎勵
        if current_cd < 0.5: reward += 2.0 # Platoon bonus
        # 速度懲罰 (太慢扣分)
        if speed < 2: reward -= 0.5
        # 耗能懲罰 (P ~ v^3)
        power = 0.5 * current_cd * (speed**3)
        reward -= power * 0.01
        
        self.last_reward = reward
        return reward

# --- 4. 車輛實體 (The Physical Body) ---

class Vehicle:
    def __init__(self, id, track, start_idx):
        self.id = id
        self.track = track
        self.path_idx = start_idx
        self.pos = track.points[start_idx]
        
        # 物理狀態
        self.speed = 0
        self.target_speed = 5
        self.soc = random.uniform(60, 100) # %
        self.cd = 0.8 # 風阻係數
        
        # 智慧體
        self.agent = RLAgent(id)
        self.state_desc = "INIT"
        self.action_desc = "WAIT"
        self.is_platooning = False
        
        # 視覺
        self.color = C_ACCENT
        self.flash_timer = 0

    def update(self, vehicles, wind_speed):
        # 1. 感測 (Sensing)
        front_dist, front_car = self.sense_front(vehicles)
        is_near_station = self.check_station()
        
        # 2. RL 決策 (Brain)
        state = self.agent.get_state(front_dist, wind_speed, self.soc, is_near_station)
        action = self.agent.decide_action(state)
        self.action_desc = action
        self.state_desc = f"{state[0]}|{state[1]}"
        
        # 3. 物理執行 (Physics Execution)
        self.cd = 0.8 # Reset
        self.is_platooning = False
        
        if action == "CHARGE":
            self.target_speed = 0
            self.soc = min(100, self.soc + 0.5)
            self.color = C_WARN
        elif action == "BRAKE":
            self.target_speed = 0
            self.color = C_ALERT
        elif action == "PLATOON_MODE":
            self.target_speed = front_car.speed + 1 # 追趕
            self.cd = 0.4 # 享受低風阻
            self.is_platooning = True
            self.color = C_OK
        elif action == "ECO_CRUISE":
            self.target_speed = 3 # 減速省電
            self.color = (200, 200, 200)
        elif action == "PREPARE_STOP":
            self.target_speed = 2
        else: # CRUISE
            self.target_speed = 6
            self.color = C_ACCENT
            
        # 風速影響 Cd
        if wind_speed > 10:
            self.cd += 0.1

        # 運動學更新
        if self.speed < self.target_speed: self.speed += 0.1
        elif self.speed > self.target_speed: self.speed -= 0.2
        
        # 移動
        self.path_idx = (self.path_idx + self.speed) % len(self.track.points)
        idx_int = int(self.path_idx)
        self.pos = self.track.points[idx_int]
        
        # 計算角度
        next_pos = self.track.points[(idx_int + 5) % len(self.track.points)]
        self.angle = math.degrees(math.atan2(-(next_pos[1]-self.pos[1]), next_pos[0]-self.pos[0]))

        # 電量消耗 (模型: P = 0.5 * Cd * v^3)
        power_loss = 0.005 * self.cd * (self.speed ** 3)
        self.soc -= power_loss
        if self.soc < 0: self.soc = 0
        
        # RL 獎勵計算
        self.agent.calculate_reward(action, self.cd, self.speed)

    def sense_front(self, vehicles):
        min_dist = 9999
        target = None
        my_idx = self.path_idx
        
        for v in vehicles:
            if v.id == self.id: continue
            
            # 簡單計算路徑上的距離
            dist = v.path_idx - my_idx
            if dist < 0: dist += len(self.track.points) # 環狀處理
            
            # 轉換為公尺 (假設 1px = 0.2m)
            dist_m = dist * 0.2
            
            if dist_m < min_dist:
                min_dist = dist_m
                target = v
                
        return min_dist, target

    def check_station(self):
        for s in STATIONS:
            d = get_dist(self.pos, s["pos"])
            if d < 50: return True
        return False

    def draw(self, surface, is_selected):
        # 車體旋轉
        # 創建一個箭頭形狀的 Surface
        surf = pygame.Surface((30, 20), pygame.SRCALPHA)
        color = (255, 255, 255) if is_selected else self.color
        
        # 畫車身
        pygame.draw.polygon(surf, color, [(0, 0), (30, 10), (0, 20), (5, 10)])
        
        # 旋轉
        rot_surf = pygame.transform.rotate(surf, self.angle)
        rect = rot_surf.get_rect(center=self.pos)
        
        surface.blit(rot_surf, rect.topleft)
        
        # ID 標籤
        font = pygame.font.SysFont("Arial", 12, bold=True)
        lbl = font.render(f"#{self.id}", True, C_TEXT)
        surface.blit(lbl, (self.pos[0]-10, self.pos[1]-25))
        
        # Platooning 連線特效
        if self.is_platooning:
            pygame.draw.circle(surface, C_OK, (int(self.pos[0]), int(self.pos[1])), 25, 1)

# --- 5. 主程式與 UI ---

def draw_ui(screen, vehicles, selected_id, wind_speed):
    # 右側面板背景
    panel_rect = pygame.Rect(WIDTH - 350, 0, 350, HEIGHT)
    pygame.draw.rect(screen, C_PANEL, panel_rect)
    pygame.draw.line(screen, C_ACCENT, (WIDTH - 350, 0), (WIDTH - 350, HEIGHT), 2)
    
    font_title = pygame.font.SysFont("Arial", 24, bold=True)
    font_text = pygame.font.SysFont("Consolas", 16)
    
    # 標題
    screen.blit(font_title.render("Eco-MaaS 監控儀表板", True, C_ACCENT), (WIDTH - 330, 20))
    
    # 環境資訊
    y = 60
    pygame.draw.rect(screen, (40, 45, 55), (WIDTH-340, y, 330, 80), border_radius=5)
    screen.blit(font_text.render(f"環境風速 (Wind): {wind_speed:.1f} m/s", True, C_TEXT), (WIDTH-330, y+10))
    screen.blit(font_text.render(f"電網負載 (Grid): STABLE", True, C_OK), (WIDTH-330, y+35))
    active_cars = len([v for v in vehicles if v.soc > 20])
    screen.blit(font_text.render(f"營運車輛 (Active): {active_cars}/{len(vehicles)}", True, C_TEXT), (WIDTH-330, y+60))
    
    y += 100
    # 車輛列表
    screen.blit(font_title.render("車隊實時數據 (Fleet)", True, C_ACCENT), (WIDTH - 330, y))
    y += 30
    
    # 表頭
    header = f"{'ID':<3} {'SoC':<4} {'Cd':<4} {'Action':<10}"
    screen.blit(font_text.render(header, True, (150, 150, 150)), (WIDTH - 330, y))
    y += 20
    
    for v in vehicles:
        color = C_ACCENT if v.id != selected_id else (255, 255, 0)
        # 背景高亮選中車輛
        if v.id == selected_id:
            pygame.draw.rect(screen, (50, 50, 60), (WIDTH-340, y-2, 330, 20))
            
        info = f"#{v.id:<2} {int(v.soc):>3}% {v.cd:<4.1f} {v.action_desc}"
        screen.blit(font_text.render(info, True, color), (WIDTH - 330, y))
        y += 25

    # 詳細監控面板 (選中車輛)
    y += 20
    pygame.draw.line(screen, (100, 100, 100), (WIDTH - 340, y), (WIDTH - 10, y), 1)
    y += 20
    
    if selected_id is not None:
        v = vehicles[selected_id]
        screen.blit(font_title.render(f"Vehicle #{v.id} 詳細遙測", True, (255, 255, 0)), (WIDTH - 330, y))
        y += 40
        
        # 詳細數據
        details = [
            f"狀態 (State): {v.state_desc}",
            f"決策 (Action): {v.action_desc}",
            f"電量 (SoC): {v.soc:.1f}%",
            f"速度 (Speed): {v.speed:.1f}",
            f"風阻係數 (Cd): {v.cd:.2f} " + ("(PLATOON)" if v.is_platooning else ""),
            f"RL 獎勵 (Reward): {v.agent.last_reward:.3f}"
        ]
        
        for d in details:
            color = C_TEXT
            if "Reward" in d: 
                color = C_OK if v.agent.last_reward > 0 else C_ALERT
            screen.blit(font_text.render(d, True, color), (WIDTH - 330, y))
            y += 25
            
        # 繪製電量條
        y += 10
        pygame.draw.rect(screen, (100, 100, 100), (WIDTH - 330, y, 300, 10))
        bar_color = C_OK if v.soc > 50 else C_ALERT
        pygame.draw.rect(screen, bar_color, (WIDTH - 330, y, 3 * v.soc, 10))

def draw_map(screen):
    # 繪製島嶼形狀 (模擬金門)
    poly = [
        (200, 200), (400, 150), (800, 100), (1000, 80), (1200, 150),
        (1250, 300), (1100, 400), (800, 450), (600, 600), (300, 700),
        (150, 600), (100, 400)
    ]
    pygame.draw.polygon(screen, C_LAND, poly)
    pygame.draw.polygon(screen, (50, 60, 70), poly, 3)

    # 繪製風區提示
    pygame.draw.line(screen, C_WARN, (700, 400), (900, 400), 5)
    font = pygame.font.SysFont("Arial", 12)
    screen.blit(font.render("HIGH WIND ZONE", True, C_WARN), (750, 380))

    # 繪製站點
    for s in STATIONS:
        c = C_ACCENT if s["type"] == "HUB" else C_OK
        pygame.draw.circle(screen, c, s["pos"], 8)
        # 站名
        try:
            # Pygame 預設字型不支援中文，這裡若無法顯示中文，請改用英文或安裝字型
            # 這裡為了通用性，我用簡單的英文標示，你可以在本地載入微軟正黑體
            name = s["name"] 
            # 簡單過濾中文 (若顯示亂碼) -> 可改用 s["type"] + index
        except:
            name = s["type"]
            
        # 這裡使用系統字體繪製
        # font_zh = pygame.font.Font("C:/Windows/Fonts/msjh.ttc", 14) 
        # 若無字型檔會報錯，故保留預設英文處理
        text = pygame.font.SysFont("Microsoft JhengHei", 14).render(name, True, (200, 200, 200))
        screen.blit(text, (s["pos"][0]+12, s["pos"][1]-10))

def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Eco-MaaS: RL Autonomous Fleet Monitor")
    clock = pygame.time.Clock()
    
    # 初始化系統
    track = Track()
    vehicles = []
    for i in range(NUM_VEHICLES):
        # 分散初始位置
        start_idx = int((i / NUM_VEHICLES) * len(track.points))
        vehicles.append(Vehicle(i, track, start_idx))
        
    selected_id = 0 # 預設選中第一台
    
    running = True
    while running:
        # 1. 事件處理
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                mx, my = pygame.mouse.get_pos()
                # 點擊選擇車輛
                for v in vehicles:
                    dist = math.hypot(v.pos[0]-mx, v.pos[1]-my)
                    if dist < 30:
                        selected_id = v.id

        # 2. 環境變因更新
        time_sec = pygame.time.get_ticks() / 1000
        # 模擬陣風 (基礎 5m/s + 波動)
        wind_speed = 5 + math.sin(time_sec * 0.5) * 5 
        # 特定區域風更大
        
        # 3. 車輛更新
        for v in vehicles:
            # 檢查是否在強風區
            local_wind = wind_speed
            if 700 < v.pos[0] < 900 and 300 < v.pos[1] < 500:
                local_wind += 10 # 太武山區加風
            
            v.update(vehicles, local_wind)

        # 4. 繪製畫面
        screen.fill(C_BG)
        draw_map(screen)
        
        # 畫軌跡線
        if len(track.points) > 1:
            pygame.draw.lines(screen, C_ROAD, True, track.points, 5)
            
        # 畫車
        for v in vehicles:
            is_sel = (v.id == selected_id)
            v.draw(screen, is_sel)
            
        # 畫儀表板
        draw_ui(screen, vehicles, selected_id, wind_speed)
        
        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()

if __name__ == "__main__":
    main()