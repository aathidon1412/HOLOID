const express = require("express");

const {
	createInventory,
	updateBedStatus,
	getResources,
} = require("../controllers/resourceController");

const createResourceRouter = (io) => {
	const router = express.Router();

	router.post("/", createInventory);
	router.put("/:hospitalId/beds", updateBedStatus(io));
	router.get("/", getResources);

	return router;
};

module.exports = createResourceRouter;
