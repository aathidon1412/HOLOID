const jwt = require("jsonwebtoken");

const ApiError = require("../utils/ApiError");

const revokedTokens = new Map();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret";
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "1d";
const ACTIVATION_SECRET =
	process.env.JWT_ACTIVATION_SECRET || "dev_activation_secret";
const ACTIVATION_EXPIRES_IN = process.env.JWT_ACTIVATION_EXPIRES_IN || "30m";

const cleanupRevokedTokens = () => {
	const now = Date.now();

	for (const [token, expiryMs] of revokedTokens.entries()) {
		if (expiryMs <= now) {
			revokedTokens.delete(token);
		}
	}
};

const generateAccessToken = (user) => {
	return jwt.sign(
		{
			sub: user._id.toString(),
			email: user.email,
			role: user.role,
			tokenType: "access",
		},
		ACCESS_SECRET,
		{ expiresIn: ACCESS_EXPIRES_IN }
	);
};

const generateActivationToken = (user) => {
	return jwt.sign(
		{
			sub: user._id.toString(),
			email: user.email,
			tokenType: "activation",
		},
		ACTIVATION_SECRET,
		{ expiresIn: ACTIVATION_EXPIRES_IN }
	);
};

const verifyAccessToken = (token) => {
	try {
		const payload = jwt.verify(token, ACCESS_SECRET);

		if (payload.tokenType !== "access") {
			throw new ApiError(401, "Invalid token type", "INVALID_TOKEN_TYPE");
		}

		return payload;
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		throw new ApiError(401, "Invalid or expired access token", "INVALID_TOKEN");
	}
};

const verifyActivationToken = (token) => {
	try {
		const payload = jwt.verify(token, ACTIVATION_SECRET);

		if (payload.tokenType !== "activation") {
			throw new ApiError(401, "Invalid activation token", "INVALID_TOKEN_TYPE");
		}

		return payload;
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		throw new ApiError(401, "Invalid or expired activation token", "INVALID_TOKEN");
	}
};

const extractBearerToken = (req) => {
	const authHeader = req.headers.authorization || "";

	if (!authHeader.startsWith("Bearer ")) {
		return null;
	}

	return authHeader.slice(7).trim();
};

const revokeToken = (token, exp) => {
	const fallbackExpiry = Date.now() + 60 * 60 * 1000;
	const expiryMs = exp ? exp * 1000 : fallbackExpiry;

	revokedTokens.set(token, expiryMs);
	cleanupRevokedTokens();
};

const isTokenRevoked = (token) => {
	cleanupRevokedTokens();
	return revokedTokens.has(token);
};

module.exports = {
	generateAccessToken,
	generateActivationToken,
	verifyAccessToken,
	verifyActivationToken,
	extractBearerToken,
	revokeToken,
	isTokenRevoked,
};
