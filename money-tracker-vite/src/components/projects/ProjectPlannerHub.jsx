// src/components/projects/ProjectPlannerHub.jsx
import React, { useState, useEffect } from 'react';
import { X, Truck, Ship, Package, Heart, Zap } from 'lucide-react';

// ✅ Import de l'ancien modal (fallback pour types génériques)
import { ProjectPlannerModal } from '../../ProjectPlannerModal';

// ✅ Import des nouveaux modals spécialisés
import { CarriereModal } from './modals/CarriereModal';
import { ExportModal } from './modals/ExportModal';
import { LivestockModal } from './modals/LivestockModal';
import { ProductFlipModal } from './modals/ProductFlipModal';

/**
 * ProjectPlannerHub - Hub intelligent de création/édition de projets
 */
export function ProjectPlannerHub({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
  totalBalance,
}) {
  const [selectedType, setSelectedType] = useState(null);

  // ✅ VALIDATION SÉCURITÉ
  useEffect(() => {
    if (!createTransaction) {
      console.error('⚠️ ProjectPlannerHub: createTransaction est requis mais manquant');
    }
  }, [createTransaction]);

  // Reset du type sélectionné quand on ferme le modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
    }
  }, [isOpen]);

  // ✅ FONCTION CENTRALISÉE pour éviter la duplication
  const renderModalForType = (type) => {
    const commonProps = {
      isOpen,
      onClose,
      accounts,
      project: project || null,
      onProjectSaved,
      onProjectUpdated,
      createTransaction,
      totalBalance,
    };

    switch (type) {
      case 'CARRIERE':
        return <CarriereModal {...commonProps} />;

      case 'EXPORT':
        return <ExportModal {...commonProps} />;

      case 'LIVESTOCK':
        return <LivestockModal {...commonProps} />;

      case 'PRODUCTFLIP':
        return <ProductFlipModal {...commonProps} />;

      // ✅ FALLBACK: Types génériques (REALESTATE, FISHING, etc.)
      default:
        // Pour un nouveau projet avec type générique, on doit forcer le type
        // Si ProjectPlannerModal ne supporte pas initialType, créer le projet avec ce type
        return (
          <ProjectPlannerModal
            {...commonProps}
            // ⚠️ Vérifier si cette prop existe, sinon gérer différemment
            projectType={type}
          />
        );
    }
  };

  if (!isOpen) return null;

  // ===== CAS 1: ÉDITION D'UN PROJET EXISTANT =====
  if (project) {
    return renderModalForType(project.type);
  }

  // ===== CAS 2: NOUVEAU PROJET - TYPE DÉJÀ SÉLECTIONNÉ =====
  if (selectedType) {
    return renderModalForType(selectedType);
  }

  // ===== CAS 3: ÉCRAN DE SÉLECTION DU TYPE DE PROJET =====
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full p-8 max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Créer un Nouveau Projet
            </h2>
            <p className="text-gray-600">
              Choisissez le type de projet que vous souhaitez créer
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Grille de sélection - Projets Spécialisés */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* CARRIÈRE */}
          <ProjectTypeCard
            type="CARRIERE"
            icon={Truck}
            title="Carrière"
            description="Exploitation minière"
            color="amber"
            badge="Spécialisé"
            onClick={() => setSelectedType('CARRIERE')}
          />

          {/* EXPORT */}
          <ProjectTypeCard
            type="EXPORT"
            icon={Ship}
            title="Export"
            description="Containers & Commerce"
            color="blue"
            badge="Spécialisé"
            onClick={() => setSelectedType('EXPORT')}
          />

          {/* PRODUCT FLIP */}
          <ProjectTypeCard
            type="PRODUCTFLIP"
            icon={Package}
            title="Product Flip"
            description="Achat/Revente rapide"
            color="green"
            badge="Spécialisé"
            onClick={() => setSelectedType('PRODUCTFLIP')}
          />

          {/* ÉLEVAGE */}
          <ProjectTypeCard
            type="LIVESTOCK"
            icon={Heart}
            title="Élevage"
            description="Cycles animaux"
            color="pink"
            badge="Spécialisé"
            onClick={() => setSelectedType('LIVESTOCK')}
          />
        </div>

        {/* Section des types génériques */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Autres types de projets
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <GenericTypeButton
              type="REALESTATE"
              emoji="🏠"
              label="Immobilier"
              onClick={() => setSelectedType('REALESTATE')}
            />
            <GenericTypeButton
              type="FISHING"
              emoji="🎣"
              label="Pêche"
              onClick={() => setSelectedType('FISHING')}
            />
            <GenericTypeButton
              type="AGRICULTURE"
              emoji="🌾"
              label="Agriculture"
              onClick={() => setSelectedType('AGRICULTURE')}
            />
            <GenericTypeButton
              type="SERVICE"
              emoji="💼"
              label="Service"
              onClick={() => setSelectedType('SERVICE')}
            />
          </div>
        </div>

        {/* Pied de page */}
        <div className="flex justify-between items-center pt-6 border-t mt-6">
          <div className="text-sm text-gray-500">
            <Zap className="w-4 h-4 inline mr-1 text-amber-500" />
            Les types <strong>spécialisés</strong> offrent des fonctionnalités avancées
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium text-gray-700"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== COMPOSANTS HELPER POUR RÉDUIRE LA DUPLICATION =====

/**
 * Carte pour un type de projet spécialisé
 */
function ProjectTypeCard({ type, icon: Icon, title, description, color, badge, onClick }) {
  const colorClasses = {
    amber: 'border-amber-500 bg-amber-50 hover:bg-amber-100',
    blue: 'border-blue-500 bg-blue-50 hover:bg-blue-100',
    green: 'border-green-500 bg-green-50 hover:bg-green-100',
    pink: 'border-pink-500 bg-pink-50 hover:bg-pink-100',
  };

  const iconBgClasses = {
    amber: 'bg-amber-100 group-hover:bg-amber-200',
    blue: 'bg-blue-100 group-hover:bg-blue-200',
    green: 'bg-green-100 group-hover:bg-green-200',
    pink: 'bg-pink-100 group-hover:bg-pink-200',
  };

  const iconClasses = {
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    pink: 'text-pink-600',
  };

  const badgeClasses = {
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    pink: 'bg-pink-100 text-pink-700',
  };

  return (
    <button
      onClick={onClick}
      className={`group relative p-6 border-2 border-gray-200 rounded-xl hover:${colorClasses[color]} transition-all duration-200 flex flex-col items-center gap-4 hover:shadow-lg`}
    >
      <div className={`w-16 h-16 ${iconBgClasses[color]} rounded-full flex items-center justify-center transition-colors`}>
        <Icon className={`w-8 h-8 ${iconClasses[color]}`} />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-lg text-gray-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      {badge && (
        <span className={`absolute top-2 right-2 ${badgeClasses[color]} text-xs px-2 py-1 rounded-full font-medium`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * Bouton simple pour types génériques
 */
function GenericTypeButton({ type, emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-4 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
    >
      <span className="mr-2">{emoji}</span>
      {label}
    </button>
  );
}
