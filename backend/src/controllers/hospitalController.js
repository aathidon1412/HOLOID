const Hospital = require("../models/Hospital");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");

const createHospital = catchAsync(async (req, res) => {
    // Debug logging to diagnose non-JSON responses seen by the frontend
    try {
        console.log('[createHospital] content-type:', req.headers['content-type']);
        console.log('[createHospital] body:', JSON.stringify(req.body));
    } catch (e) {
        console.log('[createHospital] body: <unserializable>');
    }

    const payload = req.body || {};
    // createdBy is the authenticated gov official
    payload.createdBy = req.user && req.user.id ? req.user.id : req.user?._id;

    // Basic server-side validation to return friendly JSON errors
    const missing = [];
    if (!payload.name) missing.push('name');
    if (!payload.location || !payload.location.addressLine1) missing.push('location.addressLine1');
    if (!payload.location || !payload.location.city) missing.push('location.city');
    if (!payload.location || !payload.location.state) missing.push('location.state');
    if (!payload.location || !payload.location.country) missing.push('location.country');
    if (!payload.contact || !payload.contact.phone) missing.push('contact.phone');
    if (!payload.contact || !payload.contact.email) missing.push('contact.email');
    if (!payload.capacity || payload.capacity.totalBeds == null) missing.push('capacity.totalBeds');
    if (!payload.capacity || payload.capacity.availableBeds == null) missing.push('capacity.availableBeds');

    if (missing.length) {
        throw new ApiError(400, 'Missing required fields: ' + missing.join(', '), 'VALIDATION_ERROR');
    }

    // Ensure availableBeds <= totalBeds
    if (Number(payload.capacity.availableBeds) > Number(payload.capacity.totalBeds)) {
        throw new ApiError(400, 'Available beds cannot exceed total beds', 'VALIDATION_ERROR');
    }

    // create hospital
    const hospital = await Hospital.create(payload);

    return res.status(201).json(new ApiResponse(201, { hospital }, 'Hospital created successfully.'));
});

const listHospitals = catchAsync(async (req, res) => {
    const hospitals = await Hospital.find({ active: true }).select("_id name").lean();
    return res.status(200).json(new ApiResponse(200, { hospitals }, "OK"));
});

const getHospital = catchAsync(async (req, res) => {
    const id = req.params.id;
    const hospital = await Hospital.findById(id).lean();
    if (!hospital) throw new ApiError(404, "Hospital not found", "NOT_FOUND");
    return res.status(200).json(new ApiResponse(200, { hospital }, "OK"));
});

const ROLES = require("../utils/roles");

const updateHospital = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    // Enforce role-based field restrictions
    if (user.role === ROLES.GOVERNMENT_OFFICIAL) {
        // prevent changing capacity fields by GOV
        delete updates.totalBeds;
        delete updates.availableBeds;
    }

    if (user.role === ROLES.HOSPITAL_ADMIN) {
        // hospital admin can only update their own hospital and only capacity fields
        if (user.hospital.toString() !== id) {
            throw new ApiError(403, 'You can only update your own hospital');
        }

        // Allow only capacity related updates for hospital admins
        const allowed = ['totalBeds', 'availableBeds', 'phone', 'email'];
        Object.keys(updates).forEach((key) => {
            if (!allowed.includes(key)) delete updates[key];
        });
    }

    // Validate capacity coherence if provided
    if (updates.totalBeds != null && updates.availableBeds != null) {
        if (Number(updates.availableBeds) > Number(updates.totalBeds)) {
            throw new ApiError(400, 'Available beds cannot exceed total beds');
        }
    }

    const hospital = await Hospital.findByIdAndUpdate(id, updates, { new: true });
    if (!hospital) throw new ApiError(404, 'Hospital not found');
    res.status(200).json(new ApiResponse(200, 'Hospital updated', hospital));
});


const deleteHospital = catchAsync(async (req, res) => {
    const id = req.params.id;
    const hospital = await Hospital.findById(id);
    if (!hospital) throw new ApiError(404, "Hospital not found", "NOT_FOUND");

    // Soft-delete by marking inactive
    hospital.active = false;
    await hospital.save();

    return res.status(200).json(new ApiResponse(200, null, "Hospital deactivated"));
});

module.exports = {
    createHospital,
    listHospitals,
    getHospital,
    updateHospital,
    deleteHospital,
};
