"""
Traffic Detection — predict.py
Detects heavy traffic / congestion using OpenCV analysis.
Optionally uses trained TF model if traffic_model.h5 exists.

Usage: python predict.py <image_path>
Output: JSON on stdout
"""
import sys, json, os
import numpy as np
import cv2


def detect_traffic_cv(image_path):
    """
    Detect heavy traffic / congestion using OpenCV:
    - Vehicle density estimation via contour detection
    - Road surface coverage
    - Edge density (more vehicles = more edges)
    - Color analysis for vehicle presence
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"detected": False, "confidence": 0.0, "label": "invalid_image", "bbox": []}

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Focus on center + lower portion (where road/vehicles are visible)
    road_y = h // 4
    road_region = gray[road_y:, :]
    road_color = img[road_y:, :]
    road_hsv = hsv[road_y:, :]
    rh, rw = road_region.shape[:2]
    total_pixels = rh * rw

    # 1. Edge density — busy roads have lots of edges
    blurred = cv2.GaussianBlur(road_region, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 130)
    edge_density = float(np.sum(edges > 0)) / total_pixels
    edge_score = float(min(edge_density / 0.18, 1.0))

    # 2. Vehicle-like object detection
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh_inv = cv2.bitwise_not(thresh)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 5))
    cleaned = cv2.morphologyEx(thresh_inv, cv2.MORPH_CLOSE, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    vehicle_count = 0
    vehicle_area = 0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        area_ratio = area / total_pixels
        if area_ratio < 0.005 or area_ratio > 0.3:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        aspect = max(bw, bh) / (min(bw, bh) + 1)
        if aspect > 6:
            continue
        vehicle_count += 1
        vehicle_area += area

    coverage = float(vehicle_area) / total_pixels
    density_score = float(min(vehicle_count / 10.0, 1.0))  # 10+ vehicles = max
    coverage_score = float(min(coverage / 0.45, 1.0))

    # 3. Color complexity — traffic scenes have many different colors
    hist_h = cv2.calcHist([road_hsv], [0], None, [18], [0, 180]).flatten()
    hist_h = hist_h / total_pixels
    active_hues = int(np.sum(hist_h > 0.015))
    color_diversity = float(min(active_hues / 12.0, 1.0))

    # 4. Horizontal line detection (lane markings, vehicle rows)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 40, minLineLength=40, maxLineGap=15)
    num_lines = 0 if lines is None else len(lines)
    line_score = float(min(num_lines / 60.0, 1.0))

    # 5. Texture variance (heavy traffic = complex scene)
    lap_var = float(cv2.Laplacian(road_region, cv2.CV_64F).var())
    texture_score = float(min(lap_var / 2000.0, 1.0))

    # Weighted scoring
    confidence = (
        edge_score * 0.25 +
        density_score * 0.25 +
        coverage_score * 0.20 +
        color_diversity * 0.15 +
        texture_score * 0.15
    )
    confidence = round(float(min(max(confidence, 0.0), 1.0)), 4)

    detected = confidence >= 0.40

    # Bounding box — full road area if congested
    bbox = []
    if detected:
        bbox = [0, int(road_y), int(w), int(rh)]

    return {
        "detected": detected,
        "confidence": confidence,
        "label": "heavy_traffic" if detected else "low_traffic",
        "bbox": bbox
    }


def detect_traffic_tf(image_path):
    """Use trained TF model if available."""
    try:
        model_path = os.path.join(os.path.dirname(__file__), "traffic_model.h5")
        if not os.path.exists(model_path):
            return None

        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        import tensorflow as tf
        model = tf.keras.models.load_model(model_path)

        img = cv2.imread(image_path)
        img = cv2.resize(img, (128, 128))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Apply CLAHE
        lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)

        img_input = enhanced.astype(np.float32) / 255.0
        img_input = np.expand_dims(img_input, axis=0)

        prediction = float(model.predict(img_input, verbose=0)[0][0])
        # class 0=low, 1=heavy
        is_heavy = prediction > 0.5
        confidence = round(prediction if is_heavy else (1 - prediction), 4)

        cv_result = detect_traffic_cv(image_path)

        return {
            "detected": is_heavy,
            "confidence": confidence,
            "label": "heavy_traffic" if is_heavy else "low_traffic",
            "bbox": cv_result.get("bbox", [])
        }
    except Exception:
        return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "no_input", "bbox": []}))
        sys.exit(0)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "file_not_found", "bbox": []}))
        sys.exit(0)

    # Try TF model, fallback to CV
    result = detect_traffic_tf(image_path)
    if result is None:
        result = detect_traffic_cv(image_path)

    print(json.dumps(result))
