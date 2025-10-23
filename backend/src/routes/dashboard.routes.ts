import { Router } from 'express';
import { authenticate, salesOrAdmin } from '../middleware/auth.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Get dashboard summary (tableau de bord)
router.get('/summary', salesOrAdmin, async (req, res) => {
  // TODO: Implement dashboard summary logic
  res.json({
    message: 'Résumé du tableau de bord - À implémenter',
    metrics: {
      ventesAujourdhui: '€12,450',
      devisOuverts: 23,
      commandesEnCours: 15,
      articlesStockFaible: 5,
      nouveauxClients: 8,
      tauxConversion: '32%'
    },
    period: req.query.period || '30_jours'
  });
});

// Get sales metrics (métriques de vente)
router.get('/sales', salesOrAdmin, async (req, res) => {
  // TODO: Get sales metrics
  res.json({
    message: 'Métriques de vente - À implémenter',
    data: {
      chiffreAffaires: {
        jour: '€3,450',
        semaine: '€24,320',
        mois: '€87,650',
        annee: '€945,230'
      },
      nombreCommandes: {
        jour: 3,
        semaine: 18,
        mois: 67,
        annee: 782
      },
      panierMoyen: '€1,150'
    }
  });
});

// Get revenue chart data (graphique du chiffre d'affaires)
router.get('/revenue-chart', salesOrAdmin, async (req, res) => {
  // TODO: Get revenue data for charts
  res.json({
    message: 'Données pour graphique CA - À implémenter',
    period: req.query.period || '30_jours',
    data: [
      { date: '2024-01-01', montant: 2450 },
      { date: '2024-01-02', montant: 3200 },
      // ... more data points
    ]
  });
});

// Get top selling products (meubles les plus vendus)
router.get('/top-products', salesOrAdmin, async (req, res) => {
  // TODO: Get top selling furniture items
  res.json({
    message: 'Meubles les plus vendus - À implémenter',
    period: req.query.period || '30_jours',
    products: [
      {
        nom: 'Canapé 3 places Confort',
        quantiteVendue: 15,
        chiffreAffaires: '€22,500',
        categorie: 'Salon'
      },
      {
        nom: 'Table à manger extensible',
        quantiteVendue: 12,
        chiffreAffaires: '€18,000',
        categorie: 'Salle à manger'
      }
    ]
  });
});

// Get sales by category (ventes par catégorie)
router.get('/sales-by-category', salesOrAdmin, async (req, res) => {
  // TODO: Get sales breakdown by furniture category
  res.json({
    message: 'Ventes par catégorie - À implémenter',
    data: [
      { categorie: 'Salon', montant: 45000, pourcentage: 35 },
      { categorie: 'Chambre', montant: 32000, pourcentage: 25 },
      { categorie: 'Salle à manger', montant: 28000, pourcentage: 22 },
      { categorie: 'Bureau', montant: 23000, pourcentage: 18 }
    ]
  });
});

// Get sales by representative (ventes par commercial)
router.get('/sales-by-rep', salesOrAdmin, async (req, res) => {
  // TODO: Get sales performance by sales rep
  res.json({
    message: 'Performance par commercial - À implémenter',
    period: req.query.period || '30_jours',
    data: [
      {
        nom: 'Marie Dupont',
        nombreDevis: 45,
        nombreCommandes: 15,
        tauxConversion: '33%',
        chiffreAffaires: '€45,230'
      },
      {
        nom: 'Pierre Martin',
        nombreDevis: 38,
        nombreCommandes: 11,
        tauxConversion: '29%',
        chiffreAffaires: '€38,450'
      }
    ]
  });
});

// Get customer metrics (métriques clients)
router.get('/customers', salesOrAdmin, async (req, res) => {
  // TODO: Get customer metrics
  res.json({
    message: 'Métriques clients - À implémenter',
    data: {
      totalClients: 458,
      nouveauxClients: {
        semaine: 12,
        mois: 45
      },
      clientsActifs: 234,
      valeurMoyenneClient: '€2,340',
      topClients: [
        {
          nom: 'Hôtel Luxury Paris',
          chiffreAffaires: '€125,000',
          nombreCommandes: 8
        },
        {
          nom: 'Restaurant Le Gourmet',
          chiffreAffaires: '€87,500',
          nombreCommandes: 5
        }
      ]
    }
  });
});

// Get inventory status (état des stocks)
router.get('/inventory-status', salesOrAdmin, async (req, res) => {
  // TODO: Get inventory status for furniture
  res.json({
    message: 'État des stocks - À implémenter',
    data: {
      totalArticles: 234,
      valeurStock: '€458,230',
      articlesFaibleStock: [
        {
          nom: 'Chaise design scandinave',
          stock: 2,
          seuilMinimum: 5
        },
        {
          nom: 'Table basse en chêne',
          stock: 1,
          seuilMinimum: 3
        }
      ],
      articlesRuptureStock: 3
    }
  });
});

// Get quotation conversion metrics (métriques de conversion des devis)
router.get('/quotation-conversion', salesOrAdmin, async (req, res) => {
  // TODO: Get quotation to order conversion metrics
  res.json({
    message: 'Conversion des devis - À implémenter',
    period: req.query.period || '30_jours',
    data: {
      totalDevis: 145,
      devisAcceptes: 48,
      devisRejetes: 23,
      devisEnAttente: 74,
      tauxConversionGlobal: '33%',
      delaiMoyenAcceptation: '3.5 jours'
    }
  });
});

// Get production status (statut de production - for custom orders)
router.get('/production-status', salesOrAdmin, async (req, res) => {
  // TODO: Get production status for custom furniture orders
  res.json({
    message: 'Statut de production - À implémenter',
    data: {
      commandesEnProduction: 8,
      commandesTerminees: 3,
      commandesEnAttente: 12,
      delaiMoyenProduction: '14 jours',
      planning: [
        {
          commande: 'CMD-2024-001',
          client: 'M. Dubois',
          article: 'Canapé sur mesure',
          progression: 75,
          livraison: '2024-02-15'
        }
      ]
    }
  });
});

// Get daily report (rapport journalier)
router.get('/daily-report', salesOrAdmin, async (req, res) => {
  // TODO: Get daily summary report
  res.json({
    message: 'Rapport journalier - À implémenter',
    date: req.query.date || new Date().toISOString().split('T')[0],
    data: {
      ventesJour: '€3,450',
      nouveauxDevis: 5,
      commandesConfirmees: 2,
      livraisonsEffectuees: 3,
      activites: [
        'Nouveau devis #DV-2024-089 créé pour M. Lambert',
        'Commande #CMD-2024-045 confirmée',
        'Livraison #LIV-2024-032 effectuée'
      ]
    }
  });
});

export { router as dashboardRouter };