import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

export const classroomsRouter = Router();

// GET /api/v1/classrooms - List all active classrooms
classroomsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      where: { isActive: true },
      orderBy: { roomCode: 'asc' },
    });
    res.json({ classrooms });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch classrooms' });
  }
});

// GET /api/v1/classrooms/:id
classroomsRouter.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: req.params.id },
    });
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }
    res.json({ classroom });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch classroom' });
  }
});

// POST /api/v1/classrooms (Admin Only)
classroomsRouter.post('/', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { roomCode, buildingName, floorNumber, latitude, longitude, allowedRadiusMeters, hardwareBeaconId } = req.body;

    if (!roomCode || !buildingName || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Room code, building, latitude, and longitude are required.' });
    }

    const classroom = await prisma.classroom.create({
      data: {
        roomCode: roomCode.trim().toUpperCase(),
        buildingName: buildingName.trim(),
        floorNumber: parseInt(floorNumber) || 1,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        allowedRadiusMeters: parseFloat(allowedRadiusMeters) || 25.0,
        hardwareBeaconId: hardwareBeaconId?.trim() || null,
      },
    });

    res.status(201).json({ classroom });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'A classroom with this room code already exists.' });
    }
    res.status(500).json({ message: 'Failed to create classroom' });
  }
});

// PUT /api/v1/classrooms/:id (Update coordinates / radius - Admin Only)
classroomsRouter.put('/:id', authenticate, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { roomCode, buildingName, floorNumber, latitude, longitude, allowedRadiusMeters, hardwareBeaconId, isActive } = req.body;

    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data: {
        ...(roomCode && { roomCode: roomCode.trim().toUpperCase() }),
        ...(buildingName && { buildingName: buildingName.trim() }),
        ...(floorNumber !== undefined && { floorNumber: parseInt(floorNumber) }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(allowedRadiusMeters !== undefined && { allowedRadiusMeters: parseFloat(allowedRadiusMeters) }),
        ...(hardwareBeaconId !== undefined && { hardwareBeaconId: hardwareBeaconId?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ classroom });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update classroom' });
  }
});
