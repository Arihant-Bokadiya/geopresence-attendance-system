import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';

export const hardwareRouter = Router();

/**
 * POST /api/v1/hardware/heartbeat
 * ESP32 Microcontroller anchors ping this endpoint to report status and active BLE beacon token
 */
hardwareRouter.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const { beaconId, firmwareVersion, rssi, secretKey } = req.body;

    if (!beaconId) {
      return res.status(400).json({ message: 'beaconId is required' });
    }

    const classroom = await prisma.classroom.findFirst({
      where: { hardwareBeaconId: beaconId }
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Unrecognized classroom hardware beacon.' });
    }

    res.json({
      status: 'ONLINE',
      classroomId: classroom.id,
      roomCode: classroom.roomCode,
      serverTime: new Date().toISOString(),
      beaconIntervalMs: 500
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Hardware heartbeat failed' });
  }
});
