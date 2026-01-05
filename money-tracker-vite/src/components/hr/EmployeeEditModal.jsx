// src/components/hr/EmployeeEditModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Upload, User } from 'lucide-react';
import { API_BASE } from '../../services/api';

export function EmployeeEditModal({ employee, open, onClose, onSave, projects = [] }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    email: '',
    phone: '',
    facebook: '',
    linkedin: '',
    location: '',
    salary: '',
    startDate: '',
    contractType: 'CDI',
    status: 'active',
    skills: [],
    projects: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: '',
    },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // ✅ Initialiser formData quand employee change
  useEffect(() => {
    if (employee && open) {
      console.log('🔄 Initializing form with employee:', employee);

      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        position: employee.position || '',
        department: employee.department || '',
        email: employee.email || '',
        phone: employee.phone || '',
        facebook: employee.facebook || '',
        linkedin: employee.linkedin || '',
        location: employee.location || '',
        salary: employee.salary || '',
        startDate: employee.startDate || '',
        contractType: employee.contractType || 'CDI',
        status: employee.status || 'active',
        skills: Array.isArray(employee.skills) ? employee.skills : [],
        projects: Array.isArray(employee.projects) ? employee.projects : [],
        emergencyContact: {
          name: employee.emergencyContact?.name || '',
          phone: employee.emergencyContact?.phone || '',
          relationship: employee.emergencyContact?.relationship || '',
        },
      });

      setPhotoPreview(employee.photo ? `${API_BASE}${employee.photo}` : null);
      setPhotoFile(null);
    }
  }, [employee, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSkillsChange = (skillsString) => {
    const skillsArray = skillsString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, skills: skillsArray }));
  };

  const handleProjectsChange = (selectedProjects) => {
    setFormData((prev) => ({ ...prev, projects: selectedProjects }));
  };

  const handleEmergencyContactChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value,
      },
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dataToSend = {
        id: employee.id, // ✅ CRITIQUE
        ...formData,
        skills: formData.skills,
        projects: formData.projects,
        emergencyContact: formData.emergencyContact,
      };

      console.log('💾 Saving employee ID:', dataToSend.id);

      await onSave(dataToSend);
      onClose();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    }
  };

  if (!open || !employee) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b-2 border-blue-700 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">Modifier l'employé</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo */}
          <div className="flex justify-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-blue-600"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center border-4 border-slate-300">
                  <User className="w-16 h-16 text-slate-400" strokeWidth={2.5} />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full p-2 cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md">
                <Upload className="w-4 h-4" strokeWidth={2.5} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Poste <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Département <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all bg-white font-semibold"
              >
                <option value="">Sélectionner...</option>
                <option value="IT">IT</option>
                <option value="Management">Management</option>
                <option value="Opérations">Opérations</option>
                <option value="Finance">Finance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Localisation
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Salaire (Ar)
              </label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) => handleChange('salary', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Date d'embauche
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Type de contrat
              </label>
              <select
                value={formData.contractType}
                onChange={(e) => handleChange('contractType', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all bg-white font-semibold"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Freelance">Freelance</option>
                <option value="Stage">Stage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all bg-white font-semibold"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="leave">En congé</option>
              </select>
            </div>
          </div>

          {/* Compétences */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Compétences (séparées par des virgules)
            </label>
            <input
              type="text"
              value={formData.skills.join(', ')}
              onChange={(e) => handleSkillsChange(e.target.value)}
              placeholder="Ex: React, Node.js, Python..."
              className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
            />
          </div>

          {/* Contact d'urgence */}
          <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
            <h3 className="text-sm font-black text-red-800 mb-3 uppercase">
              Contact d'urgence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Nom"
                value={formData.emergencyContact.name}
                onChange={(e) => handleEmergencyContactChange('name', e.target.value)}
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
              <input
                type="tel"
                placeholder="Téléphone"
                value={formData.emergencyContact.phone}
                onChange={(e) => handleEmergencyContactChange('phone', e.target.value)}
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
              <input
                type="text"
                placeholder="Relation"
                value={formData.emergencyContact.relationship}
                onChange={(e) =>
                  handleEmergencyContactChange('relationship', e.target.value)
                }
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t-2 border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 px-6 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-bold"
            >
              <Save className="w-4 h-4 inline mr-2" strokeWidth={2.5} />
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
