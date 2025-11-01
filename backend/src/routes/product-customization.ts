import { Router, Request, Response } from 'express';
import { Client } from 'pg';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Direct PostgreSQL connection for each request
async function getDbConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://myerp:myerp_password@localhost:5432/myerp_db'
  });
  await client.connect();
  return client;
}

async function closeClient(client: Client | undefined) {
  if (client) {
    try {
      await client.end();
    } catch (error) {
      logger.debug('Client close error (ignored):', error);
    }
  }
}

/**
 * GET /api/products/:id/components
 * Get customizable components (materials + finishes) for a product
 * Returns the materials that make up the product for customization
 */
router.get('/:id/components', authenticateToken, async (req: Request, res: Response) => {
  let client;
  try {
    const { id } = req.params;
    client = await getDbConnection();

    // Get product materials with pricing info
    const result = await client.query(
      `SELECT
        pm.id,
        pm.part_name as component_name,
        pm.quantity,
        pm.unit_of_measure,
        pm.material_id,
        m.name as material_name,
        m.cost_per_unit as material_price,
        m.upcharge_percentage as material_upcharge,
        pm.finish_id,
        f.name as finish_name,
        f.extra_cost as finish_cost,
        f.upcharge_percentage as finish_upcharge,
        pm.extra_cost,
        pm.notes
       FROM product_materials pm
       LEFT JOIN materials m ON pm.material_id = m.id
       LEFT JOIN finishes f ON pm.finish_id = f.id
       WHERE pm.product_id = $1
       ORDER BY pm.part_name`,
      [id]
    );

    res.json({
      success: true,
      components: result.rows,
      product_id: id
    });

  } catch (error: any) {
    logger.error('Get product components error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

/**
 * POST /api/products/calculate-custom-price
 * Calculate price for a customized product
 * Uses hybrid pricing: base_price + Σ(material_upcharge%)
 */
router.post('/calculate-custom-price', authenticateToken, async (req: Request, res: Response) => {
  let client;
  try {
    const { product_id, base_price, custom_components } = req.body;

    if (!product_id || !base_price || !custom_components) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: product_id, base_price, custom_components'
      });
    }

    client = await getDbConnection();

    let totalUpcharge = 0;
    const componentDetails = [];

    // Calculate upcharge for each customized component
    for (const component of custom_components) {
      const { material_id, finish_id, component_name } = component;

      // Get material upcharge if material changed
      if (material_id) {
        const materialResult = await client.query(
          'SELECT name, upcharge_percentage FROM materials WHERE id = $1',
          [material_id]
        );

        if (materialResult.rows.length > 0) {
          const material = materialResult.rows[0];
          const upcharge = base_price * (material.upcharge_percentage / 100);
          totalUpcharge += upcharge;

          componentDetails.push({
            component_name,
            type: 'material',
            name: material.name,
            upcharge_percentage: material.upcharge_percentage,
            upcharge_amount: upcharge
          });
        }
      }

      // Get finish upcharge if finish changed
      if (finish_id) {
        const finishResult = await client.query(
          'SELECT name, upcharge_percentage FROM finishes WHERE id = $1',
          [finish_id]
        );

        if (finishResult.rows.length > 0) {
          const finish = finishResult.rows[0];
          const upcharge = base_price * (finish.upcharge_percentage / 100);
          totalUpcharge += upcharge;

          componentDetails.push({
            component_name,
            type: 'finish',
            name: finish.name,
            upcharge_percentage: finish.upcharge_percentage,
            upcharge_amount: upcharge
          });
        }
      }
    }

    const customPrice = base_price + totalUpcharge;

    res.json({
      success: true,
      pricing: {
        base_price,
        total_upcharge: totalUpcharge,
        custom_price: customPrice,
        component_details: componentDetails
      }
    });

  } catch (error: any) {
    logger.error('Calculate custom price error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await closeClient(client);
  }
});

export default router;
