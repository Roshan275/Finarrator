// routes/ragRoutes.js
const express = require("express");
const multer = require("multer");
const { postFile } = require("../controllers/ragcontroller");

const ragRouter = express.Router();
const upload = multer({ dest: "uploads/" });

ragRouter.use((req, res, next) => {
  console.log(`📥 [${req.method}] ${req.originalUrl}`);
  next();
});

ragRouter.post("/data", upload.single("file"), postFile);

module.exports = ragRouter;
