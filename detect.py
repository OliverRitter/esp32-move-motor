from ultralytics import YOLO

# 1. Load a lightweight pre-trained model (YOLOv8 Nano)
# This will automatically download a tiny 6MB file named 'yolov8n.pt' on your first run.
model = YOLO("yolov8n.pt")

# 2. Run the image through the neural network
# 'conf=0.5' means only show objects the AI is at least 50% sure about
results = model.predict(source="dog.jpg", conf=0.5)

# 3. Print out what the AI found
for result in results:
    for box in result.boxes:
        # Get the numeric class ID (e.g., 0, 1, 2)
        class_id = int(box.cls[0])
        # Convert the ID to a human-readable name (e.g., "person", "bus")
        label = model.names[class_id]
        # Get the confidence score
        confidence = float(box.conf[0])
        
        print(f"Detected: {label} with {confidence:.2f} confidence")
