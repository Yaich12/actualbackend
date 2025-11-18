require('dotenv').config();
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const filePath = req.file.path;

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'gpt-4o-transcribe',
      response_format: 'text',
    });

    const text =
      typeof transcription === 'string'
        ? transcription
        : transcription?.text || '';

    res.json({ text });
  } catch (error) {
    console.error('Transcription error:', error);
    const status = error?.status || error?.response?.status || 500;
    const message =
      error?.message ||
      error?.response?.data?.error ||
      error?.response?.data ||
      'Transcription failed';
    res.status(status).json({ error: message });
  } finally {
    fs.promises
      .unlink(filePath)
      .catch((err) => console.error('Error deleting temp file:', err));
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
