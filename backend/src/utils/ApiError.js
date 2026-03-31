class ApiError extends Error {
	constructor(statusCode, message, code = "APP_ERROR", details = null) {
		super(message);
		this.name = "ApiError";
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;

		Error.captureStackTrace(this, this.constructor);
	}
}

module.exports = ApiError;
