const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");
const ROLES = require("../utils/roles");
const tokenService = require("../services/tokenService");
const { sendActivationEmail } = require("../services/emailService");

const HOSPITAL_APPROVABLE_ROLES = [
    ROLES.DOCTOR,
    ROLES.BED_MANAGER,
    ROLES.DATA_ENTRY,
    ROLES.AMBULANCE_DRIVER,
];

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const formatUser = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    hospital: user.hospital || null,
});

const getMyProfile = catchAsync(async (req, res) => {
    const user = await User.findById(req.user.id).select("_id name email role hospital");

    if (!user) {
        throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { user: formatUser(user) }, "Profile fetched successfully"));
});

const updateMyProfile = catchAsync(async (req, res) => {
    const { name, email } = req.body;

    if (name === undefined && email === undefined) {
        throw new ApiError(400, "At least one field (name or email) must be provided", "VALIDATION_ERROR");
    }

    const user = await User.findById(req.user.id).select("_id name email role hospital");
    if (!user) {
        throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    if (name !== undefined) {
        const trimmedName = String(name).trim();
        if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
            throw new ApiError(400, "Name must be between 2 and 80 characters", "VALIDATION_ERROR");
        }
        user.name = trimmedName;
    }

    if (email !== undefined) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            throw new ApiError(400, "Please provide a valid email address", "VALIDATION_ERROR");
        }

        const existingEmailUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id },
        }).select("_id");

        if (existingEmailUser) {
            throw new ApiError(409, "Email is already in use", "EMAIL_ALREADY_EXISTS");
        }

        user.email = normalizedEmail;
    }

    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, { user: formatUser(user) }, "Profile updated successfully"));
});

const changeMyPassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new ApiError(400, "Current password, new password, and confirm password are required", "VALIDATION_ERROR");
    }

    if (newPassword !== confirmPassword) {
        throw new ApiError(400, "New password and confirm password do not match", "VALIDATION_ERROR");
    }

    if (currentPassword === newPassword) {
        throw new ApiError(400, "New password must be different from current password", "VALIDATION_ERROR");
    }

    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
        throw new ApiError(
            400,
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
            "WEAK_PASSWORD"
        );
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
        throw new ApiError(401, "Current password is incorrect", "INVALID_CREDENTIALS");
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
});

const approveUser = catchAsync(async (req, res) => {
    const approver = req.user;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    if (user.isApproved) {
        return res
            .status(400)
            .json(new ApiResponse(400, null, "User is already approved."));
    }

    // GOV can approve HOSPITAL_ADMIN
    if (approver.role === ROLES.GOVERNMENT_OFFICIAL && user.role === ROLES.HOSPITAL_ADMIN) {
        // allowed
    } else if (approver.role === ROLES.HOSPITAL_ADMIN && HOSPITAL_APPROVABLE_ROLES.includes(user.role)) {
        // hospital admins may approve operational users for their own hospital
        if (!approver.hospital || !user.hospital || approver.hospital.toString() !== user.hospital.toString()) {
            throw new ApiError(403, "Cannot approve user from another hospital", "FORBIDDEN");
        }
    } else {
        throw new ApiError(403, "Insufficient permissions to approve this user", "FORBIDDEN");
    }

    user.isApproved = true;
    // `req.user` produced by authenticate contains `id` (string) and `hospital`.
    user.approvedBy = approver.id || approver._id || null;
    user.approvedAt = new Date();
    await user.save();

    // send activation email now that user is approved
    const activationToken = tokenService.generateActivationToken(user);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const activationLink = `${clientUrl}/activate?token=${activationToken}`;

    const emailResult = await sendActivationEmail({
        to: user.email,
        name: user.name,
        activationLink,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { activationEmailSent: !emailResult.skipped }, "User approved and activation email sent (if mailer available)."));
});

const listPendingUsers = catchAsync(async (req, res) => {
    const requester = req.user;

    let filter = { isApproved: false };

    if (requester.role === ROLES.GOVERNMENT_OFFICIAL) {
        // GOV sees pending hospital admins
        filter.role = ROLES.HOSPITAL_ADMIN;
    } else if (requester.role === ROLES.HOSPITAL_ADMIN) {
        // Hospital admin sees pending operational users for their hospital
        filter.role = { $in: HOSPITAL_APPROVABLE_ROLES };
        if (!requester.hospital) {
            return res.status(200).json(new ApiResponse(200, { users: [] }, "OK"));
        }
        filter.hospital = requester.hospital;
    } else {
        throw new ApiError(403, "Insufficient permissions to list pending users", "FORBIDDEN");
    }

    const users = await User.find(filter).select("_id name email role hospital createdAt").lean();
    return res.status(200).json(new ApiResponse(200, { users }, "OK"));
});

const listAllUsers = catchAsync(async (req, res) => {
    const requester = req.user;

    let filter = {};

    if (requester.role === ROLES.GOVERNMENT_OFFICIAL) {
        // GOV sees everyone, except other Government Officials
        filter = { role: { $ne: ROLES.GOVERNMENT_OFFICIAL } }; 
    } else if (requester.role === ROLES.HOSPITAL_ADMIN) {
        // Hospital admin sees only operational users attached to their hospital
        if (!requester.hospital) {
            return res.status(200).json(new ApiResponse(200, { users: [] }, "OK"));
        }
        filter.hospital = requester.hospital;
        filter.role = { $in: HOSPITAL_APPROVABLE_ROLES };
    } else {
        throw new ApiError(403, "Insufficient permissions to list all users", "FORBIDDEN");
    }

    const users = await User.find(filter)
        .populate("hospital", "name")
        .select("_id name email role isApproved isActive lastLoginAt createdAt")
        .lean();
        
        
    return res.status(200).json(new ApiResponse(200, { users }, "OK"));
});

const toggleUserStatus = catchAsync(async (req, res) => {
    const requester = req.user;
    const userId = req.params.id;
    const { isActive } = req.body;

    if (isActive === undefined) {
        throw new ApiError(400, "isActive status must be provided");
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (requester.role === ROLES.GOVERNMENT_OFFICIAL && user.role === ROLES.GOVERNMENT_OFFICIAL) {
         throw new ApiError(403, "Cannot modify other Government Officials");
    }

    if (requester.role === ROLES.HOSPITAL_ADMIN) {
        if (!requester.hospital || !user.hospital || requester.hospital.toString() !== user.hospital.toString()) {
            throw new ApiError(403, "Cannot modify users from another hospital");
        }
        if (!HOSPITAL_APPROVABLE_ROLES.includes(user.role)) {
             throw new ApiError(403, "Hospital admins can only modify operational users");
        }
    }

    user.isActive = isActive;
    await user.save();

    return res.status(200).json(new ApiResponse(200, { isActive: user.isActive }, `User ${isActive ? 'activated' : 'suspended'} successfully`));
});

module.exports = {
    getMyProfile,
    updateMyProfile,
    changeMyPassword,
    approveUser,
    listPendingUsers,
    listAllUsers,
    toggleUserStatus,
};
