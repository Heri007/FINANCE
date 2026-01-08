// services/projectMigrationService.js
const pool = require('../config/database');

/**
 * Service de migration des projets JSON vers les tables normalisées
 * 
 * Ce script :
 * 1. Lit tous les projets existants
 * 2. Parse leurs dépenses/revenus JSON
 * 3. Insère chaque ligne dans les tables dédiées
 * 4. Met à jour les transactions existantes avec les nouveaux IDs
 */
class ProjectMigrationService {
  
  /**
   * Fonction principale de migration
   */
  static async migrateAllProjects() {
    console.log('🔄 Début de la migration des projets...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Vérifier que les tables existent
      await this.ensureTablesExist(client);
      
      // 2. Récupérer tous les projets
      const projects = await client.query('SELECT * FROM projects ORDER BY id');
      console.log(`📊 ${projects.rows.length} projets à migrer`);
      
      let totalExpensesMigrated = 0;
      let totalRevenuesMigrated = 0;
      let projectsWithErrors = [];
      
      // 3. Migrer chaque projet
      for (const project of projects.rows) {
        try {
          const result = await this.migrateProject(client, project);
          totalExpensesMigrated += result.expenses;
          totalRevenuesMigrated += result.revenues;
          
          console.log(`✅ Projet ${project.id} (${project.name}): ${result.expenses} dépenses, ${result.revenues} revenus`);
          
        } catch (error) {
          console.error(`❌ Erreur sur projet ${project.id} (${project.name}):`, error.message);
          projectsWithErrors.push({
            id: project.id,
            name: project.name,
            error: error.message
          });
        }
      }
      
      // 4. Mettre à jour les statistiques des projets
      await this.updateProjectStats(client);
      
      await client.query('COMMIT');
      
      // 5. Résumé
      console.log('\n' + '='.repeat(50));
      console.log('📊 MIGRATION TERMINÉE');
      console.log('='.repeat(50));
      console.log(`✅ Projets traités: ${projects.rows.length}`);
      console.log(`✅ Dépenses migrées: ${totalExpensesMigrated}`);
      console.log(`✅ Revenus migrés: ${totalRevenuesMigrated}`);
      
      if (projectsWithErrors.length > 0) {
        console.log(`⚠️  Projets en erreur: ${projectsWithErrors.length}`);
        projectsWithErrors.forEach(p => {
          console.log(`   - ${p.name} (ID: ${p.id}): ${p.error}`);
        });
      }
      
      console.log('\n🚀 Pour vérifier :');
      console.log('   SELECT COUNT(*) FROM project_expense_lines;');
      console.log('   SELECT COUNT(*) FROM project_revenue_lines;');
      
      return {
        success: true,
        projects: projects.rows.length,
        expenses: totalExpensesMigrated,
        revenues: totalRevenuesMigrated,
        errors: projectsWithErrors
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur globale migration:', error);
      throw error;
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Vérifier et créer les tables si nécessaire
   */
  static async ensureTablesExist(client) {
    console.log('🔍 Vérification des tables...');
    
    // Table des dépenses
    const expensesTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'project_expense_lines'
      );
    `);
    
    if (!expensesTableExists.rows[0].exists) {
      console.log('📝 Création de la table project_expense_lines...');
      await client.query(`
        CREATE TABLE project_expense_lines (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'Autre',
          projected_amount DECIMAL(15, 2) DEFAULT 0,
          actual_amount DECIMAL(15, 2) DEFAULT 0,
          transaction_date DATE,
          is_paid BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client.query('CREATE INDEX idx_expense_lines_project ON project_expense_lines(project_id)');
    }
    
    // Table des revenus
    const revenuesTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'project_revenue_lines'
      );
    `);
    
    if (!revenuesTableExists.rows[0].exists) {
      console.log('📝 Création de la table project_revenue_lines...');
      await client.query(`
        CREATE TABLE project_revenue_lines (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          category VARCHAR(100) DEFAULT 'Autre',
          projected_amount DECIMAL(15, 2) DEFAULT 0,
          actual_amount DECIMAL(15, 2) DEFAULT 0,
          transaction_date DATE,
          is_received BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await client.query('CREATE INDEX idx_revenue_lines_project ON project_revenue_lines(project_id)');
    }
    
    // Vérifier la colonne project_line_id dans transactions
    const columnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name = 'project_line_id'
    `);
    
    if (columnExists.rows.length === 0) {
      console.log('📝 Ajout de la colonne project_line_id à transactions...');
      await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN project_line_id INTEGER
      `);
      await client.query('CREATE INDEX idx_transactions_project_line ON transactions(project_line_id)');
    }
    
    console.log('✅ Tables vérifiées/créées avec succès');
  }
  
  /**
   * Migrer un projet individuel
   */
  static async migrateProject(client, project) {
    const result = {
      expenses: 0,
      revenues: 0
    };
    
    // Parser les dépenses
    const expenses = this.parseJsonField(project.expenses);
    for (const expense of expenses) {
      // Chercher si la ligne existe déjà
      const existing = await client.query(
        `SELECT id FROM project_expense_lines 
         WHERE project_id = $1 
         AND description = $2 
         AND projected_amount = $3`,
        [project.id, expense.description || '', parseFloat(expense.amount || 0)]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO project_expense_lines 
           (project_id, description, category, projected_amount, is_paid)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            project.id,
            expense.description || 'Dépense non nommée',
            expense.category || 'Autre',
            parseFloat(expense.amount || 0),
            expense.isPaid || false
          ]
        );
        result.expenses++;
      }
    }
    
    // Parser les revenus
    const revenues = this.parseJsonField(project.revenues);
    for (const revenue of revenues) {
      const existing = await client.query(
        `SELECT id FROM project_revenue_lines 
         WHERE project_id = $1 
         AND description = $2 
         AND projected_amount = $3`,
        [project.id, revenue.description || '', parseFloat(revenue.amount || 0)]
      );
      
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO project_revenue_lines 
           (project_id, description, category, projected_amount, is_received)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            project.id,
            revenue.description || 'Revenu non nommé',
            revenue.category || 'Autre',
            parseFloat(revenue.amount || 0),
            revenue.isPaid || revenue.isReceived || false
          ]
        );
        result.revenues++;
      }
    }
    
    return result;
  }
  
  /**
   * Parser un champ JSON de façon sécurisée
   */
  static parseJsonField(data) {
    if (!data || data === 'null' || data === 'undefined') return [];
    
    try {
      // Si c'est déjà un tableau
      if (Array.isArray(data)) return data;
      
      // Si c'est une chaîne JSON
      if (typeof data === 'string') {
        // Nettoyer la chaîne
        const cleaned = data
          .replace(/\\"/g, '"')
          .replace(/\\n/g, ' ')
          .trim();
        
        if (cleaned === '' || cleaned === '[]') return [];
        
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      return [];
    } catch (error) {
      console.warn(`⚠️ Erreur parsing JSON: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Mettre à jour les statistiques des projets
   */
  static async updateProjectStats(client) {
    console.log('📈 Mise à jour des statistiques des projets...');
    
    // Récupérer tous les projets
    const projects = await client.query('SELECT id FROM projects');
    
    for (const project of projects.rows) {
      // Calculer le coût total à partir des lignes
      const expensesResult = await client.query(
        `SELECT COALESCE(SUM(projected_amount), 0) as total 
         FROM project_expense_lines 
         WHERE project_id = $1`,
        [project.id]
      );
      
      const revenuesResult = await client.query(
        `SELECT COALESCE(SUM(projected_amount), 0) as total 
         FROM project_revenue_lines 
         WHERE project_id = $1`,
        [project.id]
      );
      
      const totalCost = parseFloat(expensesResult.rows[0].total);
      const totalRevenues = parseFloat(revenuesResult.rows[0].total);
      const netProfit = totalRevenues - totalCost;
      const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
      
      // Mettre à jour le projet
      await client.query(
        `UPDATE projects 
         SET total_cost = $1, 
             total_revenues = $2, 
             net_profit = $3, 
             roi = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [totalCost, totalRevenues, netProfit, roi, project.id]
      );
    }
    
    console.log('✅ Statistiques mises à jour');
  }
  
  /**
   * Vérifier l'état de la migration
   */
  static async checkMigrationStatus() {
    console.log('🔍 État de la migration :');
    
    // Nombre de projets
    const projectsResult = await pool.query('SELECT COUNT(*) FROM projects');
    console.log(`   Projets totaux: ${projectsResult.rows[0].count}`);
    
    // Dépenses migrées
    const expensesResult = await pool.query('SELECT COUNT(*) FROM project_expense_lines');
    console.log(`   Lignes de dépenses: ${expensesResult.rows[0].count}`);
    
    // Revenus migrés
    const revenuesResult = await pool.query('SELECT COUNT(*) FROM project_revenue_lines');
    console.log(`   Lignes de revenus: ${revenuesResult.rows[0].count}`);
    
    // Projets sans lignes
    const emptyProjects = await pool.query(`
      SELECT p.id, p.name 
      FROM projects p
      LEFT JOIN project_expense_lines e ON p.id = e.project_id
      LEFT JOIN project_revenue_lines r ON p.id = r.project_id
      WHERE e.id IS NULL AND r.id IS NULL
    `);
    
    if (emptyProjects.rows.length > 0) {
      console.log(`   ⚠️  Projets sans lignes: ${emptyProjects.rows.length}`);
      emptyProjects.rows.forEach(p => {
        console.log(`      - ${p.name} (ID: ${p.id})`);
      });
    }
    
    return {
      projects: parseInt(projectsResult.rows[0].count),
      expenses: parseInt(expensesResult.rows[0].count),
      revenues: parseInt(revenuesResult.rows[0].count),
      emptyProjects: emptyProjects.rows
    };
  }
  
  /**
   * Annuler la migration (supprimer les tables)
   * ⚠️ DANGEREUX - À utiliser uniquement pour les tests
   */
  static async rollbackMigration() {
    console.log('⚠️  ROLLBACK de la migration...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Supprimer les tables
      await client.query('DROP TABLE IF EXISTS project_expense_lines CASCADE');
      await client.query('DROP TABLE IF EXISTS project_revenue_lines CASCADE');
      
      // Supprimer la colonne project_line_id
      await client.query(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'project_line_id'
          ) THEN
            ALTER TABLE transactions DROP COLUMN project_line_id;
          END IF;
        END $$;
      `);
      
      await client.query('COMMIT');
      console.log('✅ Rollback effectué');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur rollback:', error);
      throw error;
      
    } finally {
      client.release();
    }
  }
}

module.exports = ProjectMigrationService;