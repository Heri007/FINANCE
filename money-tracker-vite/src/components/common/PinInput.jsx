import { useState } from 'react';
import { Lock } from 'lucide-react';

export function PinInput({ onSubmit, title, subtitle }) {
  const [pin, setPin] = useState('');

  const handleKeyPress = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6) {
        setTimeout(() => {
          onSubmit(newPin);
          setPin('');
        }, 100);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Lock className="text-indigo-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                i < pin.length
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((key, index) => (
            <button
              key={index}
              onClick={() => {
                if (key === '⌫') handleDelete();
                else if (key !== '') handleKeyPress(key.toString());
              }}
              disabled={key === ''}
              className={`h-16 rounded-xl font-bold text-xl transition-all ${
                key === ''
                  ? 'invisible'
                  : 'bg-gray-100 hover:bg-indigo-50 active:scale-95 text-gray-800 hover:text-indigo-600'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}