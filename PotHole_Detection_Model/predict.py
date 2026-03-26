"""
Pothole Detection — predict.py
Analyzes road images for potholes using computer vision (OpenCV).
Looks for dark circular/oval depressions on road surfaces.

Usage: python predict.py <image_path>
Output: JSON on stdout
"""
import sys, json, os
import numpy as np
import cv2


def detect_pothole(image_path):
    """
    Detect potholes using OpenCV:
    - Dark region detection on road surface
    - Edge analysis for hole-like contours
    - Circular/oval shape matching
    - Texture contrast with surrounding area
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"detected": False, "confidence": 0.0, "label": "invalid_image", "bbox": []}

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Focus on the lower 2/3 of the image (road is usually in bottom half)
    road_region = gray[h // 3:, :]
    road_color = img[h // 3:, :]
    rh, rw = road_region.shape[:2]

    # 1. Detect dark spots (potholes are darker than surrounding road)
    # Adaptive thresholding detects locally dark areas
    blurred = cv2.GaussianBlur(road_region, (15, 15), 0)
    # Areas significantly darker than their neighborhood
    diff = blurred.astype(np.float32) - road_region.astype(np.float32)
    dark_spots = (diff > 25).astype(np.uint8) * 255

    # Also absolute dark threshold
    _, abs_dark = cv2.threshold(road_region, 70, 255, cv2.THRESH_BINARY_INV)

    # Combine both methods
    combined_mask = cv2.bitwise_or(dark_spots, abs_dark)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)

    # 2. Find contours that look like potholes
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    pothole_candidates = []
    total_area = rh * rw

    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Filter by area — potholes are medium-sized relative to image
        area_ratio = area / total_area
        if area_ratio < 0.005 or area_ratio > 0.4:
            continue

        # Circularity check (potholes are roughly circular/oval)
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter ** 2)

        # Potholes: 0.2 < circularity < 0.9 (roughly round but not perfect circles)
        if circularity < 0.15:
            continue

        # Check that the region is truly darker than surroundings
        mask_single = np.zeros((rh, rw), dtype=np.uint8)
        cv2.drawContours(mask_single, [cnt], -1, 255, -1)
        inner_mean = float(np.mean(road_region[mask_single > 0]))

        # Dilate to get surrounding
        dilated = cv2.dilate(mask_single, kernel, iterations=2)
        ring = cv2.bitwise_and(dilated, cv2.bitwise_not(mask_single))
        outer_pixels = road_region[ring > 0]
        outer_mean = float(np.mean(outer_pixels)) if len(outer_pixels) > 0 else inner_mean

        darkness_diff = outer_mean - inner_mean  # positive = inner is darker

        if darkness_diff < 10:  # not significantly darker
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)

        # Score this candidate
        dark_score = min(darkness_diff / 60.0, 1.0)
        shape_score = min(circularity / 0.6, 1.0)
        size_score = min(area_ratio / 0.08, 1.0)

        candidate_conf = dark_score * 0.45 + shape_score * 0.30 + size_score * 0.25
        pothole_candidates.append({
            "confidence": candidate_conf,
            "bbox": [int(x), int(y + h // 3), int(bw), int(bh)],
            "area_ratio": area_ratio,
        })

    # 3. Edge density in road area (potholes create edges)
    edges = cv2.Canny(road_region, 50, 150)
    edge_density = np.sum(edges > 0) / total_area
    edge_bonus = min(edge_density / 0.12, 0.15)

    # 4. Texture analysis — road variance
    lap_var = cv2.Laplacian(road_region, cv2.CV_64F).var()
    texture_bonus = min(lap_var / 2000.0, 0.1)

    if pothole_candidates:
        # Use best candidate
        best = max(pothole_candidates, key=lambda c: c["confidence"])
        confidence = round(min(best["confidence"] + edge_bonus + texture_bonus, 1.0), 4)
        detected = confidence >= 0.30
        bbox = best["bbox"]
    else:
        confidence = round(min(edge_bonus + texture_bonus, 1.0), 4)
        detected = False
        bbox = []

    return {
        "detected": detected,
        "confidence": confidence,
        "label": "pothole_detected" if detected else "road_clear",
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

    result = detect_pothole(image_path)
    print(json.dumps(result))
