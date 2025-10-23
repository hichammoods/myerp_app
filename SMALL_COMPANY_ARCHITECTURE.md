# MyERP - Practical Architecture for Small Company

## Philosophy
**Build what you need, when you need it.** No over-engineering.

## Core Architecture (What You Actually Need)

```
┌────────────────────────────────────────────┐
│          Your Sales Team (5-20 users)      │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │   Web Browser    │
        └─────────┬────────┘
                  │
                  ▼ Port 80/443
        ┌─────────────────┐
        │  React Frontend  │  ← Built-in Charts & Dashboards
        │   (Single Page)  │    (Chart.js, no Grafana needed)
        └─────────┬────────┘
                  │
                  ▼ Port 4000
        ┌─────────────────┐
        │   Node.js API    │  ← Your Business Logic
        │   (Express.js)   │    All-in-one backend
        └─────────┬────────┘
                  │
        ┌─────────┼─────────┬──────────────┐
        ▼         ▼         ▼              ▼
  ┌──────────┐ ┌──────┐ ┌───────┐  ┌─────────────┐
  │PostgreSQL│ │Redis │ │ MinIO │  │Email Service│
  │(Database)│ │(Cache)│ │(Files)│  │  (SMTP)     │
  └──────────┘ └──────┘ └───────┘  └─────────────┘
```

## What We're Building

### ✅ Essential Services (You Need These)
1. **PostgreSQL** - Your main database
2. **Redis** - Session management & caching
3. **MinIO** - PDF storage for quotations
4. **Node.js Backend** - Your API
5. **React Frontend** - Your user interface

### ❌ What We're NOT Building (You Don't Need)
- ~~Prometheus~~ → Use in-app metrics
- ~~Grafana~~ → Build custom dashboards with Chart.js
- ~~Kubernetes~~ → Use simple Docker Compose
- ~~Microservices~~ → Monolithic is fine for small companies
- ~~Multiple databases~~ → One PostgreSQL is enough
- ~~Complex monitoring~~ → Simple health checks are sufficient
- ~~Load balancers~~ → Not needed for <50 users

## In-App Dashboard (Instead of Grafana)

### Sales Dashboard Page
```javascript
// frontend/src/pages/Dashboard.jsx
import { LineChart, BarChart, PieChart } from 'recharts';
// or use Chart.js - it's lighter

const Dashboard = () => {
  // Real-time data from your API
  const { salesData, quotationData, inventoryData } = useDashboardData();

  return (
    <div className="dashboard">
      {/* Key Metrics Cards */}
      <div className="metrics-row">
        <MetricCard
          title="Today's Sales"
          value="$12,450"
          change="+15%"
          icon="💰"
        />
        <MetricCard
          title="Open Quotations"
          value="23"
          change="+3"
          icon="📄"
        />
        <MetricCard
          title="Low Stock Items"
          value="5"
          change="-2"
          icon="⚠️"
        />
        <MetricCard
          title="New Customers"
          value="8"
          change="+2"
          icon="👥"
        />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Sales Trend - Line Chart */}
        <div className="chart-card">
          <h3>Sales Trend (Last 30 Days)</h3>
          <LineChart data={salesData} />
        </div>

        {/* Top Products - Bar Chart */}
        <div className="chart-card">
          <h3>Top 5 Products</h3>
          <BarChart data={topProducts} />
        </div>

        {/* Sales by Rep - Pie Chart */}
        <div className="chart-card">
          <h3>Sales by Representative</h3>
          <PieChart data={salesByRep} />
        </div>

        {/* Recent Activity - Table */}
        <div className="activity-card">
          <h3>Recent Activity</h3>
          <ActivityFeed activities={recentActivities} />
        </div>
      </div>
    </div>
  );
};
```

### API Endpoints for Dashboard
```javascript
// backend/src/controllers/dashboard.controller.js

// Single endpoint for dashboard data
async getDashboardSummary(req, res) {
  const { startDate, endDate } = req.query;

  // Simple SQL queries - no complex monitoring needed
  const metrics = await db.query(`
    SELECT
      -- Today's sales
      (SELECT COALESCE(SUM(total_amount), 0)
       FROM sales_orders
       WHERE DATE(created_at) = CURRENT_DATE) as today_sales,

      -- Open quotations
      (SELECT COUNT(*)
       FROM quotations
       WHERE status IN ('draft', 'sent')) as open_quotations,

      -- Low stock items
      (SELECT COUNT(*)
       FROM products
       WHERE quantity <= min_stock_level) as low_stock_items,

      -- New customers this month
      (SELECT COUNT(*)
       FROM contacts
       WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)) as new_customers,

      -- Conversion rate
      (SELECT
        CASE
          WHEN COUNT(q.id) > 0
          THEN ROUND(COUNT(DISTINCT so.id)::DECIMAL / COUNT(DISTINCT q.id) * 100, 2)
          ELSE 0
        END
       FROM quotations q
       LEFT JOIN sales_orders so ON so.quotation_id = q.id
       WHERE q.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as conversion_rate
  `);

  // Sales trend for chart
  const salesTrend = await db.query(`
    SELECT
      DATE(created_at) as date,
      SUM(total_amount) as amount,
      COUNT(*) as orders
    FROM sales_orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  // Top products
  const topProducts = await db.query(`
    SELECT
      p.name,
      SUM(ol.quantity) as units_sold,
      SUM(ol.line_total) as revenue
    FROM order_lines ol
    JOIN products p ON p.id = ol.product_id
    JOIN sales_orders so ON so.id = ol.order_id
    WHERE so.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT 5
  `);

  res.json({
    metrics: metrics.rows[0],
    charts: {
      salesTrend: salesTrend.rows,
      topProducts: topProducts.rows
    }
  });
}
```

## Practical Features for Small Company

### 1. Simple Daily Email Report
Instead of complex monitoring, send a daily summary:

```javascript
// backend/src/jobs/dailyReport.js
const schedule = require('node-cron');

// Run every day at 8 AM
schedule('0 8 * * *', async () => {
  const report = await generateDailyReport();

  await sendEmail({
    to: 'manager@company.com',
    subject: `Daily Sales Report - ${new Date().toLocaleDateString()}`,
    html: `
      <h2>Daily Sales Summary</h2>
      <ul>
        <li>Total Sales: $${report.totalSales}</li>
        <li>New Orders: ${report.newOrders}</li>
        <li>Quotations Sent: ${report.quotationsSent}</li>
        <li>Low Stock Items: ${report.lowStockItems}</li>
      </ul>
    `
  });
});
```

### 2. Simple Backup Strategy
```bash
#!/bin/bash
# backup.sh - Run daily via cron
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups"

# Backup database
docker exec myerp_postgres pg_dump -U myerp myerp_db > $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_*.sql" -mtime +30 -delete

# Optionally sync to Google Drive or Dropbox
# rclone copy $BACKUP_DIR gdrive:myerp-backups/
```

### 3. Health Check Endpoint
```javascript
// backend/src/routes/health.js
router.get('/health', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    minio: false,
    diskSpace: false
  };

  // Check database
  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch (e) {}

  // Check Redis
  try {
    await redis.ping();
    checks.redis = true;
  } catch (e) {}

  // Check MinIO
  try {
    await minio.listBuckets();
    checks.minio = true;
  } catch (e) {}

  // Check disk space
  const disk = await checkDiskSpace('/');
  checks.diskSpace = disk.free > 1000000000; // 1GB free

  const allHealthy = Object.values(checks).every(v => v);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date()
  });
});
```

## Deployment for Small Company

### Option 1: Single VPS (Recommended)
```bash
# Simple VPS from DigitalOcean/Linode ($20-40/month)
# 4GB RAM, 2 CPUs, 80GB SSD

# 1. Clone your repo
git clone your-repo.git
cd myerp_app

# 2. Set production environment
cp .env.example .env.production
# Edit with real passwords

# 3. Start everything
docker-compose -f docker-compose.simple.yml up -d

# 4. Set up daily backup cron
crontab -e
# Add: 0 2 * * * /home/myerp/backup.sh

# That's it! Access at http://your-server-ip
```

### Option 2: Managed Hosting
- Use platforms like Render, Railway, or Heroku
- They handle backups, SSL, and scaling
- Costs ~$50-100/month for small apps

## Database Design for Small Company

### Simplified Schema
Focus on core tables only:

```sql
-- Just 7 main tables instead of 16+
CREATE TABLE users (...)        -- Your team
CREATE TABLE contacts (...)      -- Your customers
CREATE TABLE products (...)      -- Your inventory
CREATE TABLE quotations (...)    -- Your quotes
CREATE TABLE quotation_lines (...)  -- Quote details
CREATE TABLE sales_orders (...)  -- Your orders
CREATE TABLE order_lines (...)   -- Order details

-- That's it! Add more tables only when needed
```

## Security (Practical Level)

### Essential Security Only
1. **Passwords**: Use bcrypt
2. **Authentication**: JWT tokens
3. **HTTPS**: Use Let's Encrypt (free SSL)
4. **Backups**: Daily automated
5. **Updates**: Monthly security patches

### Simple Security Checklist
```javascript
// backend/src/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet()); // Basic security headers

// Rate limiting - prevent abuse
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests
}));

// Input validation
app.use(express.json({ limit: '10mb' }));

// SQL injection prevention - use parameterized queries
// ✅ Good
db.query('SELECT * FROM users WHERE id = $1', [userId]);
// ❌ Bad
db.query(`SELECT * FROM users WHERE id = ${userId}`);
```

## Cost Breakdown for Small Company

### Monthly Costs
- **Hosting**: $20-40 (DigitalOcean/Linode VPS)
- **Domain**: $1 ($12/year)
- **Email**: $0 (use your existing email)
- **SSL**: $0 (Let's Encrypt)
- **Backups**: $5 (optional cloud storage)
- **Total**: ~$30-50/month

### Compare to Alternatives
- Odoo: $25-75/user/month = $125-375 for 5 users
- Salesforce: $25-300/user/month = $125-1500 for 5 users
- **Your MyERP**: $30-50 total for unlimited users 💰

## Development Timeline (Realistic)

### Week 1-2: Core Setup
- Set up database
- Build authentication
- Create basic UI structure

### Week 3-4: Contacts & Products
- Contact management
- Product inventory
- Basic CRUD operations

### Week 5-6: Quotations
- Quotation builder
- PDF generation
- Email sending

### Week 7-8: Orders & Dashboard
- Order management
- In-app dashboard
- Basic reports

### Week 9-10: Testing & Deployment
- Fix bugs
- Deploy to server
- Train users

**Total: 10 weeks to production** ✅

## Maintenance Plan

### Daily (Automated)
- Backup database
- Check disk space

### Weekly (5 minutes)
- Check error logs
- Review dashboard metrics

### Monthly (1 hour)
- Apply security updates
- Clean old logs
- Review performance

### Yearly
- Review and archive old data
- Plan new features based on feedback

## Summary

For a small company, you need:
1. **Simple architecture** - One backend, one frontend, one database
2. **In-app dashboards** - Chart.js instead of Grafana
3. **Basic monitoring** - Health checks and daily email reports
4. **Simple deployment** - Single VPS with Docker Compose
5. **Practical security** - Essential measures only
6. **Low cost** - $30-50/month total

**No over-engineering, just practical solutions that work!**