export const formatCurrency = (amount) => 
  new Intl.NumberFormat("fr-FR", { 
    maximumFractionDigits: 0 
  }).format(amount || 0) + " Ar";

export const formatDate = (dateString) => 
  new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatDateTime = (dateString) => 
  new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });