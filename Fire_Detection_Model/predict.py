"""
Fire Detection — predict.py
Analyzes an image for fire presence using color-based detection (HSV warm tones)
and optional TF model if fire_detection_model.h5 exists.

Usage: python predict.py <image_path>
Output: JSON on stdout
"""
import sys, json, os
import numpy as np
import cv2

def detect_fire_cv(image_path):
    """
    Detect fire using OpenCV color analysis.
    Fire has strong warm tones (red/orange/yellow) in HSV space.
    Also checks for brightness intensity typical of flames.
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"detected": False, "confidence": 0.0, "label": "invalid_image", "bbox": []}

    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Fire color ranges in HSV
    # Range 1: Red-orange fire (low hue)
    lower1 = np.array([0, 80, 150])
    upper1 = np.array([25, 255, 255])
    # Range 2: Red wrap-around (high hue)
    lower2 = np.array([160, 80, 150])
    upper2 = np.array([180, 255, 255])
    # Range 3: Yellow-orange flames
    lower3 = np.array([20, 100, 180])
    upper3 = np.array([40, 255, 255])

    mask1 = cv2.inRange(hsv, lower1, upper1)
    mask2 = cv2.inRange(hsv, lower2, upper2)
    mask3 = cv2.inRange(hsv, lower3, upper3)
    fire_mask = cv2.bitwise_or(mask1, cv2.bitwise_or(mask2, mask3))

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_CLOSE, kernel)
    fire_mask = cv2.morphologyEx(fire_mask, cv2.MORPH_OPEN, kernel)

    total_pixels = h * w
    fire_pixels = cv2.countNonZero(fire_mask)
    fire_ratio = fire_pixels / total_pixels

    # Check brightness in fire regions — real fire is bright
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    fire_brightness = gray[fire_mask > 0]
    avg_brightness = float(np.mean(fire_brightness)) if len(fire_brightness) > 0 else 0

    # Compute flickering / texture variance in fire region (flames have high variance)
    fire_region_var = float(np.var(fire_brightness)) if len(fire_brightness) > 10 else 0

    # Score components
    color_score = min(fire_ratio * 8.0, 1.0)  # 12.5% coverage = max
    brightness_score = min(avg_brightness / 220.0, 1.0) if avg_brightness > 100 else 0
    texture_score = min(fire_region_var / 3000.0, 1.0)

    # Weighted confidence
    confidence = (color_score * 0.55) + (brightness_score * 0.25) + (texture_score * 0.20)
    confidence = round(min(max(confidence, 0.0), 1.0), 4)

    # Detection threshold
    detected = confidence >= 0.30 and fire_ratio >= 0.02

    # Bounding box of fire region
    bbox = []
    if detected:
        contours, _ = cv2.findContours(fire_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            all_pts = np.vstack(contours)
            x, y, bw, bh = cv2.boundingRect(all_pts)
            bbox = [int(x), int(y), int(bw), int(bh)]

    label = "fire_detected" if detected else "no_fire"

    return {
        "detected": detected,
        "confidence": confidence,
        "label": label,
        "bbox": bbox
    }

def detect_fire_tf(image_path, model_path):
    """Use trained TF model if available."""
    try:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        import tensorflow as tf
        from tensorflow.keras.preprocessing import image as keras_image

        model = tf.keras.models.load_model(model_path)
        img = keras_image.load_img(image_path, target_size=(224, 224))
        img_array = keras_image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0

        prediction = float(model.predict(img_array, verbose=0)[0][0])

        # Model trained: class 0=fire, 1=no_fire (depends on directory order)
        # The dataset has 'fire' first alphabetically, so class_index 0 = fire
        # Binary output: prediction > 0.5 means class 1 (no_fire)
        fire_confidence = 1.0 - prediction  # flip: higher = more fire
        detected = fire_confidence >= 0.45

        # Get bbox from CV method as TF model doesn't provide one
        cv_result = detect_fire_cv(image_path)

        return {
            "detected": detected,
            "confidence": round(fire_confidence, 4),
            "label": "fire_detected" if detected else "no_fire",
            "bbox": cv_result.get("bbox", [])
        }
    except Exception as e:
        # Fallback to CV method
        return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "no_input", "bbox": []}))
        sys.exit(0)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "file_not_found", "bbox": []}))
        sys.exit(0)

    # Try TF model first, fallback to CV
    model_h5 = os.path.join(os.path.dirname(__file__), "models", "fire_detection_model.h5")
    result = None
    if os.path.exists(model_h5):
        result = detect_fire_tf(image_path, model_h5)

    if result is None:
        result = detect_fire_cv(image_path)

    print(json.dumps(result))
