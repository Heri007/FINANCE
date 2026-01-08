Voici un README complet et professionnel pour votre application FINANCE :

***

# 💰 FINANCE - Gestionnaire Financier Full-Stack

Application complète de gestion financière et de projets, développée pour suivre les transactions, gérer les comptes, planifier des projets et analyser la rentabilité en temps réel.






***

## 📋 Table des Matières

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Structure du Projet](#structure-du-projet)
- [API Documentation](#api-documentation)
- [Base de Données](#base-de-données)
- [Sécurité](#sécurité)
- [Déploiement](#déploiement)
- [Contribution](#contribution)
- [Licence](#licence)

***

## 🎯 Aperçu

**FINANCE** est une solution complète de gestion financière permettant de :
- Gérer plusieurs comptes financiers (cash, banque, mobile money)
- Suivre les transactions avec catégorisation intelligente
- Planifier et suivre des projets (CAPEX, revenus, ROI)
- Gérer les créances (Avoirs/Receivables)
- Distribuer les bénéfices entre partenaires (système Natiora)
- Générer des rapports financiers détaillés
- Gérer les ressources humaines et les tâches opérationnelles

***

## ✨ Fonctionnalités

### 💳 Gestion des Comptes
- Multi-comptes avec balances en temps réel
- Import automatique depuis CSV (avec dédoublonnage)
- Historique complet des transactions
- Gestion des transferts inter-comptes

### 📊 Gestion des Transactions
- Catégorisation (revenus/dépenses)
- Import massif CSV avec validation
- Liaison intelligente aux projets
- Filtrage et recherche avancés
- Remarques et notes

### 🚀 Gestion de Projets
Support de 4 types de projets :
- **CARRIERE** : Projets d'extraction/carrière
- **EXPORT** : Projets d'exportation commerciale
- **LIVESTOCK** : Élevage (Natiora) avec distribution des revenus
- **PRODUCTFLIP** : Achat-revente de produits

**Fonctionnalités projets :**
- Planification financière (dépenses/revenus projetés vs réels)
- Calcul automatique du ROI et break-even
- Allocation budgétaire par compte
- Suivi de progression en temps réel
- Liaison transactions ↔ lignes de projet

### 💰 Distribution des Bénéfices (Natiora)
- Configuration des parts partenaires (ex: 70/30)
- Suivi des revenus par occurrence
- Calcul automatique des dividendes
- Historique des distributions
- Graphiques de rentabilité

### 📈 Créances (Avoirs/Receivables)
- Gestion des avoirs clients
- Statut (ouvert/fermé)
- Tracking des montants dus
- Liaison aux comptes source/destination

### 👥 Ressources Humaines
- Base de données employés
- Upload de photos
- Gestion des compétences (skills)
- Projets assignés
- Contacts d'urgence

### 📑 Dashboard Opérateur
- Vue d'ensemble KPIs
- SOPs (Standard Operating Procedures)
- Gestion des tâches
- Objectifs stratégiques

### 📊 Analytics & Rapports
- Graphiques Recharts interactifs
- Comparaisons période à période
- Exports CSV/PDF
- Visualisations personnalisées

***

## 🏗️ Architecture

```
FINANCE/
├── money-tracker-backend/     # API REST Node.js/Express
│   ├── config/               # Configuration (Redis, DB)
│   ├── controllers/          # Logique métier
│   ├── routes/              # Endpoints API
│   ├── middleware/          # Auth, validation, sécurité
│   ├── services/            # Services métier
│   └── schema.sql           # Structure PostgreSQL
│
└── money-tracker-vite/       # Frontend React/Vite
    ├── src/
    │   ├── components/      # Composants React
    │   ├── contexts/        # State management
    │   ├── services/        # API clients
    │   ├── hooks/          # Custom hooks
    │   └── domain/         # Logique métier
    └── public/             # Assets statiques
```

***

## 🛠️ Technologies

### Backend
| Technologie | Version | Usage |
|------------|---------|-------|
| Node.js | 18+ | Runtime JavaScript |
| Express | 4.18.2 | Framework web |
| PostgreSQL | 14.19 | Base de données |
| Redis | 5.10.0 | Cache & rate limiting |
| JWT | 9.0.2 | Authentication |
| Joi | 18.0.2 | Validation |
| Winston | 3.18.3 | Logging |
| Multer | 2.0.2 | Upload fichiers |
| Helmet | 8.1.0 | Sécurité headers |

### Frontend
| Technologie | Version | Usage |
|------------|---------|-------|
| React | 19.2.0 | UI Framework |
| Vite | 7.2.2 | Build tool |
| Tailwind CSS | 3.4.18 | Styling |
| Recharts | 3.6.0 | Graphiques |
| Axios | 1.13.2 | HTTP client |
| date-fns | 4.1.0 | Manipulation dates |
| lucide-react | 0.553.0 | Icons |
| react-hot-toast | 2.6.0 | Notifications |

***

## 📦 Installation

### Prérequis
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 5.0
- npm ou yarn

### 1. Cloner le Repository

```bash
git clone https://github.com/Heri007/FINANCE.git
cd FINANCE
git checkout from-tag-2
```

### 2. Installation Backend

```bash
cd money-tracker-backend
npm install
```

### 3. Installation Frontend

```bash
cd ../money-tracker-vite
npm install
```

***

## ⚙️ Configuration

### Backend Configuration

Créer un fichier `.env` dans `money-tracker-backend/` :

```env
# Server
PORT=5000
NODE_ENV=development

# Database PostgreSQL
DB_USER=votre_user
DB_HOST=localhost
DB_DATABASE=finance_db
DB_PASSWORD=votre_password
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=votre_secret_jwt_super_securise
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Upload
MAX_FILE_SIZE=10485760
```

### Frontend Configuration

Créer un fichier `.env` dans `money-tracker-vite/` :

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=FINANCE
```

### Base de Données

1. Créer la base de données PostgreSQL :

```bash
createdb finance_db
```

2. Importer le schéma :

```bash
psql -U votre_user -d finance_db -f money-tracker-backend/schema.sql
```

### Redis

Démarrer Redis :

```bash
redis-server
```

***

## 🚀 Utilisation

### Démarrage en Développement

**Terminal 1 - Backend :**
```bash
cd money-tracker-backend
npm run dev
# Serveur démarré sur http://localhost:5000
```

**Terminal 2 - Frontend :**
```bash
cd money-tracker-vite
npm run dev
# App accessible sur http://localhost:5173
```

### Build pour Production

**Backend :**
```bash
cd money-tracker-backend
npm start
```

**Frontend :**
```bash
cd money-tracker-vite
npm run build
npm run preview
```

***

## 📁 Structure du Projet

### Backend (money-tracker-backend)

```
money-tracker-backend/
├── config/
│   ├── redis.js              # Configuration Redis
│   └── vaccum.js             # Maintenance DB
├── controllers/
│   ├── accountController.js
│   ├── authController.js
│   ├── profitDistributionController.js
│   ├── projectController.js
│   ├── transactionController.js
│   └── ...
├── middleware/
│   ├── authMiddleware.js
│   ├── rateLimitMiddleware.js
│   └── validationMiddleware.js
├── routes/
│   ├── accounts.js
│   ├── auth.js
│   ├── projects.js
│   ├── transactions.js
│   ├── profitDistributions.js
│   └── ...
├── services/
│   ├── accountService.js
│   ├── projectService.js
│   └── ...
├── uploads/employees/        # Fichiers uploadés
├── csv/                      # Imports CSV
├── reports/                  # Génération rapports
├── scripts/                  # Scripts maintenance
├── schema.sql               # Structure DB
├── server.js                # Point d'entrée
└── package.json
```

### Frontend (money-tracker-vite)

```
money-tracker-vite/
├── public/                   # Assets statiques
├── src/
│   ├── assets/              # Images, fonts
│   ├── components/
│   │   ├── accounts/
│   │   │   └── AccountList.jsx
│   │   ├── charts/
│   │   │   └── RevenueChart.jsx
│   │   ├── common/
│   │   │   ├── Button.jsx
│   │   │   └── Modal.jsx
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── projects/
│   │   │   ├── ProjectPlannerHub.jsx
│   │   │   └── modals/
│   │   │       ├── CarriereModal.jsx
│   │   │       ├── ExportModal.jsx
│   │   │       ├── LivestockModal.jsx
│   │   │       └── ProductFlipModal.jsx
│   │   ├── transactions/
│   │   │   ├── TransactionList.jsx
│   │   │   └── TransactionForm.jsx
│   │   └── operator/
│   │       └── OperatorDashboard.jsx
│   ├── contexts/
│   │   ├── AuthContext.jsx
│   │   └── FinanceContext.jsx
│   ├── services/
│   │   ├── api.js           # Axios config
│   │   ├── accountService.js
│   │   ├── projectService.js
│   │   └── transactionService.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useFinance.js
│   ├── domain/finance/      # Logique métier
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .eslintrc.json
├── tailwind.config.js
├── vite.config.js
└── package.json
```

***

## 🌐 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Endpoints Principaux

#### Authentication
```http
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/verify
```

#### Accounts
```http
GET    /api/accounts          # Liste tous les comptes
POST   /api/accounts          # Créer un compte
GET    /api/accounts/:id      # Détails d'un compte
PUT    /api/accounts/:id      # Modifier un compte
DELETE /api/accounts/:id      # Supprimer un compte
POST   /api/accounts/import   # Import CSV
```

#### Transactions
```http
GET    /api/transactions                  # Liste des transactions
POST   /api/transactions                  # Créer une transaction
GET    /api/transactions/:id              # Détails transaction
PUT    /api/transactions/:id              # Modifier transaction
DELETE /api/transactions/:id              # Supprimer transaction
POST   /api/transactions/import           # Import CSV massif
POST   /api/transactions/:id/link         # Lier à projet
DELETE /api/transactions/:id/unlink       # Délier de projet
```

#### Projects
```http
GET    /api/projects              # Liste projets
POST   /api/projects              # Créer projet
GET    /api/projects/:id          # Détails projet
PUT    /api/projects/:id          # Modifier projet
DELETE /api/projects/:id          # Supprimer projet
POST   /api/projects/:id/activate # Activer projet
GET    /api/projects/:id/progress # Progress tracking
```

#### Profit Distributions (Natiora)
```http
GET    /api/profitDistributions/:projectId        # Distributions d'un projet
POST   /api/profitDistributions                   # Créer distribution
PUT    /api/profitDistributions/:id               # Modifier distribution
DELETE /api/profitDistributions/:id               # Supprimer distribution
GET    /api/profitDistributions/:projectId/summary # Résumé financier
```

#### Receivables (Avoirs)
```http
GET    /api/receivables          # Liste des avoirs
POST   /api/receivables          # Créer avoir
PUT    /api/receivables/:id      # Modifier avoir
DELETE /api/receivables/:id      # Supprimer avoir
POST   /api/receivables/:id/close # Fermer avoir
```

### Exemple de Requête

```javascript
// Créer une transaction
const response = await fetch('http://localhost:5000/api/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    account_id: 1,
    type: 'expense',
    amount: 50000,
    category: 'Nourriture',
    description: 'Courses du mois',
    transaction_date: '2026-01-08',
    project_id: null
  })
});

const data = await response.json();
```

***

### 🗄️ Base de Données

### Schéma PostgreSQL

#### Tables Principales

**1. accounts** - Comptes Financiers
```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    balance NUMERIC(15,2) DEFAULT 0,
    type VARCHAR(50) NOT NULL,
    user_id INTEGER DEFAULT 1,
    last_import_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**2. transactions** - Transactions
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(15,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    project_line_id TEXT,
    linked_at TIMESTAMP,
    linked_by VARCHAR(100),
    remarks TEXT,
    is_planned BOOLEAN DEFAULT false,
    is_posted BOOLEAN DEFAULT true,
    user_id INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_transaction UNIQUE (account_id, transaction_date, amount, type, description)
);
```

**3. projects** - Projets
```sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'ponctuel',
    status VARCHAR(50) DEFAULT 'draft',
    frequency VARCHAR(50),
    occurrences_count INTEGER DEFAULT 1,
    unit_volume NUMERIC(10,2),
    unit_label VARCHAR(20),
    price_per_unit NUMERIC(15,2),
    cost_per_unit NUMERIC(15,2),
    start_date DATE,
    end_date DATE,
    total_cost NUMERIC(15,2) DEFAULT 0,
    total_revenues NUMERIC(15,2) DEFAULT 0,
    net_profit NUMERIC(15,2) DEFAULT 0,
    roi NUMERIC(10,2) DEFAULT 0,
    profit_per_occurrence NUMERIC(15,2),
    margin_percent NUMERIC(10,2),
    break_even_units INTEGER,
    feasible BOOLEAN DEFAULT true,
    remaining_budget NUMERIC(15,2),
    total_available NUMERIC(15,2),
    expenses JSONB DEFAULT '[]',
    revenues JSONB DEFAULT '[]',
    allocation JSONB DEFAULT '{}',
    revenue_allocation JSONB DEFAULT '{}',
    accounts_snapshot JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    activated_at TIMESTAMP,
    activated_transactions INTEGER DEFAULT 0,
    user_id INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**4. project_expense_lines** - Lignes de Dépenses Projet
```sql
CREATE TABLE project_expense_lines (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    category VARCHAR(150),
    projected_amount NUMERIC(15,2) DEFAULT 0,
    actual_amount NUMERIC(15,2) DEFAULT 0,
    transaction_date DATE,
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_synced_at TIMESTAMP
);
```

**5. project_revenue_lines** - Lignes de Revenus Projet
```sql
CREATE TABLE project_revenue_lines (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    description TEXT,
    category VARCHAR(150),
    projected_amount NUMERIC(15,2) DEFAULT 0,
    actual_amount NUMERIC(15,2) DEFAULT 0,
    transaction_date DATE,
    is_received BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_synced_at TIMESTAMP
);
```

**6. receivables** - Créances/Avoirs
```sql
CREATE TABLE receivables (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    person TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(14,2) NOT NULL,
    status TEXT DEFAULT 'open' NOT NULL,
    source_account_id INTEGER REFERENCES accounts(id),
    target_account_id INTEGER REFERENCES accounts(id),
    user_id INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**7. employees** - Employés
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    photo TEXT,
    position VARCHAR(150) NOT NULL,
    department VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    facebook TEXT,
    linkedin TEXT,
    location VARCHAR(100),
    salary NUMERIC(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    contract_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    skills JSONB,
    projects JSONB,
    emergency_contact JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Fonctions PostgreSQL

**1. Liaison Transaction → Ligne de Projet**
```sql
CREATE FUNCTION link_transaction_to_line(
    p_transaction_id INTEGER,
    p_line_id INTEGER,
    p_user VARCHAR DEFAULT 'system'
) RETURNS TABLE(status TEXT, message TEXT, transaction_id INTEGER, line_id INTEGER, amount NUMERIC)
```

**2. Délier Transaction**
```sql
CREATE FUNCTION unlink_transaction(
    p_transaction_id INTEGER,
    p_user VARCHAR DEFAULT 'system'
) RETURNS TABLE(status TEXT, message TEXT)
```

### Vues

**v_project_progress** - Vue agrégée du progrès des projets
```sql
CREATE VIEW v_project_progress AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.total_cost,
    p.total_revenues,
    p.net_profit,
    COUNT(pel.*) AS total_expense_lines,
    COUNT(CASE WHEN pel.is_paid THEN 1 END) AS paid_expense_lines,
    COALESCE(SUM(pel.projected_amount), 0) AS total_projected_expenses,
    COALESCE(SUM(CASE WHEN pel.is_paid THEN pel.actual_amount END), 0) AS total_paid_expenses,
    -- ... (calculs similaires pour revenus)
FROM projects p
LEFT JOIN project_expense_lines pel ON pel.project_id = p.id
LEFT JOIN project_revenue_lines prl ON prl.project_id = p.id
GROUP BY p.id;
```

### Indexes Optimisés

```sql
-- Transactions
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_project_id ON transactions(project_id);
CREATE INDEX idx_transactions_project_line_id ON transactions(project_line_id);
CREATE INDEX idx_transactions_type ON transactions(type);

-- Projects
CREATE INDEX idx_proj_exp_project_id ON project_expense_lines(project_id);
CREATE INDEX idx_proj_rev_project_id ON project_revenue_lines(project_id);
CREATE INDEX idx_projects_metadata ON projects USING gin(metadata);

-- Employees
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_status ON employees(status);
```

***

## 🔒 Sécurité

### Authentification & Autorisation

**JWT (JSON Web Tokens)**
- Tokens sécurisés avec expiration (7 jours par défaut)
- Refresh token automatique
- Sessions stockées en base avec expiration

```javascript
// Middleware d'authentification
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};
```

### Protection CSRF

```javascript
// Backend - CSRF Protection
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);
```

### Rate Limiting (Redis)

```javascript
// Backend - Rate Limiting
const { RateLimiterRedis } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'finance_rl',
  points: 100,           // 100 requêtes
  duration: 15 * 60,     // par 15 minutes
  blockDuration: 15 * 60 // blocage 15 min
});
```

### Validation des Entrées

**Backend - Joi Validation**
```javascript
const transactionSchema = Joi.object({
  account_id: Joi.number().required(),
  type: Joi.string().valid('income', 'expense', 'transfer').required(),
  amount: Joi.number().positive().required(),
  category: Joi.string().max(100).required(),
  description: Joi.string().allow(''),
  transaction_date: Joi.date().required(),
  project_id: Joi.number().allow(null)
});
```

### Headers de Sécurité (Helmet)

```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

### Hash de Mots de Passe

```javascript
const bcrypt = require('bcryptjs');

// Hashage
const hashedPassword = await bcrypt.hash(password, 12);

// Vérification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### CORS Configuration

```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

***

## 🚀 Déploiement

### Option 1 : Déploiement Manuel (VPS)

#### 1. Préparer le Serveur

```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Installer Redis
sudo apt-get install redis-server

# Installer PM2 (Process Manager)
sudo npm install -g pm2
```

#### 2. Cloner et Configurer

```bash
# Cloner le repo
git clone https://github.com/Heri007/FINANCE.git
cd FINANCE
git checkout from-tag-2

# Backend
cd money-tracker-backend
npm install --production
cp .env.example .env
# Éditer .env avec vos valeurs de production

# Frontend
cd ../money-tracker-vite
npm install
npm run build
```

#### 3. Configuration PostgreSQL

```bash
# Créer utilisateur et base
sudo -u postgres psql
CREATE USER finance_user WITH PASSWORD 'votre_password_securise';
CREATE DATABASE finance_db OWNER finance_user;
\q

# Importer schéma
psql -U finance_user -d finance_db -f money-tracker-backend/schema.sql
```

#### 4. Démarrer avec PM2

```bash
cd money-tracker-backend

# Créer fichier ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'finance-api',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
EOF

# Lancer
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 5. Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/finance

server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend (fichiers statiques)
    location / {
        root /var/www/finance/money-tracker-vite/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. SSL avec Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

### Option 2 : Docker (Recommandé)

#### Créer Dockerfile Backend

```dockerfile
# money-tracker-backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

#### Créer Dockerfile Frontend

```dockerfile
# money-tracker-vite/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: finance_db
      POSTGRES_USER: finance_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./money-tracker-backend/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

 ```yaml
  backend:
    build: ./money-tracker-backend
    environment:
      DB_HOST: postgres
      DB_USER: finance_user
      DB_PASSWORD: ${DB_PASSWORD}
      DB_DATABASE: finance_db
      REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./money-tracker-backend/uploads:/app/uploads

  frontend:
    build: ./money-tracker-vite
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

#### Démarrer avec Docker

```bash
# Créer fichier .env à la racine
cat > .env << EOF
DB_PASSWORD=votre_password_securise
JWT_SECRET=votre_secret_jwt_super_long_et_securise
EOF

# Lancer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

### Option 3 : Heroku

```bash
# Installer Heroku CLI
npm install -g heroku

# Login
heroku login

# Créer apps
heroku create finance-api
heroku create finance-web

# Ajouter PostgreSQL & Redis
heroku addons:create heroku-postgresql:hobby-dev -a finance-api
heroku addons:create heroku-redis:hobby-dev -a finance-api

# Configurer variables d'environnement
heroku config:set JWT_SECRET=votre_secret -a finance-api
heroku config:set NODE_ENV=production -a finance-api

# Déployer backend
cd money-tracker-backend
git init
heroku git:remote -a finance-api
git add .
git commit -m "Deploy backend"
git push heroku main

# Déployer frontend
cd ../money-tracker-vite
# Créer static.json pour serveur statique
echo '{"root": "dist/"}' > static.json
git init
heroku git:remote -a finance-web
git add .
git commit -m "Deploy frontend"
git push heroku main
```

***

## 🧪 Tests

### Configuration des Tests

```bash
# Installer dépendances de test
npm install --save-dev jest supertest @testing-library/react @testing-library/jest-dom
```

### Tests Backend (Jest + Supertest)

```javascript
// money-tracker-backend/tests/transactions.test.js
const request = require('supertest');
const app = require('../server');

describe('Transactions API', () => {
  let authToken;
  
  beforeAll(async () => {
    // Login pour obtenir token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });
    authToken = res.body.token;
  });

  test('GET /api/transactions - Devrait retourner liste', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });

  test('POST /api/transactions - Créer transaction', async () => {
    const newTransaction = {
      account_id: 1,
      type: 'expense',
      amount: 1000,
      category: 'Test',
      description: 'Test transaction',
      transaction_date: '2026-01-08'
    };

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(newTransaction);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.amount).toBe(1000);
  });
});
```

### Tests Frontend (React Testing Library)

```javascript
// money-tracker-vite/src/components/__tests__/TransactionList.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { TransactionList } from '../transactions/TransactionList';
import { FinanceContext } from '../../contexts/FinanceContext';

describe('TransactionList Component', () => {
  const mockTransactions = [
    { id: 1, description: 'Test 1', amount: 100, type: 'income' },
    { id: 2, description: 'Test 2', amount: 50, type: 'expense' }
  ];

  test('Affiche les transactions', () => {
    render(
      <FinanceContext.Provider value={{ transactions: mockTransactions }}>
        <TransactionList />
      </FinanceContext.Provider>
    );

    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });

  test('Affiche message si aucune transaction', () => {
    render(
      <FinanceContext.Provider value={{ transactions: [] }}>
        <TransactionList />
      </FinanceContext.Provider>
    );

    expect(screen.getByText(/aucune transaction/i)).toBeInTheDocument();
  });
});
```

### Lancer les Tests

```bash
# Backend
cd money-tracker-backend
npm test

# Frontend
cd money-tracker-vite
npm test

# Coverage
npm test -- --coverage
```

***

## 📊 Monitoring & Logs

### Winston Logger Configuration

```javascript
// money-tracker-backend/config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Logs erreurs dans fichier
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    // Tous les logs
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Console en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### Utilisation des Logs

```javascript
const logger = require('./config/logger');

// Logs d'information
logger.info('Transaction créée', { 
  transactionId: transaction.id, 
  amount: transaction.amount 
});

// Logs d'erreur
logger.error('Erreur lors de la création', { 
  error: error.message, 
  stack: error.stack 
});

// Logs de debug
logger.debug('Détails de la requête', { 
  body: req.body, 
  user: req.user 
});
```

***

## 🔧 Maintenance & Backup

### Backup Automatique PostgreSQL

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/finance"
DB_NAME="finance_db"
DB_USER="finance_user"

# Créer dossier si inexistant
mkdir -p $BACKUP_DIR

# Backup
pg_dump -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/finance_${DATE}.sql.gz

# Garder seulement les 7 derniers jours
find $BACKUP_DIR -name "finance_*.sql.gz" -mtime +7 -delete

echo "Backup terminé: finance_${DATE}.sql.gz"
```

### Cron Job pour Backup Quotidien

```bash
# Ajouter au crontab
crontab -e

# Backup tous les jours à 2h du matin
0 2 * * * /home/user/scripts/backup.sh >> /var/log/finance_backup.log 2>&1
```

### Restauration depuis Backup

```bash
# Décompresser et restaurer
gunzip -c /var/backups/finance/finance_20260108_020000.sql.gz | \
  psql -U finance_user -d finance_db
```

### Maintenance DB (VACUUM)

```javascript
// money-tracker-backend/config/vaccum.js
const { Pool } = require('pg');
const logger = require('./logger');

async function performMaintenance() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD
  });

  try {
    logger.info('Début maintenance DB');
    
    // VACUUM pour récupérer l'espace
    await pool.query('VACUUM ANALYZE');
    
    // Nettoyer les sessions expirées
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    
    logger.info('Maintenance DB terminée');
  } catch (error) {
    logger.error('Erreur maintenance DB', { error: error.message });
  } finally {
    await pool.end();
  }
}

module.exports = { performMaintenance };
```

***

## 🤝 Contribution

### Guidelines

1. **Fork** le repository
2. Créer une **branche feature** (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add some AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une **Pull Request**

### Conventions de Code

#### JavaScript/React
- ESLint avec configuration Prettier
- Variables en camelCase
- Composants React en PascalCase
- Fonctions async/await plutôt que Promises
- Destructuring des props

```javascript
// ✅ Bon
const fetchTransactions = async ({ accountId, startDate }) => {
  try {
    const { data } = await api.get('/transactions', { 
      params: { accountId, startDate } 
    });
    return data;
  } catch (error) {
    logger.error('Erreur fetch transactions', { error });
    throw error;
  }
};

// ❌ Mauvais
function getTransactions(params) {
  return api.get('/transactions?accountId=' + params.accountId)
    .then(response => response.data)
    .catch(err => console.log(err));
}
```

#### SQL
- Tables en minuscules avec underscore
- Colonnes descriptives
- Foreign keys explicites
- Indexes sur colonnes de recherche fréquente

### Standards de Commit

```bash
# Format: <type>(<scope>): <subject>

feat(transactions): ajouter filtre par date
fix(projects): corriger calcul ROI
docs(readme): mettre à jour installation
style(ui): améliorer responsive mobile
refactor(api): simplifier routes
test(accounts): ajouter tests unitaires
chore(deps): mettre à jour dépendances
```

***

## 📄 Licence

Ce projet est sous licence **ISC**.

```
Copyright (c) 2026 Heri007

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

***

## 📞 Support & Contact

### Issues GitHub
Pour signaler des bugs ou demander des fonctionnalités :
[https://github.com/Heri007/FINANCE/issues](https://github.com/Heri007/FINANCE/issues)

### Documentation
- [Wiki du Projet](https://github.com/Heri007/FINANCE/wiki)
- [API Documentation](https://github.com/Heri007/FINANCE/blob/main/docs/API.md)
- [Guide Utilisateur](https://github.com/Heri007/FINANCE/blob/main/docs/USER_GUIDE.md)

***

## 🎓 Ressources Supplémentaires

### Technologies Utilisées
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/fr/guide/routing.html)
- [React Documentation](https://react.dev/)
- [PostgreSQL Manual](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts Examples](https://recharts.org/en-US/examples)

### Tutoriels Recommandés
- **PostgreSQL Optimization** : [Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- **React Best Practices** : [React Patterns](https://reactpatterns.com/)
- **Node.js Security** : [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

***

## 🗺️ Roadmap

### Version 1.1 (Q2 2026)
- [ ] Application mobile (React Native)
- [ ] Export PDF avancé des rapports
- [ ] Notifications push en temps réel
- [ ] Multi-devises avec taux de change
- [ ] Dashboard analytique avancé

### Version 1.2 (Q3 2026)
- [ ] Intégration bancaire (API Open Banking)
- [ ] Machine Learning pour prédictions
- [ ] Module de facturation
- [ ] Gestion multi-utilisateurs avec rôles
- [ ] API publique pour intégrations tierces

### Version 2.0 (Q4 2026)
- [ ] Comptabilité complète (plan comptable)
- [ ] Consolidation multi-sociétés
- [ ] Module paie intégré
- [ ] Rapports fiscaux automatisés
- [ ] Mode offline avec synchronisation

***

## 🙏 Remerciements

- **PostgreSQL Community** pour la base de données robuste
- **React Team** pour le framework frontend moderne
- **Recharts** pour les graphiques élégants
- **Tailwind CSS** pour le système de design
- **Contributors** pour leurs contributions

***

## 📈 Statistiques du Projet

```
Backend:
- 2005 lignes de SQL
- 8 controllers
- 13 routes API
- 20+ tables PostgreSQL
- 30+ endpoints REST

Frontend:
- 100+ composants React
- 4 modaux de projets spécialisés
- 15+ graphiques Recharts
- Support multi-thèmes
- Responsive mobile/tablet/desktop
```

***

**Développé avec ❤️ à Antananarivo, Madagascar 🇲🇬**

**Version:** 1.0.0 | **Dernière mise à jour:** 8 Janvier 2026