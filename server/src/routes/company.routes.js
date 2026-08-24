import express from 'express';
import { listCompanies, createCompany, updateCompanyStatus } from '../controllers/company.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', listCompanies);
router.post('/', createCompany);
router.put('/:code/status', updateCompanyStatus);

export default router;
