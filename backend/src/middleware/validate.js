const { validationResult } = require("express-validator");

const ApiError = require("../utils/ApiError");

const validate = (req, res, next) => {
	const errors = validationResult(req);

	if (errors.isEmpty()) {
		return next();
	}

	const details = errors.array().map((error) => ({
		field: error.path,
		location: error.location,
		message: error.msg,
		value: error.value,
	}));

	return next(
		new ApiError(400, "Validation failed", "VALIDATION_ERROR", details)
	);
};

module.exports = validate;
