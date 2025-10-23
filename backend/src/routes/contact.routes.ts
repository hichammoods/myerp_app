import { Router } from 'express';
import { authenticate, salesOrAdmin } from '../middleware/auth.middleware';

const router = Router();

// All contact routes require authentication
router.use(authenticate);

// Get all contacts (with pagination, search, filters)
router.get('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement get contacts logic
  res.json({
    message: 'Liste des contacts - À implémenter',
    filters: req.query
  });
});

// Get single contact
router.get('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement get contact by id logic
  res.json({
    message: 'Détails du contact - À implémenter',
    id: req.params.id
  });
});

// Create new contact
router.post('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement create contact logic
  res.json({
    message: 'Créer un contact - À implémenter',
    data: req.body
  });
});

// Update contact
router.put('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement update contact logic
  res.json({
    message: 'Mettre à jour le contact - À implémenter',
    id: req.params.id,
    data: req.body
  });
});

// Delete contact (soft delete)
router.delete('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement delete contact logic
  res.json({
    message: 'Supprimer le contact - À implémenter',
    id: req.params.id
  });
});

// Import contacts from CSV/Excel
router.post('/import', salesOrAdmin, async (req, res) => {
  // TODO: Implement import contacts logic
  res.json({
    message: 'Importer des contacts - À implémenter'
  });
});

// Export contacts to CSV/Excel
router.get('/export', salesOrAdmin, async (req, res) => {
  // TODO: Implement export contacts logic
  res.json({
    message: 'Exporter les contacts - À implémenter'
  });
});

export { router as contactRouter };