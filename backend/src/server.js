const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const createResourceRouter = require("../routes/resourceRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/resources", createResourceRouter(io));

app.get("/", (req, res) => {
	res.status(200).json({ message: "HOLOID backend running" });
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
	server.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);
	});
};

startServer();
