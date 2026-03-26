import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import sys

# Load your trained model
model = tf.keras.models.load_model('fire_detection_model.h5')

def detect_fire(image_path):
    img = image.load_img(image_path, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0) / 255.0
    
    prediction = model.predict(img_array)[0][0]
    
    if prediction > 0.5:
        print(f"🔥 FIRE DETECTED! (confidence: {prediction:.2f})")
    else:
        print(f"✅ No fire (confidence: {1-prediction:.2f})")

# Usage
if len(sys.argv) > 1:
    detect_fire(sys.argv[1])
else:
    print("Usage: python detect_fire.py your_image.jpg")