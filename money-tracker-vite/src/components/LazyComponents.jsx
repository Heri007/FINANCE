import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Composant de chargement
const LoadingSpinner = ({ message = 'Chargement...' }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    <p className="text-sm text-gray-600">{message}</p>
  </div>
);

// Lazy loading des composants lourds
export const LazyFinancialChart = lazy(() => 
  import('./charts/FinancialChart').catch(err => {
    console.error('Failed to load FinancialChart:', err);
    return { default: () => <div>Erreur de chargement du graphique</div> };
  })
);

export const LazyProjectDashboard = lazy(() => 
  import('./projects/ProjectDashboard')
);

export const LazyTransactionList = lazy(() => 
  import('./transactions/TransactionList')
);

export const LazyAccountsList = lazy(() => 
  import('./accounts/AccountsList')
);

export const LazyProfitDistribution = lazy(() => 
  import('./projects/ProfitDistribution')
);

export const LazyReports = lazy(() => 
  import('./reports/Reports')
);

// Wrapper avec Suspense
export const withSuspense = (Component, fallback) => {
  return (props) => (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <Component {...props} />
    </Suspense>
  );
};

// Export des composants wrapped
export const FinancialChart = withSuspense(LazyFinancialChart);
export const ProjectDashboard = withSuspense(LazyProjectDashboard);
export const TransactionList = withSuspense(LazyTransactionList);
export const AccountsList = withSuspense(LazyAccountsList);
export const ProfitDistribution = withSuspense(LazyProfitDistribution);
export const Reports = withSuspense(LazyReports);
