-- ============================================
-- SCRIPT D'OPTIMISATION DES INDEXES
-- Base de données FINANCE - money-tracker
-- Version finale corrigée
-- ============================================

SET client_min_messages TO WARNING;

-- ============================================
-- 1. INDEXES POUR LA TABLE TRANSACTIONS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transactions_account_date 
ON transactions(account_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_project_date 
ON transactions(project_id, transaction_date DESC) 
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_date_type_amount 
ON transactions(transaction_date, type, amount);

CREATE INDEX IF NOT EXISTS idx_transactions_description_gin 
ON transactions USING gin(to_tsvector('french', COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_transactions_posted_date 
ON transactions(is_posted, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category 
ON transactions(category);

CREATE INDEX IF NOT EXISTS idx_transactions_userid 
ON transactions(user_id);

-- ============================================
-- 2. INDEXES POUR LA TABLE ACCOUNTS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_accounts_name_text 
ON accounts(name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_accounts_type_balance 
ON accounts(type, balance DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_type_name 
ON accounts(type, name);

CREATE INDEX IF NOT EXISTS idx_accounts_userid 
ON accounts(user_id);

-- ============================================
-- 3. INDEXES POUR LA TABLE PROJECTS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_name_text 
ON projects(name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_projects_status_startdate 
ON projects(status, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_projects_type_status 
ON projects(type, status);

CREATE INDEX IF NOT EXISTS idx_projects_feasible_status 
ON projects(feasible, status) 
WHERE feasible = true;

CREATE INDEX IF NOT EXISTS idx_projects_userid 
ON projects(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_roi 
ON projects(roi DESC) 
WHERE roi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_active 
ON projects(status, start_date) 
WHERE status IN ('active', 'draft');

-- ============================================
-- 4. INDEXES POUR PROJECT_EXPENSE_LINES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_expense_lines_project_amounts 
ON project_expense_lines(project_id, projected_amount, actual_amount);

CREATE INDEX IF NOT EXISTS idx_expense_lines_date 
ON project_expense_lines(transaction_date DESC) 
WHERE transaction_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expense_lines_unpaid 
ON project_expense_lines(project_id, is_paid, projected_amount) 
WHERE is_paid = false;

CREATE INDEX IF NOT EXISTS idx_expense_lines_category 
ON project_expense_lines(category);

CREATE INDEX IF NOT EXISTS idx_expense_lines_synced 
ON project_expense_lines(last_synced_at DESC) 
WHERE last_synced_at IS NOT NULL;

-- ============================================
-- 5. INDEXES POUR PROJECT_REVENUE_LINES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_revenue_lines_project_amounts 
ON project_revenue_lines(project_id, projected_amount, actual_amount);

CREATE INDEX IF NOT EXISTS idx_revenue_lines_date 
ON project_revenue_lines(transaction_date DESC) 
WHERE transaction_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_lines_unreceived 
ON project_revenue_lines(project_id, is_received, projected_amount) 
WHERE is_received = false;

CREATE INDEX IF NOT EXISTS idx_revenue_lines_category 
ON project_revenue_lines(category);

CREATE INDEX IF NOT EXISTS idx_revenue_lines_synced 
ON project_revenue_lines(last_synced_at DESC) 
WHERE last_synced_at IS NOT NULL;

-- ============================================
-- 6. INDEXES POUR LA TABLE RECEIVABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_receivables_account_status 
ON receivables(account_id, status);

CREATE INDEX IF NOT EXISTS idx_receivables_created 
ON receivables(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receivables_account_amount_status 
ON receivables(account_id, amount, status);

CREATE INDEX IF NOT EXISTS idx_receivables_open 
ON receivables(status, amount) 
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_receivables_source_account 
ON receivables(source_account_id) 
WHERE source_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_target_account 
ON receivables(target_account_id) 
WHERE target_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_userid 
ON receivables(user_id);

CREATE INDEX IF NOT EXISTS idx_receivables_person 
ON receivables(person text_pattern_ops);

-- ============================================
-- 7. INDEXES POUR LA TABLE NOTES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notes_content_gin 
ON notes USING gin(to_tsvector('french', COALESCE(content, '')));

CREATE INDEX IF NOT EXISTS idx_notes_created 
ON notes(created_at DESC);

-- ============================================
-- 8. INDEXES POUR TRANSACTION_LINKING_LOG
-- ============================================

CREATE INDEX IF NOT EXISTS idx_linking_log_transaction_action 
ON transaction_linking_log(transaction_id, action, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_linking_log_line_action 
ON transaction_linking_log(project_line_id, line_type, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_linking_log_performer 
ON transaction_linking_log(performed_by);

-- ============================================
-- 9. INDEXES POUR LES TABLES SUPPLÉMENTAIRES
-- ============================================

-- CATEGORIES
CREATE INDEX IF NOT EXISTS idx_categories_type 
ON categories(type);

CREATE INDEX IF NOT EXISTS idx_categories_name 
ON categories(name text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_categories_userid 
ON categories(user_id);

-- SESSIONS (sans CURRENT_TIMESTAMP dans WHERE)
CREATE INDEX IF NOT EXISTS idx_sessions_expires 
ON sessions(expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_userid 
ON sessions(user_id);

-- TASKS
CREATE INDEX IF NOT EXISTS idx_tasks_status_duedate 
ON tasks(status, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_projectid 
ON tasks(project_id) 
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee 
ON tasks(assignee);

CREATE INDEX IF NOT EXISTS idx_tasks_priority 
ON tasks(priority, status);

-- SOPS
CREATE INDEX IF NOT EXISTS idx_sops_projectid 
ON sops(project_id) 
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sops_status_sops 
ON sops(status);

CREATE INDEX IF NOT EXISTS idx_sops_category_sops 
ON sops(category);

CREATE INDEX IF NOT EXISTS idx_sops_owner 
ON sops(owner);

-- EMPLOYEES
CREATE INDEX IF NOT EXISTS idx_employees_status_dept 
ON employees(status, department);

CREATE INDEX IF NOT EXISTS idx_employees_dept 
ON employees(department);

CREATE INDEX IF NOT EXISTS idx_employees_position 
ON employees(position);

-- OBJECTIVES
CREATE INDEX IF NOT EXISTS idx_objectives_deadline_obj 
ON objectives(deadline DESC) 
WHERE deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objectives_completed_obj 
ON objectives(completed);

CREATE INDEX IF NOT EXISTS idx_objectives_category_obj 
ON objectives(category);

CREATE INDEX IF NOT EXISTS idx_objectives_progress 
ON objectives(progress DESC);

-- OPERATOR_TASKS
CREATE INDEX IF NOT EXISTS idx_operator_tasks_status_op 
ON operator_tasks(status);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_project_op 
ON operator_tasks(project_id) 
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operator_tasks_assigned_op 
ON operator_tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_priority_op 
ON operator_tasks(priority, status);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_duedate 
ON operator_tasks(due_date DESC) 
WHERE due_date IS NOT NULL;

-- OPERATORS_OPS (SOPs)
CREATE INDEX IF NOT EXISTS idx_operators_ops_status_ops 
ON operators_ops(status);

CREATE INDEX IF NOT EXISTS idx_operators_ops_category_ops 
ON operators_ops(category);

CREATE INDEX IF NOT EXISTS idx_operators_ops_owner_ops 
ON operators_ops(owner);

-- MASTER_CONTENT
CREATE INDEX IF NOT EXISTS idx_mastercontent_status 
ON mastercontent(status);

CREATE INDEX IF NOT EXISTS idx_mastercontent_type 
ON mastercontent(type);

-- DERIVATIVES
CREATE INDEX IF NOT EXISTS idx_derivatives_masterid 
ON derivatives(master_id);

CREATE INDEX IF NOT EXISTS idx_derivatives_platform 
ON derivatives(platform);

CREATE INDEX IF NOT EXISTS idx_derivatives_status 
ON derivatives(status);

-- ============================================
-- 10. STATISTIQUES ET ANALYSE
-- ============================================

ANALYZE transactions;
ANALYZE accounts;
ANALYZE projects;
ANALYZE project_expense_lines;
ANALYZE project_revenue_lines;
ANALYZE receivables;
ANALYZE notes;
ANALYZE transaction_linking_log;
ANALYZE categories;
ANALYZE sessions;
ANALYZE tasks;
ANALYZE sops;
ANALYZE employees;
ANALYZE objectives;
ANALYZE operator_tasks;
ANALYZE operators_ops;
ANALYZE mastercontent;
ANALYZE derivatives;

SET client_min_messages TO NOTICE;

SELECT 'Indexes créés avec succès!' as status;
