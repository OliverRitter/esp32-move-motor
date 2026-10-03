import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);

  useEffect(() => {
    let isComponentMounted = true;
    let animationFrameId = null;
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 200; // Target exactly 5 frames per second

    console.log("Attempting to connect to FastAPI WebSocket...");
    const ws = new WebSocket("ws://127.0.0.1:8080/ws/vision");
    wsRef.current = ws;

    // Direct loop handler function
    const streamCaptureLoop = (timestamp) => {
      if (!isComponentMounted) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && ws.readyState === WebSocket.OPEN) {
        // Throttling mechanism to keep target speed consistent
        if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
          // Check if camera stream is active and pumping real data
          if (video.readyState >= 2 && video.videoWidth > 0) {
            const ctx = canvas.getContext("2d");

            // Set canvas size to match the incoming camera size automatically
            if (canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }

            // Capture current visual camera frame state
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Transmit compressed JPEG data down the open channel
            canvas.toBlob(
              (blob) => {
                if (blob && ws.readyState === WebSocket.OPEN) {
                  ws.send(blob);
                }
              },
              "image/jpeg",
              0.6,
            );

            lastFrameTime = timestamp;
          }
        }
      }
      // Re-queue execution loop smoothly
      animationFrameId = requestAnimationFrame(streamCaptureLoop);
    };

    ws.onopen = () => {
      if (!isComponentMounted) return;
      console.log("🟢 WebSocket Successfully Connected!");
      setIsConnected(true);

      // Kickstart continuous data collection stream loop
      animationFrameId = requestAnimationFrame(streamCaptureLoop);
    };

    ws.onclose = () => {
      if (isComponentMounted) {
        console.log("🔴 WebSocket Closed.");
        setIsConnected(false);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      }
    };

    ws.onmessage = (event) => {
      if (!isComponentMounted) return;
      const data = JSON.parse(event.data);
      console.log("AI Data Received:", data.objects);
      setDetectedObjects(data.objects);
    };

    // Open physical camera device interface configuration details
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        if (isComponentMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          // Force manual play event assertion if browser halts autoplay structures
          videoRef.current
            .play()
            .catch((e) => console.log("Autoplay waiting for action..."));
        }
      })
      .catch((err) => console.error("Error accessing webcam:", err));

    // Structural lifecycle safe container destruction unmount operations
    return () => {
      isComponentMounted = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        console.log("Cleaning up WebSocket interface...");
        ws.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans flex flex-col items-center">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight bg-linear-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          FastAPI + YOLOv8 + React Stream
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
          <span>Status:</span>
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to AI Server
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Disconnected
            </span>
          )}
        </div>
      </header>

      {/* Box canvas element alignment block layout positioning */}
      <div className="relative w-160 h-120 bg-slate-950 rounded-xl overflow-hidden shadow-2xl border border-slate-800">
        {/* Layer 1: The Raw Web Cam feed (mirrored layout) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* Layer 2: Hidden canvas used strictly to capture binary images */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Layer 3: Pure HTML bounding boxes drawn exactly over the video frame */}
        {detectedObjects.map((obj, index) => {
          const [x1, y1, x2, y2] = obj.box;

          // Mirror rendering axis correction factor offset operations
          const mirroredX1 = 640 - x2;
          const width = x2 - x1;
          const height = y2 - y1;

          return (
            <div
              key={index}
              className="absolute border-3 border-cyan-400 rounded pointer-events-none transition-all duration-300 ease-out"
              style={{
                left: `${mirroredX1}px`,
                top: `${y1}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              <span className="absolute -top-6 -left-0.75 bg-cyan-400 text-slate-950 px-2 py-0.5 text-xs font-black uppercase tracking-wider whitespace-nowrap rounded-t">
                {obj.label} {Math.round(obj.confidence * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
