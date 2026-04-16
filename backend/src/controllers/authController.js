const jwt = require("jsonwebtoken");

const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");
const tokenService = require("../services/tokenService");
const { sendActivationEmail } = require("../services/emailService");
const ROLES = require("../utils/roles");

const APPROVAL_REQUIRED_ROLES = [
	ROLES.HOSPITAL_ADMIN,
	ROLES.DOCTOR,
	ROLES.BED_MANAGER,
	ROLES.DATA_ENTRY,
	ROLES.AMBULANCE_DRIVER,
];

const HOSPITAL_SCOPED_ROLES = [
	ROLES.HOSPITAL_ADMIN,
	ROLES.DOCTOR,
	ROLES.BED_MANAGER,
	ROLES.DATA_ENTRY,
	ROLES.AMBULANCE_DRIVER,
];

const register = catchAsync(async (req, res) => {
	const { name, email, password, role, hospitalId } = req.body;
	const normalizedEmail = email.toLowerCase();

	const existingUser = await User.findOne({ email: normalizedEmail });
	if (existingUser) {
		throw new ApiError(409, "Email already registered", "EMAIL_EXISTS");
	}

	if (!Object.values(ROLES).includes(role)) {
		throw new ApiError(400, "Invalid role", "INVALID_ROLE");
	}

	if (HOSPITAL_SCOPED_ROLES.includes(role) && !hospitalId) {
		throw new ApiError(400, "hospitalId is required for this role", "MISSING_HOSPITAL");
	}

	// Users that require approval (do not get activation email immediately)
	const requiresApproval = APPROVAL_REQUIRED_ROLES.includes(role);

	const user = await User.create({
		name,
		email: normalizedEmail,
		password,
		role,
		hospital: hospitalId || null,
		isApproved: !requiresApproval,
	});

	// If the role requires approval, do not send activation email yet.
	if (requiresApproval) {
		return res.status(201).json(
			new ApiResponse(
				201,
				{
					user: {
						id: user._id,
						name: user.name,
						email: user.email,
						role: user.role,
						isActive: user.isActive,
						isApproved: user.isApproved,
					},
					pendingApproval: true,
					activationEmailSent: false,
				},
				"Registration created. Account is pending approval by the required authority."
			)
		);
	}

	// Roles that do not require approval get an activation email immediately.
	const activationToken = tokenService.generateActivationToken(user);
	const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
	const activationLink = `${clientUrl}/activate?token=${activationToken}`;

	const emailResult = await sendActivationEmail({
		to: user.email,
		name: user.name,
		activationLink,
	});

	return res.status(201).json(
		new ApiResponse(
			201,
			{
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					isActive: user.isActive,
				},
				activationEmailSent: !emailResult.skipped,
			},
			"Registration successful. Please activate your account via the email link."
		)
	);
});

const activateAccount = catchAsync(async (req, res) => {
	const token = req.query.token || req.body.token;
	if (!token) {
		throw new ApiError(400, "Activation token is required", "MISSING_TOKEN");
	}

	const payload = tokenService.verifyActivationToken(token);
	const user = await User.findById(payload.sub);

	if (!user) {
		throw new ApiError(404, "User not found", "USER_NOT_FOUND");
	}

	if (user.isActive) {
		return res
			.status(200)
			.json(new ApiResponse(200, null, "Account is already active."));
	}

	user.isActive = true;
	await user.save();

	return res
		.status(200)
		.json(new ApiResponse(200, null, "Account activated successfully."));
});

const login = catchAsync(async (req, res) => {
	const { email, password } = req.body;
	const normalizedEmail = email.toLowerCase();

	const user = await User.findOne({ email: normalizedEmail }).select("+password");
	if (!user) {
		throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
	}

	const passwordMatch = await user.comparePassword(password);
	if (!passwordMatch) {
		throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
	}

	if (!user.isActive) {
		if (user.isApproved === false) {
			throw new ApiError(403, "Account pending approval. Please wait for approval.", "ACCOUNT_PENDING_APPROVAL");
		}
		throw new ApiError(403, "Account not activated. Please use the activation link.", "ACCOUNT_INACTIVE");
	}

	user.lastLoginAt = new Date();
	await user.save();

	const accessToken = tokenService.generateAccessToken(user);

	return res.status(200).json(
		new ApiResponse(
			200,
			{
				accessToken,
				user: {
					id: user._id,
					name: user.name,
					email: user.email,
					role: user.role,
					hospital: user.hospital,
				},
			},
			"Login successful"
		)
	);
});

const logout = catchAsync(async (req, res) => {
	const token = req.token || tokenService.extractBearerToken(req);

	if (!token) {
		throw new ApiError(400, "Authorization token is required", "MISSING_TOKEN");
	}

	const decoded = jwt.decode(token);
	tokenService.revokeToken(token, decoded && decoded.exp ? decoded.exp : undefined);

	return res
		.status(200)
		.json(new ApiResponse(200, null, "Logout successful"));
});

const verifyAuthToken = catchAsync(async (req, res) => {
	return res
		.status(200)
		.json(new ApiResponse(200, { user: req.user }, "Token is valid"));
});

module.exports = {
	register,
	activateAccount,
	login,
	logout,
	verifyAuthToken,
};
