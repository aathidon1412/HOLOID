const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const tokenService = require("../services/tokenService");

const authenticate = async (req, res, next) => {
	try {
		const token = tokenService.extractBearerToken(req);

		if (!token) {
			throw new ApiError(401, "Authorization token missing", "MISSING_TOKEN");
		}

		if (tokenService.isTokenRevoked(token)) {
			throw new ApiError(401, "Token has been revoked", "REVOKED_TOKEN");
		}

		const payload = tokenService.verifyAccessToken(token);
		const user = await User.findById(payload.sub).select(
			"_id name email role isActive hospital"
		);

		if (!user) {
			throw new ApiError(401, "User not found", "USER_NOT_FOUND");
		}

		if (!user.isActive) {
			throw new ApiError(403, "User account is inactive", "INACTIVE_USER");
		}

		req.user = {
			id: user._id.toString(),
			name: user.name,
			email: user.email,
			role: user.role,
			hospital: user.hospital,
		};
		req.token = token;

		next();
	} catch (error) {
		next(error);
	}
};

module.exports = {
	authenticate,
};
