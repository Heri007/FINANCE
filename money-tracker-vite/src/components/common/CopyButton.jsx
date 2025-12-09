// components/common/CopyButton.jsx
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyButton({ getText, textToCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Autoriser soit getText (fonction), soit textToCopy (string)
      let text = '';

      if (typeof getText === 'function') {
        text = getText();
      } else if (typeof textToCopy === 'string') {
        text = textToCopy;
      } else {
        console.error('❌ CopyButton: ni getText fonction, ni textToCopy string.');
        alert('Erreur: impossible de générer le texte à copier');
        return;
      }

      console.log(
        '📋 Texte à copier généré:',
        text ? text.substring(0, 100) + '...' : 'VIDE'
      );

      if (!text || text.trim() === '') {
        console.error('❌ CopyButton: Le texte généré est vide');
        alert('Erreur: le texte généré est vide');
        return;
      }

      if (text.includes('undefined')) {
        console.error('❌ CopyButton: Le texte contient "undefined"');
        console.log('Texte problématique:', text);
        alert('Erreur: le texte généré contient des valeurs manquantes');
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log('✅ Texte copié avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la copie:', error);
      alert(`Erreur lors de la copie: ${error.message}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
    >
      {copied ? (
        <>
          <Check size={16} />
          Copié !
        </>
      ) : (
        <>
          <Copy size={16} />
          Copier
        </>
      )}
    </button>
  );
}
