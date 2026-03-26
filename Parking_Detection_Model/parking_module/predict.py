"""
Parking Detection — predict.py
Detects illegal/dense parking by analyzing vehicle presence and density
in parking areas using OpenCV.

Usage: python predict.py <image_path>
Output: JSON on stdout
"""
import sys, json, os
import numpy as np
import cv2


def detect_parking(image_path):
    """
    Detect parking violations/congestion:
    - Vehicle-like rectangular shapes
    - Dense object clustering
    - Road/lane blockage analysis
    - Color patterns typical of vehicles (metallic, dark)
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"detected": False, "confidence": 0.0, "label": "invalid_image", "bbox": []}

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # 1. Detect vehicle-like shapes using edge detection + contour analysis
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 120)

    # Dilate to connect nearby edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    total_area = h * w
    vehicle_candidates = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        area_ratio = area / total_area

        # Vehicle-sized objects: not too small, not too large
        if area_ratio < 0.008 or area_ratio > 0.35:
            continue

        # Vehicles are roughly rectangular
        x, y, bw, bh = cv2.boundingRect(cnt)
        rect_area = bw * bh
        if rect_area == 0:
            continue
        fill_ratio = area / rect_area
        aspect_ratio = max(bw, bh) / (min(bw, bh) + 1)

        # Vehicle shape: somewhat rectangular (0.4-0.9 fill), 
        # aspect ratio between 1-4 (not too elongated)
        if fill_ratio < 0.3 or aspect_ratio > 5:
            continue

        vehicle_candidates.append({
            "bbox": [int(x), int(y), int(bw), int(bh)],
            "area_ratio": area_ratio,
            "fill_ratio": fill_ratio,
        })

    num_vehicles = len(vehicle_candidates)

    # 2. Metallic/vehicle color detection
    # Vehicles: dark/metallic (low saturation, varying value)
    lower_metal = np.array([0, 0, 30])
    upper_metal = np.array([180, 60, 180])
    metal_mask = cv2.inRange(hsv, lower_metal, upper_metal)
    metal_ratio = cv2.countNonZero(metal_mask) / total_area

    # 3. Dense line detection (parked vehicles create parallel lines)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, minLineLength=30, maxLineGap=10)
    num_lines = 0 if lines is None else len(lines)
    line_density = min(num_lines / 80.0, 1.0)

    # 4. Compute density of vehicle-like objects
    coverage = sum(c["area_ratio"] for c in vehicle_candidates)

    # Scoring
    vehicle_count_score = min(num_vehicles / 6.0, 1.0)  # 6+ vehicles = max
    coverage_score = min(coverage / 0.35, 1.0)  # 35%+ coverage = max
    metal_score = min(metal_ratio / 0.3, 1.0)

    confidence = (
        vehicle_count_score * 0.35 +
        coverage_score * 0.25 +
        metal_score * 0.20 +
        line_density * 0.20
    )
    confidence = round(min(max(confidence, 0.0), 1.0), 4)

    detected = confidence >= 0.35 and num_vehicles >= 2

    # Best bounding box: enclosure of all detected vehicles
    bbox = []
    if detected and vehicle_candidates:
        xs = [c["bbox"][0] for c in vehicle_candidates]
        ys = [c["bbox"][1] for c in vehicle_candidates]
        xes = [c["bbox"][0] + c["bbox"][2] for c in vehicle_candidates]
        yes = [c["bbox"][1] + c["bbox"][3] for c in vehicle_candidates]
        bbox = [int(min(xs)), int(min(ys)), int(max(xes) - min(xs)), int(max(yes) - min(ys))]

    return {
        "detected": detected,
        "confidence": confidence,
        "label": "illegal_parking_detected" if detected else "parking_clear",
        "bbox": bbox
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "no_input", "bbox": []}))
        sys.exit(0)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"detected": False, "confidence": 0.0, "label": "file_not_found", "bbox": []}))
        sys.exit(0)

    result = detect_parking(image_path)
    print(json.dumps(result))
