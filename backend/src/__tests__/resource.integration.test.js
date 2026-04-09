const express = require("express");
const request = require("supertest");

jest.mock("../config/db", () => jest.fn().mockResolvedValue(undefined));
jest.mock("../models/Resource", () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

const connectDB = require("../config/db");
const Resource = require("../models/Resource");
const createResourceRouter = require("../routes/resourceRoutes");

const HOSPITAL_ID = "507f1f77bcf86cd799439011";

const createTestApp = (io) => {
    const app = express();
    app.use(express.json());
    app.use("/api/resources", createResourceRouter(io));
    return app;
};

describe("Resource API integration tests", () => {
    let emitMock;
    let toMock;
    let io;
    let app;

    beforeAll(async () => {
        // Mocked DB connection: prevents tests from reaching a real MongoDB instance.
        await connectDB();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        emitMock = jest.fn();
        toMock = jest.fn(() => ({ emit: emitMock }));
        io = { to: toMock };

        app = createTestApp(io);
    });

    test("GET /api/resources returns 200 when listing resources by region", async () => {
        const mockResources = [
            {
                _id: "r1",
                hospital: HOSPITAL_ID,
                region: "north",
                wards: [
                    {
                        wardName: "Ward A",
                        beds: [{ type: "ICU", status: "Vacant", count: 3 }],
                    },
                ],
            },
        ];

        const populateMock = jest.fn().mockResolvedValue(mockResources);
        Resource.find.mockReturnValue({ populate: populateMock });

        const response = await request(app)
            .get("/api/resources")
            .query({ region: "north" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockResources);
        expect(Resource.find).toHaveBeenCalledWith({ region: "north" });
        expect(populateMock).toHaveBeenCalledWith("hospital");
    });

    test("POST /api/resources returns 201 when creating inventory", async () => {
        const payload = {
            hospital: HOSPITAL_ID,
            region: "north",
            wards: [
                {
                    wardName: "Ward A",
                    beds: [{ type: "ICU", status: "Vacant", count: 5 }],
                },
            ],
        };

        Resource.findOne.mockResolvedValue(null);
        Resource.create.mockResolvedValue({ _id: "inv-1", ...payload });

        const response = await request(app).post("/api/resources").send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ _id: "inv-1", region: "north" });
        expect(Resource.findOne).toHaveBeenCalledWith({ hospital: HOSPITAL_ID });
        expect(Resource.create).toHaveBeenCalledWith(payload);
    });

    test("PUT /api/resources/:hospitalId/beds returns 400 for invalid bedType", async () => {
        const response = await request(app)
            .put(`/api/resources/${HOSPITAL_ID}/beds`)
            .send({ bedType: "InvalidType", status: "Occupied" });

        expect(response.status).toBe(400);
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.length).toBeGreaterThan(0);
        expect(
            response.body.errors.some(
                (err) =>
                    err.path === "bedType" &&
                    String(err.msg).includes("bedType must be one of")
            )
        ).toBe(true);
    });

    test("PUT /api/resources/:hospitalId/beds emits Socket.io events on successful update", async () => {
        const resourceDocument = {
            hospital: HOSPITAL_ID,
            region: "south",
            wards: [
                {
                    wardName: "Ward A",
                    beds: [{ type: "ICU", status: "Vacant", count: 2 }],
                },
            ],
            save: jest.fn(),
        };

        const updatedResource = {
            hospital: HOSPITAL_ID,
            region: "south",
            wards: [
                {
                    wardName: "Ward A",
                    beds: [{ type: "ICU", status: "Occupied", count: 2 }],
                },
            ],
            updatedAt: new Date("2026-04-08T00:00:00.000Z"),
        };

        resourceDocument.save.mockResolvedValue(updatedResource);
        Resource.findOne.mockResolvedValue(resourceDocument);

        const response = await request(app)
            .put(`/api/resources/${HOSPITAL_ID}/beds`)
            .send({ wardName: "Ward A", bedType: "ICU", status: "Occupied" });

        expect(response.status).toBe(200);
        expect(Resource.findOne).toHaveBeenCalledWith({ hospital: HOSPITAL_ID });
        expect(resourceDocument.save).toHaveBeenCalledTimes(1);

        expect(io.to).toHaveBeenCalledWith("south");
        expect(emitMock).toHaveBeenCalledWith(
            "bed-update",
            expect.objectContaining({ region: "south", wards: updatedResource.wards })
        );
        expect(emitMock).toHaveBeenCalledWith(
            "bed-status-changed",
            expect.objectContaining({
                region: "south",
                wardName: "Ward A",
                bedType: "ICU",
                status: "Occupied",
                message: "Ward A ICU bed became Occupied",
            })
        );
    });
});
