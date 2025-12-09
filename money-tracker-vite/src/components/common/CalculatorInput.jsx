// src/components/CalculatorInput.jsx
import React, { useState } from 'react';
import { Calculator } from 'lucide-react';

export function CalculatorInput({ value, onChange, placeholder, className = '', min = 0 }) {
  const [expression, setExpression] = useState('');
  const [showCalc, setShowCalc] = useState(false);

  const evaluateExpression = (expr) => {
    try {
      // Nettoyer l'expression (garder seulement chiffres et opérateurs)
      const cleanExpr = expr.replace(/[^0-9+\-*/().]/g, '');
      if (!cleanExpr) return null;

      // Évaluer en toute sécurité
      const result = Function(`"use strict"; return (${cleanExpr})`)();
      
      if (isNaN(result) || !isFinite(result)) {
        return null;
      }

      return Math.round(result * 100) / 100; // Arrondir à 2 décimales
    } catch (error) {
      return null;
    }
  };

  const handleChange = (e) => {
    const inputValue = e.target.value;
    setExpression(inputValue);

    // Si l'input contient des opérateurs, essayer d'évaluer
    if (/[+\-*/]/.test(inputValue)) {
      const result = evaluateExpression(inputValue);
      if (result !== null) {
        setShowCalc(true);
      }
    } else {
      setShowCalc(false);
      onChange(inputValue);
    }
  };

  const handleBlur = () => {
    // Au blur, remplacer par le résultat si c'est une expression valide
    const result = evaluateExpression(expression);
    if (result !== null) {
      onChange(result);
      setExpression(result.toString());
    } else if (expression) {
      onChange(expression);
    }
    setShowCalc(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  const displayValue = expression || value || '';
  const calculatedResult = showCalc ? evaluateExpression(expression) : null;

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className={`${className} ${showCalc ? 'border-green-500 border-2 pr-24' : ''}`}
      />
      
      {/* Indicateur calculatrice */}
      {showCalc && calculatedResult !== null && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-green-50 px-2 py-1 rounded text-sm pointer-events-none">
          <Calculator size={14} className="text-green-600" />
          <span className="font-bold text-green-700">
            = {calculatedResult.toLocaleString('fr-FR')}
          </span>
        </div>
      )}
    </div>
  );
}

