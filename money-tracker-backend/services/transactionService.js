const pool = require('../config/database');

class TransactionService {
  // Exécuter une transaction avec gestion d'erreur
  async executeTransaction(callback) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return { success: true, data: result };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction rolled back:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Créer une transaction financière complète avec validation
  async createFinancialTransaction(transactionData, client = null) {
    const shouldManageClient = !client;
    const workingClient = client || await pool.connect();

    try {
      if (shouldManageClient) {
        await workingClient.query('BEGIN');
      }

      // 1. Insérer la transaction
      const insertQuery = `
        INSERT INTO transactions (
          date, type, category, amount, description, 
          context_id, account_id, project_id, user_id, payment_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        transactionData.date,
        transactionData.type,
        transactionData.category,
        transactionData.amount,
        transactionData.description,
        transactionData.context_id,
        transactionData.account_id,
        transactionData.project_id,
        transactionData.user_id,
        transactionData.payment_method
      ];

      const result = await workingClient.query(insertQuery, values);
      const transaction = result.rows[0];

      // 2. Mettre à jour le solde du compte
      if (transactionData.account_id) {
        const updateAccountQuery = `
          UPDATE accounts 
          SET balance = balance + $1, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        await workingClient.query(updateAccountQuery, [
          transactionData.type === 'EXPENSE' ? -transactionData.amount : transactionData.amount,
          transactionData.account_id
        ]);
      }

      // 3. Mettre à jour les métriques du projet si applicable
      if (transactionData.project_id) {
        const updateProjectQuery = `
          UPDATE projects
          SET total_spent = total_spent + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        const spentAmount = transactionData.type === 'EXPENSE' ? transactionData.amount : 0;
        await workingClient.query(updateProjectQuery, [spentAmount, transactionData.project_id]);
      }

      // 4. Logger l'audit trail
      const auditQuery = `
        INSERT INTO audit_log (
          entity_type, entity_id, action, user_id, details
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await workingClient.query(auditQuery, [
        'transaction',
        transaction.id,
        'CREATE',
        transactionData.user_id,
        JSON.stringify({ transaction_type: transactionData.type, amount: transactionData.amount })
      ]);

      if (shouldManageClient) {
        await workingClient.query('COMMIT');
      }

      return { success: true, data: transaction };
    } catch (error) {
      if (shouldManageClient) {
        await workingClient.query('ROLLBACK');
      }
      console.error('Transaction creation failed:', error);
      throw error;
    } finally {
      if (shouldManageClient) {
        workingClient.release();
      }
    }
  }

  // Distribution de bénéfices avec transaction atomique
  async distributeProfits(projectId, distributionData, userId) {
    return this.executeTransaction(async (client) => {
      // 1. Vérifier le projet et ses bénéfices
      const projectQuery = 'SELECT * FROM projects WHERE id = $1';
      const projectResult = await client.query(projectQuery, [projectId]);
      
      if (projectResult.rows.length === 0) {
        throw new Error('Projet non trouvé');
      }

      const project = projectResult.rows[0];
      const totalToDistribute = distributionData.amount;

      // 2. Créer les distributions pour chaque partenaire
      const distributions = [];
      for (const partner of distributionData.partners) {
        const distributionQuery = `
          INSERT INTO profit_distributions (
            project_id, partner_id, amount, percentage, 
            distribution_date, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        
        const result = await client.query(distributionQuery, [
          projectId,
          partner.partner_id,
          partner.amount,
          partner.percentage,
          distributionData.distribution_date,
          'PENDING',
          userId
        ]);
        
        distributions.push(result.rows[0]);

        // 3. Créer une transaction pour chaque distribution
        await this.createFinancialTransaction({
          date: distributionData.distribution_date,
          type: 'EXPENSE',
          category: 'PROFIT_DISTRIBUTION',
          amount: partner.amount,
          description: `Distribution bénéfices à ${partner.partner_name} (${partner.percentage}%)`,
          project_id: projectId,
          context_id: project.context_id,
          user_id: userId,
          payment_method: distributionData.payment_method || 'TRANSFER'
        }, client);
      }

      // 4. Mettre à jour le projet
      const updateProjectQuery = `
        UPDATE projects 
        SET total_distributed = total_distributed + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await client.query(updateProjectQuery, [totalToDistribute, projectId]);

      // 5. Audit log
      const auditQuery = `
        INSERT INTO audit_log (
          entity_type, entity_id, action, user_id, details
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(auditQuery, [
        'profit_distribution',
        projectId,
        'DISTRIBUTE',
        userId,
        JSON.stringify({ amount: totalToDistribute, partners: distributionData.partners.length })
      ]);

      return { distributions, project };
    });
  }

  // Batch import avec transaction
  async batchImportTransactions(transactions, userId) {
    return this.executeTransaction(async (client) => {
      const imported = [];
      const errors = [];

      for (let i = 0; i < transactions.length; i++) {
        try {
          const result = await this.createFinancialTransaction({
            ...transactions[i],
            user_id: userId
          }, client);
          imported.push(result.data);
        } catch (error) {
          errors.push({
            line: i + 1,
            data: transactions[i],
            error: error.message
          });
        }
      }

      if (errors.length > 0) {
        throw new Error(`Batch import failed with ${errors.length} errors: ${JSON.stringify(errors)}`);
      }

      return { imported, count: imported.length };
    });
  }
}

module.exports = new TransactionService();
