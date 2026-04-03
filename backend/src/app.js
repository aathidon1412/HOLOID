const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const logisticsRoutes = require("./routes/logisticsRoutes");
const commandCenterRoutes = require("./routes/commandCenterRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const ApiError = require("./utils/ApiError");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(
	cors({
		origin: process.env.CLIENT_URL || "*",
		credentials: true,
	})
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
	res.status(200).json({
		success: true,
		message: "HOLOID backend running",
	});
});

app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/hospitals", hospitalRoutes);
app.use("/api/v1/logistics", logisticsRoutes);
app.use("/api/v1/command-center", commandCenterRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Backward-compatible aliases
app.use("/api/logistics", logisticsRoutes);
app.use("/api/command-center", commandCenterRoutes);
app.use("/api/notifications", notificationRoutes);

module.exports = app;