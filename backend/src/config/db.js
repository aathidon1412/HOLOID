const mongoose = require("mongoose");

const connectDB = async () => {
	const mongoUri = process.env.MONGO_URI;

	if (!mongoUri) {
		throw new Error("MONGO_URI is not defined in environment variables");
	}

	try {
		const conn = await mongoose.connect(mongoUri);
		console.log(`MongoDB Connected Successfully!!`);
	} catch (error) {
		console.error("MongoDB connection failed:", error.message);
		process.exit(1);
	}
};

module.exports = connectDB;
