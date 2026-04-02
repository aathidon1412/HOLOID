const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const logisticsRoutes = require("./routes/logisticsRoutes");
const commandCenterRoutes = require("./routes/commandCenterRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const initializeSocket = require("./socket");
const createResourceRouter = require("../routes/resourceRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/resources", createResourceRouter(io));

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
io.on("connection", (socket) => {
	console.log(`Client connected: ${socket.id}`);

	socket.on("join-region", (region) => {
		if (typeof region !== "string" || !region.trim()) {
			return;
		}

		socket.join(region);
	});
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
