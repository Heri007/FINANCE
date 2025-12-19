// src/components/projects/ProjectPlannerHub.jsx
import React, { useState, useEffect } from 'react';
import { X, Truck, Ship, Package, Heart, Zap } from 'lucide-react';

// ✅ Import de l'ancien modal (fallback pour PRODUCTFLIP et autres types génériques)
import { ProjectPlannerModal } from '../../ProjectPlannerModal';

// ✅ Import des nouveaux modals spécialisés
import { CarriereModal } from './modals/CarriereModal';
import { ExportModal } from './modals/ExportModal';
import { LivestockModal } from './modals/LivestockModal';

/**
 * ProjectPlannerHub - Hub intelligent de création/édition de projets
 * 
 * Comportement:
 * 1. Si on édite un projet existant → Ouvre directement le bon modal selon le type
 * 2. Si nouveau projet → Affiche l'écran de sélection du type
 * 3. PRODUCTFLIP et autres types génériques → Utilise l'ancien ProjectPlannerModal
 * 4. CARRIERE, EXPORT, LIVESTOCK → Utilise les nouveaux modals spécialisés
 */
export function ProjectPlannerHub({ 
  isOpen, 
  onClose, 
  accounts = [], 
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
  totalBalance
}) {
  
  const [selectedType, setSelectedType] = useState(null);

  // Reset du type sélectionné quand on ferme le modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ===== CAS 1: ÉDITION D'UN PROJET EXISTANT =====
  if (project) {
    const commonProps = {
      isOpen,
      onClose,
      accounts,
      project,
      onProjectSaved,
      onProjectUpdated,
      createTransaction,
      totalBalance
    };

    switch (project.type) {
      case 'CARRIERE':
        return <CarriereModal {...commonProps} />;
      
      case 'EXPORT':
        return <ExportModal {...commonProps} />;
      
      case 'LIVESTOCK':
        return <LivestockModal {...commonProps} />;
      
      // ✅ FALLBACK: Types génériques (PRODUCTFLIP, REALESTATE, FISHING, etc.)
      default:
        return <ProjectPlannerModal {...commonProps} />;
    }
  }

  // ===== CAS 2: NOUVEAU PROJET - TYPE DÉJÀ SÉLECTIONNÉ =====
  if (selectedType) {
    const commonProps = {
      isOpen,
      onClose,
      accounts,
      project: null,
      onProjectSaved,
      onProjectUpdated,
      createTransaction,
      totalBalance
    };

    switch (selectedType) {
      case 'CARRIERE':
        return <CarriereModal {...commonProps} />;
      
      case 'EXPORT':
        return <ExportModal {...commonProps} />;
      
      case 'LIVESTOCK':
        return <LivestockModal {...commonProps} />;
      
      // ✅ FALLBACK: Types génériques
      case 'PRODUCTFLIP':
      default:
        return (
          <ProjectPlannerModal 
            {...commonProps}
            // Force le type sélectionné
            initialType={selectedType}
          />
        );
    }
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
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Grille de sélection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* ========== CARRIÈRE ========== */}
          <button
            onClick={() => setSelectedType('CARRIERE')}
            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all duration-200 flex flex-col items-center gap-4 hover:shadow-lg"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <Truck className="w-8 h-8 text-amber-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-800 mb-1">Carrière</h3>
              <p className="text-sm text-gray-600">Exploitation minière</p>
            </div>
            <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium">
              Spécialisé
            </span>
          </button>

          {/* ========== EXPORT ========== */}
          <button
            onClick={() => setSelectedType('EXPORT')}
            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 flex flex-col items-center gap-4 hover:shadow-lg"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <Ship className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-800 mb-1">Export</h3>
              <p className="text-sm text-gray-600">Containers & Commerce</p>
            </div>
            <span className="absolute top-2 right-2 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
              Spécialisé
            </span>
          </button>

          {/* ========== ACHAT/REVENTE ========== */}
          <button
            onClick={() => setSelectedType('PRODUCTFLIP')}
            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all duration-200 flex flex-col items-center gap-4 hover:shadow-lg"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Package className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-800 mb-1">Achat/Revente</h3>
              <p className="text-sm text-gray-600">Stock rapide</p>
            </div>
            <span className="absolute top-2 right-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
              Standard
            </span>
          </button>

          {/* ========== ÉLEVAGE ========== */}
          <button
            onClick={() => setSelectedType('LIVESTOCK')}
            className="group relative p-6 border-2 border-gray-200 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all duration-200 flex flex-col items-center gap-4 hover:shadow-lg"
          >
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center group-hover:bg-pink-200 transition-colors">
              <Heart className="w-8 h-8 text-pink-600" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-gray-800 mb-1">Élevage</h3>
              <p className="text-sm text-gray-600">Cycles animaux</p>
            </div>
            <span className="absolute top-2 right-2 bg-pink-100 text-pink-700 text-xs px-2 py-1 rounded-full font-medium">
              Spécialisé
            </span>
          </button>

        </div>

        {/* Section des types génériques (optionnel, peut être caché) */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Autres types de projets
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <button
              onClick={() => setSelectedType('REALESTATE')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              🏠 Immobilier
            </button>

            <button
              onClick={() => setSelectedType('FISHING')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              🎣 Pêche
            </button>

            <button
              onClick={() => setSelectedType('AGRICULTURE')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              🌾 Agriculture
            </button>

            <button
              onClick={() => setSelectedType('SERVICE')}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
            >
              💼 Service
            </button>

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
