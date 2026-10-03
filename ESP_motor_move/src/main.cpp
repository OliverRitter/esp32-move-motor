#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <ESP32Servo.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

// 🔴 TYPE YOUR EXACT HOME NETWORK DETAILS HERE:
const char* ssid = "Oliver";
const char* password = "99999999";

// Wireless UDP Configuration
unsigned int localUdpPort = 5005;
WiFiUDP udp;
char packetBuffer[32]; // 🟢 FIXED: Added [32] to create a true text array memory block!

// 📌 RETURNING EXCLUSIVELY TO YOUR ORIGINAL PROVEN PIN LAYOUT
#define TFT_RST   4
#define TFT_CS    5
#define TFT_DC    6
#define TFT_MOSI  11
#define TFT_CLK   12
#define TFT_MISO  13

// Software SPI constructor using your custom 11/12/13 tracking lines
Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_MOSI, TFT_CLK, TFT_RST, TFT_MISO);

// 📌 MOTOR PIN CONFIGURATION
#define PAN_PIN 17   // Bottom Motor (Left/Right)
#define TILT_PIN 18  // Top Motor (Up/Down)
Servo panServo;
Servo tiltServo;

void setup() {
  Serial.begin(115200);
  delay(1000); 
  Serial.println("\n--- Initializing New Project Baseline Firmware ---");
  
  // 1. Initialize Display Subsystem
  tft.begin();
  tft.setRotation(3); // Landscape Mode Layout
  tft.fillScreen(ILI9341_NAVY);
  
  // Draw Dashboard UI Header Lines
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);
  tft.setCursor(10, 20);
  tft.println("ESP32-S3 PTZ RIG v1.0");
  tft.drawLine(0, 45, 320, 45, ILI9341_CYAN);

  // 2. Setup Servo Motors and Timers
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  
  panServo.setPeriodHertz(50);
  tiltServo.setPeriodHertz(50);
  panServo.attach(PAN_PIN, 500, 2500);
  tiltServo.attach(TILT_PIN, 500, 2500);
  
  // Center actuators instantly (1500us = 90 Degrees)
  panServo.writeMicroseconds(1500);
  tiltServo.writeMicroseconds(1500);
  
  tft.setCursor(10, 60);
  tft.println("Status: Connecting WiFi...");

  // 3. Kickstart WiFi Network Subsystem
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  // 4. Update UI Outputs Based on Connection Result
  tft.fillRect(10, 60, 300, 30, ILI9341_NAVY); // Wipe status line
  tft.setCursor(10, 60);
  
  if (WiFi.status() == WL_CONNECTED) {
    tft.setTextColor(ILI9341_GREEN);
    tft.println("Status: WiFi CONNECTED!");
    
    tft.setTextColor(ILI9341_YELLOW);
    tft.setTextSize(2);
    tft.setCursor(10, 110);
    tft.println("TARGET IP FOR PYTHON:");
    
    // Render the active routing address huge on the physical panel
    tft.setTextSize(3);
    tft.setCursor(10, 140);
    tft.println(WiFi.localIP().toString());
    
    tft.setTextSize(2);
    tft.setTextColor(ILI9341_CYAN);
    tft.setCursor(10, 200);
    tft.println("Listening on Port 5005...");
    
    udp.begin(localUdpPort);
    Serial.print("\n🎉 Success! Target IP: ");
    Serial.println(WiFi.localIP());
  } else {
    tft.setTextColor(ILI9341_RED);
    tft.println("Status: Connection Failed!");
    Serial.println("\n❌ WiFi Link Failed.");
  }
}

void loop() {
  // Continuous check for tracking bytes coming over the wireless network
  int packetSize = udp.parsePacket();
  if (packetSize) {
    int len = udp.read(packetBuffer, 31);
    if (len > 0) {
      packetBuffer[len] = 0; // Terminate string tracking data safely
      
      // Look for the "P" positioning start flag character
      if (packetBuffer[0] == 'P') { // 🟢 FIXED: Access character index explicitly
        int panTarget = 1500;
        int tiltTarget = 1500;
        
        // Parse raw pulse durations natively via sscanf data mapping
        if (sscanf(packetBuffer, "P%dT%d", &panTarget, &tiltTarget) == 2) {
          // Enforce strict physical safety protections before writing registers
          if (panTarget >= 600 && panTarget <= 2400) {
            panServo.writeMicroseconds(panTarget);
          }
          if (tiltTarget >= 1000 && tiltTarget <= 2000) {
            tiltServo.writeMicroseconds(tiltTarget);
          }
        }
      }
    }
  }
}
