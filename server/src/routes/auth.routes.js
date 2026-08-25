import express from 'express';
import { sendForgotPasswordOtp, resetPassword } from '../controllers/auth.controller.js';
import { sendOtp, register, login, logout, getMe, completeFirstLogin, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/send-otp', sendOtp); // New route: Generates and emails the OTP
router.post('/register', register); // Will now verify the OTP during account creation
router.post('/login', login);
router.post('/forgot-password-otp', sendForgotPasswordOtp);
router.post('/reset-password', resetPassword);
router.post('/complete-first-login', completeFirstLogin);

// Protected routes (requires a valid session cookie)
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

export default router;