const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
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

app.use((req, res, next) => {
	next(new ApiError(404, `Route not found: ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
});

app.use(errorHandler);

module.exports = app;