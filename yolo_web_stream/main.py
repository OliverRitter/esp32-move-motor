import io
import os
import socket
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from PIL import Image

# Force X11 simulation for OpenCV stability on Wayland desktops
os.environ["QT_QPA_PLATFORM"] = "xcb"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# 1. INITIALIZE MODERN MEDIAPIPE TASKS HAND LANDMARKER (Python 3.13)
# =====================================================================
base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=1,
    min_hand_detection_confidence=0.1,  
    min_hand_presence_confidence=0.1
)
detector = vision.HandLandmarker.create_from_options(options)

# =====================================================================
# 2. HARDWARE NETWORK CONFIGURATION
# =====================================================================
ESP32_IP = "192.168.43.221"  # 🎯 Matches your physical screen IP target!
ESP32_PORT = 5005
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

current_pan = 1500
current_tilt = 1500

# High speed settings for responsive tracking steps
PAN_SPEED_MODIFIER = 250  
TILT_SPEED_MODIFIER = 200 

@app.websocket("/ws/vision")
async def vision_stream(websocket: WebSocket):
    global current_pan, current_tilt
    await websocket.accept()
    print("-> React frontend connected to Unified Hand-Tracking Engine!")
    
    try:
        while True:
            # 1. Read raw compressed frame bytes from the browser window
            bytes_data = await websocket.receive_bytes()
            
            # 2. Convert binary stream into an OpenCV image matrix
            image = Image.open(io.BytesIO(bytes_data))
            frame_np = np.array(image)
            
            # Tasks API natively expects a MediaPipe Image object format
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_np)
            
            # 3. Offload AI tracking to background thread to protect event loop
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, lambda: detector.detect(mp_image))
            
            detections = []

            # 4. 🎯 FIXED MODERN DATA PROPERTIES EXTRACTION MATRIX
            if results.hand_landmarks and len(results.hand_landmarks) > 0:
                # Reach directly inside the first hand array list envelope
                first_hand_points = results.hand_landmarks[0]
                
                if len(first_hand_points) > 8:
                    # 🎯 FIXED NESTED LOOKUP: Explicitly pull index 8 for your fingertip!
                    index_tip = first_hand_points[8]
                    
                    # --- CHANNEL A: HARDWARE MOTOR TRACKING MATHEMATICS (MIRRORED) ---
                    motor_x = 1.0 - index_tip.x  
                    motor_y = index_tip.y
                    
                    diff_x = motor_x - 0.50
                    diff_y = motor_y - 0.50
                    
                    if abs(diff_x) < 0.04: diff_x = 0
                    if abs(diff_y) < 0.04: diff_y = 0

                    current_pan += int(diff_x * PAN_SPEED_MODIFIER)
                    current_tilt += int(diff_y * TILT_SPEED_MODIFIER)

                    # --- CHANNEL B: BROWSER OVERLAY VISUAL MARKER MATHEMATICS (UNMIRRORED) ---
                    pixel_x = int(index_tip.x * 640) - 30
                    pixel_y = int(index_tip.y * 480) + 25  # +25 pulls the box down onto your fingernail

                    # Pack your finger position into a tiny box for your React overlay script
                    detections.append({
                        "label": "FINGERTIP",
                        "confidence": 1.0,
                        "box": [pixel_x - 15, pixel_y - 15, pixel_x + 15, pixel_y + 15]
                    })

            else:
                # Fallback slow return-to-center drift if hand goes out of view
                if current_pan > 1500: current_pan -= 2
                elif current_pan < 1500: current_pan += 2
                if current_tilt > 1500: current_tilt -= 2
                elif current_tilt < 1500: current_tilt += 2

            # Apply strict physical safety limits to protect the internal servo gears
            current_pan = max(600, min(current_pan, 2400))
            current_tilt = max(1000, min(current_tilt, 2000))

            # =====================================================================
            # ⚙️ WIRELESS UDP PACKET TRANSMISSION TO MOTOR RIG
            # =====================================================================
            command_packet = f"P{current_pan}T{current_tilt}"
            try:
                udp_sock.sendto(command_packet.encode('utf-8'), (ESP32_IP, ESP32_PORT))
            except Exception:
                pass # Silently drop network blips

            # Send data blocks back to React to trigger layout drawing
            await websocket.send_json({"objects": detections})
            
    except WebSocketDisconnect:
        print("Frontend disconnected.")
