const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const createResourceRouter = require("./routes/resourceRoutes");

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    const server = http.createServer(app);

    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "*",
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        },
    });

    const tokenService = require("./services/tokenService");

    // Mount routes that need access to `io`
    app.use("/api/resources", createResourceRouter(io));

    // Socket handlers
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth && socket.handshake.auth.token;
            if (!token) return next(new Error("Authentication error: token missing"));

            const payload = tokenService.verifyAccessToken(token);
            socket.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
            };
            return next();
        } catch (err) {
            return next(new Error("Authentication error"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id} user=${socket.user && socket.user.id}`);

        socket.on("join-region", (region) => {
            if (typeof region !== "string" || !region.trim()) return;
            socket.join(region);
        });

        // Subscribe to hospital-specific room
        socket.on("subscribe-hospital", (hospitalId) => {
            if (!hospitalId || typeof hospitalId !== "string") return;
            socket.join(`hospital-${hospitalId}`);
        });

        socket.on("unsubscribe-hospital", (hospitalId) => {
            if (!hospitalId || typeof hospitalId !== "string") return;
            socket.leave(`hospital-${hospitalId}`);
        });
    });

    // 404 + error handler (moved here so dynamic routes mounted above are reachable)
    const ApiError = require("./utils/ApiError");
    const errorHandler = require("./middleware/errorHandler");

    app.use((req, res, next) => {
        next(new ApiError(404, `Route not found: ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
    });

    app.use(errorHandler);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error("Server failed to start:", error.message);
    process.exit(1);
});
