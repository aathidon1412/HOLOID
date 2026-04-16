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
    ROLES.AMBULANCE_DRIVER,
];

const ensureApprovalPermission = ({ approver, user }) => {
    // GOV can approve/reject HOSPITAL_ADMIN
    if (approver.role === ROLES.GOVERNMENT_OFFICIAL && user.role === ROLES.HOSPITAL_ADMIN) {
        return;
    }

    if (approver.role === ROLES.HOSPITAL_ADMIN && HOSPITAL_APPROVABLE_ROLES.includes(user.role)) {
        // hospital admins may approve/reject operational users for their own hospital
        if (!approver.hospital || !user.hospital || approver.hospital.toString() !== user.hospital.toString()) {
            throw new ApiError(403, "Cannot manage user from another hospital", "FORBIDDEN");
        }
        return;
    }

    throw new ApiError(403, "Insufficient permissions to manage this user", "FORBIDDEN");
};

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

    ensureApprovalPermission({ approver, user });

    user.isApproved = true;
    // `req.user` produced by authenticate contains `id` (string) and `hospital`.
    user.approvedBy = approver.id || approver._id || null;
    user.approvedAt = new Date();
    user.rejectedBy = null;
    user.rejectedAt = null;
    user.rejectionReason = "";
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

const rejectUser = catchAsync(async (req, res) => {
    const approver = req.user;
    const userId = req.params.id;
    const rejectionReason = String(req.body?.reason || "").trim();

    if (!rejectionReason) {
        throw new ApiError(400, "Rejection reason is required", "MISSING_REJECTION_REASON");
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

    if (user.isApproved) {
        throw new ApiError(409, "Approved users cannot be rejected", "INVALID_STATE");
    }

    if (user.rejectedAt) {
        throw new ApiError(400, "User is already rejected", "USER_ALREADY_REJECTED");
    }

    ensureApprovalPermission({ approver, user });

    user.isApproved = false;
    user.isActive = false;
    user.approvedBy = null;
    user.approvedAt = null;
    user.rejectedBy = approver.id || approver._id || null;
    user.rejectedAt = new Date();
    user.rejectionReason = rejectionReason;
    await user.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    rejectedAt: user.rejectedAt,
                    rejectionReason: user.rejectionReason,
                },
                "User rejected successfully"
            )
        );
});

const listPendingUsers = catchAsync(async (req, res) => {
    const requester = req.user;

    let filter = { isApproved: false, rejectedAt: null };

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
        .select("_id name email role isApproved isActive lastLoginAt createdAt rejectedAt rejectionReason")
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
    approveUser,
    rejectUser,
    listPendingUsers,
    listAllUsers,
    toggleUserStatus,
};
