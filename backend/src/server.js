const dotenv = require("dotenv");
const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const initializeSocket = require("./socket");

dotenv.config();

const PORT = process.env.PORT || 5000;

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
