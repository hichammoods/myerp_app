import { Router } from 'express';
import { authenticate, salesOrAdmin } from '../middleware/auth.middleware';

const router = Router();

// Public routes (no auth required for catalog viewing)
router.get('/catalog', async (req, res) => {
  // TODO: Implement public catalog viewing
  res.json({
    message: 'Catalogue produits public - À implémenter',
    filters: {
      category: req.query.category,
      type: req.query.type,
      collection: req.query.collection,
      customizable: req.query.customizable
    }
  });
});

// All other product routes require authentication
router.use(authenticate);

// Get all products (for internal use)
router.get('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement get products logic
  res.json({
    message: 'Liste des produits (meubles) - À implémenter',
    filters: req.query
  });
});

// Get single product with all details
router.get('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement get product by id logic
  res.json({
    message: 'Détails du produit - À implémenter',
    id: req.params.id
  });
});

// Get product customization options
router.get('/:id/customizations', salesOrAdmin, async (req, res) => {
  // TODO: Get available customizations for a product
  res.json({
    message: 'Options de personnalisation - À implémenter',
    productId: req.params.id,
    options: ['matériau', 'finition', 'dimensions', 'tissu']
  });
});

// Create new product (furniture item)
router.post('/', salesOrAdmin, async (req, res) => {
  // TODO: Implement create product logic
  res.json({
    message: 'Créer un nouveau meuble - À implémenter',
    data: req.body
  });
});

// Update product
router.put('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement update product logic
  res.json({
    message: 'Mettre à jour le produit - À implémenter',
    id: req.params.id,
    data: req.body
  });
});

// Update stock quantity
router.patch('/:id/stock', salesOrAdmin, async (req, res) => {
  // TODO: Implement stock update logic
  res.json({
    message: 'Mettre à jour le stock - À implémenter',
    id: req.params.id,
    quantity: req.body.quantity
  });
});

// Delete product (soft delete)
router.delete('/:id', salesOrAdmin, async (req, res) => {
  // TODO: Implement delete product logic
  res.json({
    message: 'Supprimer le produit - À implémenter',
    id: req.params.id
  });
});

// Get materials
router.get('/materials/list', salesOrAdmin, async (req, res) => {
  // TODO: Get all available materials
  res.json({
    message: 'Liste des matériaux - À implémenter',
    types: ['bois', 'tissu', 'cuir', 'métal', 'mousse']
  });
});

// Get finishes
router.get('/finishes/list', salesOrAdmin, async (req, res) => {
  // TODO: Get all available finishes
  res.json({
    message: 'Liste des finitions - À implémenter',
    types: ['finition_bois', 'couleur', 'finition_metal']
  });
});

// Get categories
router.get('/categories/list', async (req, res) => {
  // TODO: Get all categories
  res.json({
    message: 'Catégories de meubles - À implémenter',
    categories: ['Salon', 'Chambre', 'Salle à manger', 'Bureau']
  });
});

// Check product availability
router.get('/:id/availability', salesOrAdmin, async (req, res) => {
  // TODO: Check product availability and production time
  res.json({
    message: 'Vérifier la disponibilité - À implémenter',
    productId: req.params.id,
    status: 'sur_commande',
    productionTime: '14 jours'
  });
});

export { router as productRouter };