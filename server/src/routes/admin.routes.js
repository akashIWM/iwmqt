import express from 'express';
import { getAllUsers, updateUserRole, updateUserStatus } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply the bouncer to ALL routes in this file
router.use(authenticate, authorize('SUPER_ADMIN'));

// The actual API endpoints
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);

export default router;