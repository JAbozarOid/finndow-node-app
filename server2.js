// Node.js prototype backend for Finnish Speaking App using OpenAI APIs

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import swaggerUi from 'swagger-ui-express';
// import swaggerDocument from './swagger.json' assert { type: 'json' };

// Use this:
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const swaggerDocument = require('./swagger.json');

require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Step 1: Generate Speaking Practice
app.post('/generate-practice', async (req, res) => {
  const { level, topic } = req.body;
  const prompt = `Create a short ${level}-level Finnish dialogue about ${topic}. Max 4 exchanges.`;

  try {
    const response = await axios.post(`${OPENAI_BASE_URL}/chat/completions`, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Finnish language teacher creating speaking exercises.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });

    const practiceText = response.data.choices[0].message.content;
    res.json({ practiceText });
  } catch (err) {
    console.error("Error generating-exercise :", err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Convert Practice Text to Audio
app.post('/text-to-speech', async (req, res) => {
  const { text } = req.body;

  try {
    const response = await axios.post(`${OPENAI_BASE_URL}/audio/speech`, {
      model: 'tts-1',
      input: text,
      voice: 'shimmer'
    }, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    fs.writeFileSync('output.mp3', response.data);
    res.download('output.mp3');
  } catch (err) {
    console.error("Error generating-exercise :", err);
    res.status(500).json({ error: err.message });
  }
});

// Step 3 + 4: Upload User Audio & Transcribe
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  const file = req.file;

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));
    formData.append('model', 'whisper-1');
    formData.append('language', 'fi');

    const response = await axios.post(`${OPENAI_BASE_URL}/audio/transcriptions`, formData, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      }
    });

    fs.unlinkSync(file.path);
    res.json({ transcript: response.data.text });
  } catch (err) {
    fs.unlinkSync(file.path);
    res.status(500).json({ error: err.message });
  }
});

// Step 5: Evaluate the User's Speech
app.post('/evaluate', async (req, res) => {
  const { expectedText, userTranscript } = req.body;
  const prompt = `Expected: "${expectedText}"\nStudent said: "${userTranscript}"\nPlease give detailed feedback on pronunciation, grammar, and intonation.`;

  try {
    const response = await axios.post(`${OPENAI_BASE_URL}/chat/completions`, {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a Finnish language tutor giving feedback on speaking exercises.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });

    res.json({ feedback: response.data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
