const { spawn } = require('child_process');
const path = require('path');
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');

const MODEL_MAP = {
  fire: 'Fire_Detection_Model',
  garbage: 'Garbage_Detection_Model',
  pothole: 'PotHole_Detection_Model',
  parking: 'Parking_Detection_Model/parking_module',
  traffic: 'Traffic_Detection_Model',
};

const MODEL_TYPES = {
  Fire_Detection_Model: 'fire',
  Garbage_Detection_Model: 'garbage',
  PotHole_Detection_Model: 'pothole',
  'Parking_Detection_Model/parking_module': 'parking',
  Traffic_Detection_Model: 'traffic',
};

function getSeverity(confidence) {
  if (confidence >= 0.85) return 'critical';
  if (confidence >= 0.65) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

async function runModel(modelName, imagePath) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '../../', modelName, 'predict.py');
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const proc = spawn(pythonPath, [scriptPath, imagePath]);
    let output = '';
    let errOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.stderr.on('data', (err) => {
      errOutput += err.toString();
      console.error(`[${modelName}] stderr:`, err.toString());
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        return resolve({ detected: false, error: `Exit code ${code}`, stderr: errOutput });
      }
      try {
        const trimmed = output.trim();
        const jsonStart = trimmed.lastIndexOf('{');
        const parsed = JSON.parse(jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed);
        resolve(parsed);
      } catch (e) {
        console.error(`[${modelName}] Parse error:`, e.message);
        resolve({ detected: false, error: 'Parse error' });
      }
    });
    proc.on('error', (err) => {
      console.error(`[${modelName}] Spawn error:`, err.message);
      resolve({ detected: false, error: err.message });
    });
  });
}

async function createIncidentFromDetection(modelName, result, imageUrl, userId, zone, socketService) {
  const incidentType = MODEL_TYPES[modelName] || modelName.split('_')[0].toLowerCase();
  const severity = getSeverity(result.confidence);

  const incident = await Incident.create({
    type: incidentType,
    severity,
    status: 'open',
    location: {
      address: zone || 'Unknown location',
      zone: zone || 'Unknown zone',
    },
    detectionData: {
      confidence: result.confidence,
      label: result.label,
      bbox: result.bbox || [],
      modelName,
    },
    imageUrl,
    reportedBy: userId,
  });

  const alert = await Alert.create({
    incidentId: incident._id,
    message: `${incidentType.charAt(0).toUpperCase() + incidentType.slice(1)} detected with ${(result.confidence * 100).toFixed(1)}% confidence`,
    type: incidentType,
    severity,
  });

  if (socketService) {
    socketService.emitNewAlert({ incident: incident.toObject(), alert: alert.toObject() });
  }

  return incident;
}

async function analyzeImage(imagePath, imageUrl, userId, zone, socketService, progressCallback) {
  const models = Object.keys(MODEL_MAP).map((k) => ({ key: k, dir: MODEL_MAP[k] }));
  const results = [];
  const createdIncidents = [];
  let processed = 0;

  for (const { key, dir } of models) {
    const result = await runModel(dir, imagePath);
    processed++;
    if (progressCallback) {
      progressCallback(Math.round((processed / models.length) * 100));
    }
    results.push({ model: dir, type: key, ...result });

    if (result.detected) {
      try {
        const incident = await createIncidentFromDetection(dir, result, imageUrl, userId, zone, socketService);
        createdIncidents.push(incident);
      } catch (err) {
        console.error(`[mlBridge] Failed to create incident for ${dir}:`, err.message);
      }
    }
  }

  return { results, incidents: createdIncidents };
}

async function analyzeImageSingleModel(imagePath, imageUrl, modelType, userId, zone, socketService) {
  const modelDir = MODEL_MAP[modelType];
  if (!modelDir) throw new Error(`Unknown model type: ${modelType}`);

  const result = await runModel(modelDir, imagePath);
  let incident = null;

  if (result.detected) {
    try {
      incident = await createIncidentFromDetection(modelDir, result, imageUrl, userId, zone, socketService);
    } catch (err) {
      console.error(`[mlBridge] Failed to create incident for ${modelDir}:`, err.message);
    }
  }

  return { model: modelDir, type: modelType, ...result, incident };
}

module.exports = { analyzeImage, analyzeImageSingleModel, runModel, getSeverity };
