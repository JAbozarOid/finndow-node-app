import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;
const upload = multer({ dest: "uploads/" });

// Configure middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Set up storage for audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Routes
app.post("/api/generate-exercise", async (req, res) => {
  try {
    const { level, type } = req.body;

    // Use OpenAI to generate Finnish language exercises
    const prompt = `Generate a Finnish language ${type} exercise for ${level} level learners. 
                   Include the Finnish text, the correct pronunciation guide, and the English translation.
                   Format the response as JSON with fields: finnishText, pronunciationGuide, englishTranslation`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const exercise = JSON.parse(completion.choices[0].message.content);
    res.json({ data: exercise });
    console.log("Sending response:", JSON.stringify({ data: exercise }));
  } catch (error) {
    console.error("Error generating exercise:", error);
    res.status(500).json({ error: "Failed to generate exercise" });
  }
});

app.post(
  "/api/evaluate-pronunciation",
  upload.single("audio"),
  async (req, res) => {
    try {
      const audioFile = req.file;
      const { expectedText } = req.body;

      // Convert audio to format compatible with OpenAI
      const convertedFilePath = audioFile.path + ".mp3";
      await convertAudio(audioFile.path, convertedFilePath);

      // Send to OpenAI Whisper for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(convertedFilePath),
        model: "whisper-1",
        language: "fi",
      });

      // Use OpenAI to evaluate the pronunciation
      const evaluationPrompt = `
      Evaluate this Finnish pronunciation. 
      Expected text: "${expectedText}"
      Actual transcription: "${transcription.text}"
      
      Provide a detailed analysis of the pronunciation including:
      1. Accuracy score out of 100
      2. Specific phonemes or words that were mispronounced
      3. Suggestions for improvement
      
      Format the response as JSON with fields: score, feedback, mispronunciations, suggestions
    `;

      const evaluation = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: evaluationPrompt }],
        response_format: { type: "json_object" },
      });

      // Clean up temporary files
      fs.unlinkSync(audioFile.path);
      fs.unlinkSync(convertedFilePath);

      const result = JSON.parse(evaluation.choices[0].message.content);
      res.json(result);
    } catch (error) {
      console.error("Error evaluating pronunciation:", error);
      res.status(500).json({ error: "Failed to evaluate pronunciation" });
    }
  }
);

app.post("/api/text-to-speech", async (req, res) => {
  try {
    const { text } = req.body;

    // Use OpenAI's TTS model for Finnish
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (error) {
    console.error("Error generating speech:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

// Helper function to convert audio files
function convertAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("mp3")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

const models = await openai.models.list();
console.log(models);
console.log(
  "Available models:",
  models.data.map((model) => model.id)
);
console.log("OpenAI API Key:", process.env.OPENAI_API_KEY);

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log(`Base URL: ${BASE_URL}`);
});
