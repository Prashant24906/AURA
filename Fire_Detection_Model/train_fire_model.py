import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from tensorflow.keras.models import Model
import os

# Correct path - using raw string or forward slashes
data_dir = r'dataset'          # Best way for Windows

# Check if folders exist
if not os.path.exists(data_dir):
    print(f"❌ Error: '{data_dir}' folder not found!")
    print("Make sure you have 'dataset' folder with 'fire' and 'no_fire' subfolders.")
    exit()

# Count images to show user
fire_count = len(os.listdir(os.path.join(data_dir, 'fire'))) if os.path.exists(os.path.join(data_dir, 'fire')) else 0
nofire_count = len(os.listdir(os.path.join(data_dir, 'no_fire'))) if os.path.exists(os.path.join(data_dir, 'no_fire')) else 0

print(f"✅ Found {fire_count} fire images and {nofire_count} no-fire images")

# Data generators
datagen = ImageDataGenerator(
    rescale=1./255,
    validation_split=0.2,
    rotation_range=20,
    zoom_range=0.2,
    horizontal_flip=True
)

train_gen = datagen.flow_from_directory(
    data_dir,
    target_size=(224, 224),
    batch_size=32,
    class_mode='binary',
    subset='training'
)

val_gen = datagen.flow_from_directory(
    data_dir,
    target_size=(224, 224),
    batch_size=32,
    class_mode='binary',
    subset='validation'
)

# Build model
base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation='relu')(x)
predictions = Dense(1, activation='sigmoid')(x)

model = Model(inputs=base_model.input, outputs=predictions)

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

print("\n🚀 Starting training... This may take 5-15 minutes depending on your PC.")

history = model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=10,
    verbose=1
)

# Save the model
os.makedirs('models', exist_ok=True)
model.save('models/fire_detection_model.h5')

print("\n🎉 Training finished successfully!")
print("Model saved at: models/fire_detection_model.h5")