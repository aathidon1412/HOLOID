const errorHandler = (err, req, res, next) => {
	let statusCode = err.statusCode || 500;
	let code = err.code || "INTERNAL_SERVER_ERROR";
	let message = err.message || "Something went wrong";
	let details = err.details;

	// Mongo duplicate key (e.g., unique email) -> 409
	// Typical shape: { code: 11000, keyPattern: { email: 1 }, keyValue: { email: "x" } }
	if (err && (err.code === 11000 || err.code === 11001)) {
		statusCode = 409;
		code = "EMAIL_EXISTS";
		message = "Email already registered";
		details = err.keyValue || err.keyPattern || details;
	}

	// Mongoose validation errors -> 400
	if (err && err.name === "ValidationError") {
		statusCode = 400;
		code = "VALIDATION_ERROR";
		message = "Validation failed";
		details = err.errors || details;
	}

	const response = {
		success: false,
		error: {
			code,
			message,
		},
	};

	if (details) {
		response.error.details = details;
	}

	if (process.env.NODE_ENV !== "production" && statusCode >= 500) {
		response.error.stack = err.stack;
	}

	res.status(statusCode).json(response);
};

module.exports = errorHandler;
