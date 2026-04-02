const dotenv = require("dotenv");
const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const logisticsRoutes = require("./routes/logisticsRoutes");
const commandCenterRoutes = require("./routes/commandCenterRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const initializeSocket = require("./socket");

dotenv.config();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/logistics", logisticsRoutes);
app.use("/api/command-center", commandCenterRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
	res.status(200).json({ message: "HOLOID backend running" });
});

app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
	await connectDB();
	const server = http.createServer(app);
	initializeSocket(server);

	server.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);
	});
};

startServer().catch((error) => {
	console.error("Server failed to start:", error.message);
	process.exit(1);
});
