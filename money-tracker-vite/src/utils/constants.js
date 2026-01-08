import { Wallet, PiggyBank, Smartphone, Building, CreditCard } from 'lucide-react';

export const categoryIcons = {
  Transport: '🚗',
  Dons: '🎁',
  Goûters: '🍪',
  Hébergement: '🏠',
  VINA: '💼',
  Quotidienne: '🛒',
  Frais: '💸',
  Automobile: '🚙',
  Autres: '📋',
  Recettes: '💰',
  Afterwork: '🍻',
  Accessoires: '🕶️',
  'Crédits Phone': '📱',
  Habillements: '👕',
  'Soins personnels': '🧼',
  'HOME MJG': '🏡',
  Aide: '🤝',
  DOIT: '🧾',
  'Extra Solde': '💵',
  'Transfer (Inward)': '📥',
  '@TAHIANA': '👩',
  Transfert: '↔️',
  Alimentation: '🍔',
  Logement: '🏠',
  Loisirs: '🎮',
  Santé: '💊',
  Éducation: '📚',
  Salaire: '💰',
  Vente: '💵',
  Investissement: '📈',
};

export const accountIcons = {
  cash: Wallet,
  savings: PiggyBank,
  mobile: Smartphone,
  bank: Building,
  credit: CreditCard,
  digital: CreditCard,
};

export const accountTypes = [
  { value: 'cash', label: '💵 Espèces' },
  { value: 'bank', label: '🏦 Banque' },
  { value: 'mobile', label: '📱 Mobile Money' },
  { value: 'savings', label: '🐷 Épargne' },
  { value: 'credit', label: '💳 Crédit' },
  { value: 'digital', label: '💻 Wallet Digital' },
];
