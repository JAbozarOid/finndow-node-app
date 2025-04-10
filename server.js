const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
