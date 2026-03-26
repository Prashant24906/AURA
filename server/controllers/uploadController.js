const path = require('path');
const { analyzeImage, analyzeImageSingleModel } = require('../services/mlBridge');
const socketService = require('../services/socketService');

// POST /api/upload/analyze
const analyzeAll = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'NoFile', message: 'No image file uploaded' });
    }
    const imagePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;
    const zone = req.body.zone || 'Unknown zone';
    const imageId = req.file.filename;

    const { results, incidents } = await analyzeImage(
      imagePath,
      imageUrl,
      req.user._id,
      zone,
      socketService,
      (progress) => {
        socketService.emitModelProcessing(imageId, progress);
      }
    );

    res.json({
      success: true,
      data: { results, incidents, imageUrl, imageId },
      message: `Analysis complete — ${incidents.length} incident(s) created`,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/upload/analyze/:modelType
const analyzeSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'NoFile', message: 'No image file uploaded' });
    }
    const { modelType } = req.params;
    const imagePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;
    const zone = req.body.zone || 'Unknown zone';

    const result = await analyzeImageSingleModel(imagePath, imageUrl, modelType, req.user._id, zone, socketService);

    res.json({
      success: true,
      data: { result, imageUrl },
      message: result.detected ? `Detection: ${result.label}` : 'No detection',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { analyzeAll, analyzeSingle };
