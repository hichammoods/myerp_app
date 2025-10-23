import { Router } from 'express';
import { authenticate, salesOrAdmin } from '../middleware/auth.middleware';

const router = Router();

// All quotation routes require authentication
router.use(authenticate);

// Get all quotations (devis)
router.get('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement get quotations logic with filters
  res.json({
    message: 'Liste des devis - À implémenter',
    filters: {
      status: req.query.status, // brouillon, envoyé, accepté, rejeté, expiré
      client: req.query.client,
      vendeur: req.query.vendeur,
      dateDebut: req.query.dateDebut,
      dateFin: req.query.dateFin
    }
  });
});

// Get single quotation
router.get('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement get quotation by id
  res.json({
    message: 'Détails du devis - À implémenter',
    id: req.params.id
  });
});

// Create new quotation
router.post('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement create quotation logic
  res.json({
    message: 'Créer un nouveau devis - À implémenter',
    data: {
      client: req.body.client,
      articles: req.body.articles,
      dateExpiration: req.body.dateExpiration,
      dateLivraison: req.body.dateLivraison
    }
  });
});

// Update quotation
router.put('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement update quotation logic
  res.json({
    message: 'Mettre à jour le devis - À implémenter',
    id: req.params.id,
    data: req.body
  });
});

// Add line item to quotation
router.post('/:id/lines', salesOrAdmin, async (req, res) => {
  // TODO: Add product line to quotation
  res.json({
    message: 'Ajouter un article au devis - À implémenter',
    quotationId: req.params.id,
    product: req.body
  });
});

// Update line item
router.put('/:id/lines/:lineId', salesOrAdmin, async (req, res) => {
  // TODO: Update quotation line item
  res.json({
    message: 'Mettre à jour la ligne du devis - À implémenter',
    quotationId: req.params.id,
    lineId: req.params.lineId
  });
});

// Delete line item
router.delete('/:id/lines/:lineId', salesOrAdmin, async (req, res) => {
  // TODO: Delete quotation line item
  res.json({
    message: 'Supprimer la ligne du devis - À implémenter',
    quotationId: req.params.id,
    lineId: req.params.lineId
  });
});

// Add section to quotation (for grouping items)
router.post('/:id/sections', salesOrAdmin, async (req, res) => {
  // TODO: Add section to quotation
  res.json({
    message: 'Ajouter une section au devis - À implémenter',
    quotationId: req.params.id,
    sectionName: req.body.name
  });
});

// Send quotation by email
router.post('/:id/send', salesOrAdmin, async (req, res) => {
  // TODO: Send quotation to client
  res.json({
    message: 'Envoyer le devis par email - À implémenter',
    quotationId: req.params.id,
    to: req.body.email
  });
});

// Generate PDF
router.get('/:id/pdf', salesOrAdmin, async (req, res) => {
  // TODO: Generate quotation PDF
  res.json({
    message: 'Générer le PDF du devis - À implémenter',
    quotationId: req.params.id
  });
});

// Duplicate quotation
router.post('/:id/duplicate', salesOrAdmin, async (req, res) => {
  // TODO: Duplicate quotation
  res.json({
    message: 'Dupliquer le devis - À implémenter',
    originalId: req.params.id
  });
});

// Convert quotation to sales order
router.post('/:id/convert-to-order', salesOrAdmin, async (req, res) => {
  // TODO: Convert quotation to order
  res.json({
    message: 'Convertir le devis en commande - À implémenter',
    quotationId: req.params.id
  });
});

// Update quotation status
router.patch('/:id/status', salesOrAdmin, async (req, res) => {
  // TODO: Update quotation status
  res.json({
    message: 'Mettre à jour le statut du devis - À implémenter',
    quotationId: req.params.id,
    newStatus: req.body.status
  });
});

// Delete quotation (soft delete)
router.delete('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Delete quotation
  res.json({
    message: 'Supprimer le devis - À implémenter',
    id: req.params.id
  });
});

// Get quotation versions (history)
router.get('/:id/versions', salesOrAdmin, async (req, res) => {
  // TODO: Get quotation version history
  res.json({
    message: 'Historique des versions du devis - À implémenter',
    quotationId: req.params.id
  });
});

export { router as quotationRouter };