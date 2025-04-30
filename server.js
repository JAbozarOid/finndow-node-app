import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import multer from "multer";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";
import https from "https";
import fetch from "node-fetch";
import FormData from "form-data";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;
const upload = multer({ dest: "uploads/" });

// *** means that your Node.js app is trying to use ffmpeg via the fluent-ffmpeg library, but ffmpeg should be installed and available in the system PATH.
ffmpeg.setFfmpegPath("C:/ffmpeg/bin/ffmpeg.exe"); // 🔁 Update this with your actual path

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

//*** transcribe */
//const form = new FormData();
//form.append("file", fs.createReadStream("uploads/audio.mp3"));
//form.append("model", "whisper-1");
//form.append("language", "fi");

//const trans = await fetch("https://api.openai.com/v1/audio/transcriptions", {
//method: "POST",
//headers: {
//Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//},
//body: form,
//});

//const result = await trans.json();
//console.log(result);

//*** test open api connection */
//https
//.get("https://api.openai.com", (res) => {
//console.log("✅ OpenAI API is reachable:", res.statusCode);
//})
//.on("error", (err) => {
//console.error("❌ OpenAI API is not reachable:", err.message);
//});
//console.log(
//"OpenAI API Key:",
//process.env.OPENAI_API_KEY ? "Loaded" : "Missing"
//);

// Routes
//**** region generate-exercise */
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
    res.json({ 
      data: {
        ...exercise,
        level,
        type
      } 
    });
    // ✅ Log the generated exercise
    console.log("Success generate-exercise:", JSON.stringify({ ...exercise, level, type }));
  } catch (error) {
    console.error("Error generating-exercise :", error);
    res.status(500).json({ error: "Failed to generate exercise" });
  }
});
//*** region generate-exercise */

//*** region evaluate-pronunciation */
app.post(
  "/api/evaluate-pronunciation",
  upload.single("audio"),
  async (req, res) => {
    try {
      //const audioFile = req.file;
      const { expectedText } = req.body;

      // ✅ Validate file first
      /*
      if (!audioFile || !fs.existsSync(audioFile.path)) {
        console.error("Invalid or missing audio file.");
        return res
          .status(400)
          .json({ error: "Invalid or missing audio file." });
      }*/

      //const convertedFilePath = audioFile.path + ".mp3";
      //await convertAudio(audioFile.path, convertedFilePath);

      /*
      console.log("Uploaded File Info:", {
        originalname: audioFile.originalname,
        mimetype: audioFile.mimetype,
        path: audioFile.path,
        size: audioFile.size,
      }); 
      */

      // === Transcription logic is commented out due to quota issue ===
      /*
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(convertedFilePath),
        model: "whisper-1",
        language: "fi",
      });
      */

      // 🧪 Mock transcription
      const transcription = {
        text: req.body.transcription || "Tämä on esimerkkilause.",
      };

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
        response_format: { type: "json_object" }, // ✅ FIXED
      });

      //fs.unlinkSync(audioFile.path);
      //fs.unlinkSync(convertedFilePath);

      const result = JSON.parse(evaluation.choices[0].message.content);
      res.json({ data: result });
      console.log("Success evaluate-pronunciation :", JSON.stringify(result));
    } catch (error) {
      if (error.code === "ECONNRESET") {
        console.error("Network error: Connection reset by peer.");
        return res
          .status(500)
          .json({ error: "Network error. Please try again later." });
      }
      console.error("Error evaluating pronunciation:", error.message);
      res.status(500).json({ error: "Failed to evaluate pronunciation." });
    }
  }
);

//*** region evaluate-pronunciation */

//** region text to speech */
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
