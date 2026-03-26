"""
Garbage Detection — predict.py
Uses CLIP zero-shot classification if available, otherwise falls back to
OpenCV color/texture analysis for garbage-like patterns.

Usage: python predict.py <image_path>
Output: JSON on stdout
"""
import sys, json, os
import numpy as np
import cv2


def detect_garbage_cv(image_path):
    """
    Detect garbage/litter using OpenCV image analysis:
    - Color diversity (garbage is usually multi-colored)
    - Texture roughness (garbage has irregular textures)
    - Edge density (garbage piles have many edges)
    - Dark/brown/dirty color detection
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"detected": False, "confidence": 0.0, "label": "invalid_image", "bbox": []}

    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Color diversity — garbage tends to have many different colors
    # Quantize the hue channel and count unique hue bins
    hue = hsv[:, :, 0]
    hist_hue = cv2.calcHist([hue], [0], None, [18], [0, 180])
    hist_hue = hist_hue.flatten() / (h * w)
    active_bins = int(np.sum(hist_hue > 0.02))
    diversity_score = float(min(active_bins / 12.0, 1.0))

    # 2. Edge density — garbage piles have many edges / irregularities
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / (h * w)
    edge_score = float(min(edge_density / 0.15, 1.0))

    # 3. Texture roughness (Laplacian variance)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    texture_score = float(min(lap_var / 1500.0, 1.0))

    # 4. Dirty/brown/earthy color detection
    # Brown range in HSV
    lower_brown = np.array([8, 40, 40])
    upper_brown = np.array([30, 200, 180])
    brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)
    brown_ratio = float(cv2.countNonZero(brown_mask)) / (h * w)

    # Dark dirty areas
    dark_mask = gray < 80
    dark_ratio = float(np.sum(dark_mask)) / (h * w)

    dirty_score = float(min((brown_ratio * 3.0) + (dark_ratio * 1.5), 1.0))

    # 5. Non-uniform brightness (garbage piles have uneven lighting)
    local_std = cv2.GaussianBlur(gray.astype(np.float32), (31, 31), 0)
    local_var_map = (gray.astype(np.float32) - local_std) ** 2
    non_uniformity = float(np.mean(local_var_map))
    non_uniform_score = float(min(non_uniformity / 2500.0, 1.0))

    # Weighted confidence
    confidence = (
        diversity_score * 0.20 +
        edge_score * 0.25 +
        texture_score * 0.20 +
        dirty_score * 0.20 +
        non_uniform_score * 0.15
    )
    confidence = round(float(min(max(confidence, 0.0), 1.0)), 4)

    detected = confidence >= 0.35

    # Bounding box — find region with most edges (likely garbage)
    bbox = []
    if detected:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dilated = cv2.dilate(edges, kernel, iterations=2)
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, bw, bh = cv2.boundingRect(largest)
            bbox = [int(x), int(y), int(bw), int(bh)]

    return {
        "detected": detected,
        "confidence": confidence,
        "label": "garbage_detected" if detected else "clean_area",
        "bbox": bbox
    }


def detect_garbage_clip(image_path):
    """Use CLIP zero-shot classification for garbage detection."""
    try:
        import torch
        from PIL import Image
        from transformers import CLIPProcessor, CLIPModel

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

        image = Image.open(image_path).convert("RGB")

        garbage_prompts = [
            "a photo of garbage, trash, litter, waste, rubbish",
            "a pile of garbage on the ground",
            "plastic bottles and trash scattered",
            "dumped waste and debris",
        ]
        clean_prompts = [
            "a clean ground with no garbage",
            "empty clean street",
            "clean pavement or road",
            "a tidy urban area",
        ]

        texts = garbage_prompts + clean_prompts
        inputs = processor(text=texts, images=image, return_tensors="pt", padding=True).to(device)

        with torch.no_grad():
            outputs = model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=1)[0]

        # Sum probabilities for garbage vs clean
        garbage_prob = float(sum(probs[i].item() for i in range(len(garbage_prompts))))
        clean_prob = float(sum(probs[i].item() for i in range(len(garbage_prompts), len(texts))))

        confidence = round(garbage_prob, 4)
        detected = confidence >= 0.55

        # Get bbox from CV method
        cv_result = detect_garbage_cv(image_path)

        return {
            "detected": detected,
            "confidence": confidence,
            "label": "garbage_detected" if detected else "clean_area",
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

    # Try CLIP first, fallback to CV
    result = detect_garbage_clip(image_path)
    if result is None:
        result = detect_garbage_cv(image_path)

    print(json.dumps(result))
