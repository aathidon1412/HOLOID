const ApiError = require("../utils/ApiError");

const authorizeRoles = (...allowedRoles) => {
	return (req, res, next) => {
		if (!req.user) {
			return next(new ApiError(401, "Authentication required", "UNAUTHENTICATED"));
		}

		if (!allowedRoles.includes(req.user.role)) {
			return next(
				new ApiError(
					403,
					"Insufficient permissions for this resource",
					"FORBIDDEN"
				)
			);
		}

		return next();
	};
};

module.exports = {
	authorizeRoles,
};
