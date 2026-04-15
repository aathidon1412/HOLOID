const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");
const ROLES = require("../utils/roles");
const tokenService = require("../services/tokenService");
const { sendActivationEmail } = require("../services/emailService");

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
    } else if (approver.role === ROLES.HOSPITAL_ADMIN && user.role === ROLES.DOCTOR) {
        // hospital admins may approve doctors for their own hospital
        if (!approver.hospital || !user.hospital || approver.hospital.toString() !== user.hospital.toString()) {
            throw new ApiError(403, "Cannot approve doctor from another hospital", "FORBIDDEN");
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
        // Hospital admin sees pending doctors for their hospital
        filter.role = ROLES.DOCTOR;
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

module.exports = {
    approveUser,
    listPendingUsers,
};
