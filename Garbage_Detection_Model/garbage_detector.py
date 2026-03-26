import torch
from PIL import Image
import requests
from io import BytesIO
from transformers import CLIPProcessor, CLIPModel

# ================== CONFIG ==================
# Choose device: 'cuda' if you have GPU, else 'cpu'
device = "cuda" if torch.cuda.is_available() else "cpu"

# Load CLIP model (zero-shot classification - no training needed)
print("Loading model... (first run may take 10-30 seconds)")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# Garbage-related text prompts (you can add more)
GARBAGE_PROMPTS = [
    "a photo of garbage, trash, litter, waste, rubbish",
    "a pile of garbage on the ground",
    "plastic bottles and trash scattered",
    "dumped waste",
]

CLEAN_PROMPTS = [
    "a clean ground with no garbage",
    "empty clean street",
    "clean pavement",
    "no trash visible",
]

print(f"Model loaded successfully on {device.upper()}!")

def detect_garbage(image_path_or_url):
    """
    Main function: Detects if the image contains garbage.
    Returns: dict with result, confidence, and message.
    """
    # Load image from file or URL
    if isinstance(image_path_or_url, str) and image_path_or_url.startswith(("http://", "https://")):
        response = requests.get(image_path_or_url)
        image = Image.open(BytesIO(response.content)).convert("RGB")
    else:
        image = Image.open(image_path_or_url).convert("RGB")

    # Prepare text prompts
    texts = GARBAGE_PROMPTS + CLEAN_PROMPTS

    # Process image + text
    inputs = processor(text=texts, images=image, return_tensors="pt", padding=True).to(device)

    # Get model outputs
    with torch.no_grad():
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image  # image-to-text similarity
        probs = logits_per_image.softmax(dim=1)[0]   # convert to probabilities

    # Find best matching prompt
    best_idx = probs.argmax().item()
    best_prob = probs[best_idx].item()
    best_text = texts[best_idx]

    # Decide YES/NO
    is_garbage = best_idx < len(GARBAGE_PROMPTS)  # first half are garbage prompts

    if is_garbage and best_prob > 0.55:   # threshold (you can tune this)
        result = "YES"
        message = f"YES - Garbage detected! Confidence: {best_prob:.1%}"
    else:
        result = "NO"
        message = f"NO - No significant garbage detected. Confidence: {best_prob:.1%}"

    print(message)
    print(f"Best matching description: {best_text}")

    return {
        "result": result,
        "confidence": best_prob,
        "message": message,
        "best_description": best_text
    }


# ================== EXAMPLE USAGE ==================
if __name__ == "__main__":
    # Option 1: Local image
    # result = detect_garbage("path/to/your/garbage_photo.jpg")

    # Option 2: Image from URL (uncomment and replace)
    # result = detect_garbage("https://example.com/garbage-image.jpg")

    # Test with a placeholder (replace with real path/URL)
    print("\n=== Garbage Detection Test ===")
    # Replace the line below with your image path or URL
    test_image = "garbage_test.jpg"   # <-- CHANGE THIS
    
    try:
        detect_garbage(test_image)
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure the image path or URL is correct.")