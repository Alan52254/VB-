# app.py - 終極版：100% 保留你的賽博畫面 + 完整智慧功能
from flask import Flask, render_template
from flask_socketio import SocketIO
import math, time, threading, random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'eco_maas_cyberpunk'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 金門景點真實圖文卡
ATTRACTIONS = {
    0: {"name": "文化園區 (總站)", "desc": "金門最大充電樞紐與指揮中心", "img": "https://kinmen.travel/upload/album/202203/20220314164759_771.jpg"},
    1: {"name": "山后民俗村", "desc": "海上蘇杭・18棟完整閩南古厝", "img": "https://www.kmnp.gov.tw/upload/album/big/202104/20210430145603_885.jpg"},
    2: {"name": "獅山砲陣地", "desc": "每日砲操表演・台灣唯一坑道砲陣", "img": "https://www.kinmen.gov.tw/FileDownLoad/News/big/202308/202308071602190.jpg"},
    3: {"name": "太武山", "desc": "金門最高峰・勿忘在莒勒石", "img": "https://kinmen.travel/upload/album/202203/20220314164902_771.jpg"},
    4: {"name": "陳景蘭洋樓", "desc": "金門最美洋樓・南洋華僑傑作", "img": "https://kinmen.travel/upload/album/202203/20220314165005_771.jpg"},
    5: {"name": "翟山坑道", "desc": "A字型戰備水道・地下威尼斯", "img": "https://kinmen.travel/upload/album/202203/20220314165108_771.jpg"},
    6: {"name": "莒光樓", "desc": "金門地標・仿古三層樓閣", "img": "https://kinmen.travel/upload/album/202203/20220314165211_771.jpg"},
    7: {"name": "古寧頭戰史館", "desc": "1949古寧頭大捷紀念館", "img": "https://kinmen.travel/upload/album/202203/20220314165314_771.jpg"}
}

# 站點座標完全對應你設計稿
stations = [
    {"id":0, "name":"文化園區 (總站)", "x":950, "y":200, "is_hub":True, "waiting":0, "type":"hub"},
    {"id":1, "name":"山后民俗村", "x":1150, "y":150, "is_hub":False, "waiting":0, "type":"spot"},
    {"id":2, "name":"獅山砲陣地", "x":1250, "y":300, "is_hub":False, "waiting":0, "type":"spot"},
    {"id":3, "name":"太武山", "x":800, "y":400, "is_hub":False, "waiting":0, "type":"spot"},
    {"id":4, "name":"陳景蘭洋樓", "x":650, "y":600, "is_hub":False, "waiting":0, "type":"spot"},
    {"id":5, "name":"翟山坑道", "x":250, "y":700, "is_hub":False, "waiting":0, "type":"spot"},
    {"id":6, "name":"莒光樓 (市區)", "x":200, "y":450, "is_hub":True, "waiting":0, "type":"hub"},
    {"id":7, "name":"古寧頭", "x":200, "y":200, "is_hub":False, "waiting":0, "type":"spot"},
]

class Vehicle:
    def __init__(self, uid):
        self.id = uid
        self.progress = random.random()
        self.speed = 0.0
        self.soc = random.uniform(45, 95)
        self.state = "MOVING"
        self.action = "CRUISE"
        self.platooning = False
        self.cd = 0.8
        self.passengers = 0

    def update(self, dt, all_vehicles, wind, decision):
        # Layer 2: Platooning
        min_dist = min((min(abs((o.progress - self.progress)%1), 1-abs((o.progress - self.progress)%1)) * 15000 
                       for o in all_vehicles if o.id != self.id), default=99999)
        
        self.platooning = 20 < min_dist < 70
        self.cd = 0.4 if self.platooning else 0.8
        self.action = "PLATOONING" if self.platooning else ("CHARGING" if self.state=="CHARGING" else "CRUISE")

        # Layer 1 充電指令
        if decision.get("charge_vehicle") == self.id and self.state != "CHARGING":
            self.state = "RETURN_HUB"

        # 到充電站
        for s in stations:
            if s["is_hub"] and abs(self.progress - s["id"]/8) < 0.02 and self.state == "RETURN_HUB":
                self.state = "CHARGING"

        if self.state == "CHARGING":
            self.speed = 0
            self.soc = min(100, self.soc + 30*dt)
            if self.soc > 98: self.state = "MOVING"
            return

        target = 16 if self.platooning else 12
        if self.soc < 25: target = 8

        self.speed += (target - self.speed) * 3 * dt
        self.progress = (self.progress + self.speed * dt / 15000) % 1

        power = 0.0008 * self.cd * (self.speed**3) * (1 + (wind-12)*0.04) * dt
        self.soc -= power

        # 上下客
        for s in stations:
            if abs(self.progress - s["id"]/8) < 0.015 and random.random() < 0.4:
                if s["waiting"] > 0 and self.passengers == 0:
                    take = min(s["waiting"], 12)
                    self.passengers = take
                    s["waiting"] -= take
                    self.state = "BOARDING"
                    threading.Timer(4, lambda: setattr(self, "state", "MOVING")).start()
                elif self.passengers > 0:
                    self.passengers = 0
                    self.state = "BOARDING"
                    threading.Timer(2, lambda: setattr(self, "state", "MOVING")).start()

    def to_dict(self):
        return {
            "id": self.id,
            "progress": self.progress,
            "speed": round(self.speed*3.6, 1),
            "soc": round(self.soc, 1),
            "state": self.state,
            "action": self.action,
            "platooning": self.platooning,
            "cd": round(self.cd, 2),
            "passengers": self.passengers
        }

vehicles = [Vehicle(i) for i in range(5)]
wind_speed = 12.0

def fleet_manager():
    low_veh = [v for v in vehicles if v.soc < 30]
    total_wait = sum(s["waiting"] for s in stations)
    return {"charge_vehicle": min(low_veh, key=lambda v:v.soc).id if low_veh and total_wait < 25 else None}

def sim_loop():
    global wind_speed
    while True:
        dt = 0.1
        wind_speed = 10 + 9*math.sin(time.time()/25)

        if random.random() < 0.25:
            s = random.choice([s for s in stations if not s["is_hub"]])
            s["waiting"] += random.randint(1,5)

        decision = fleet_manager()
        for v in vehicles: v.update(dt, vehicles, wind_speed, decision)

        socketio.emit('update', {
            "vehicles": [v.to_dict() for v in vehicles],
            "stations": stations.copy(),
            "wind": round(wind_speed,1),
            "attractions": ATTRACTIONS
        })
        time.sleep(dt)

@app.route('/')
def index(): return render_template('index.html')

@socketio.on('connect')
def connect():
    socketio.emit('config', {"stations": stations})

if __name__ == '__main__':
    threading.Thread(target=sim_loop, daemon=True).start()
    socketio.run(app, port=5000, debug=True)