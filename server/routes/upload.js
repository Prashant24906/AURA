const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { analyzeAll, analyzeSingle } = require('../controllers/uploadController');

router.use(authMiddleware);

router.post('/analyze', upload.single('image'), analyzeAll);
router.post('/analyze/:modelType', upload.single('image'), analyzeSingle);

module.exports = router;
