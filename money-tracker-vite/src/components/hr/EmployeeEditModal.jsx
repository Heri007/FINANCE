// src/components/hr/EmployeeEditModal.jsx
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, DollarSign, Facebook, Linkedin, Calendar, FolderKanban, X, Upload } from 'lucide-react';
import { API_BASE } from '../../services/api';
import { toast } from 'react-toastify';

// ✅ AJOUT : Recevoir projects via props
export function EmployeeEditModal({ employee, open, onClose, onSave, projects = [] }) {
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    email: '',
    phone: '',
    facebook: '',
    linkedin: '',
    location: '',
    salary: 0,
    startDate: '',
    contractType: 'CDI',
    status: 'active',
    skills: [],
    emergencyContact: { name: '', phone: '', relation: '' }
  });

  // ✅ CORRECTION : Utiliser la prop projects au lieu de loadProjects()
  useEffect(() => {
    if (open && employee) {
    console.log('📦 Projets reçus via props:', projects);
    console.log('📦 Projets disponibles:', availableProjects);
      // ✅ Utiliser directement la prop projects
      setAvailableProjects(projects);
      
      // Initialiser formValues avec les données de l'employé
      setFormValues({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        position: employee.position || '',
        department: employee.department || '',
        email: employee.email || '',
        phone: employee.phone || '',
        facebook: employee.facebook || '',
        linkedin: employee.linkedin || '',
        location: employee.location || '',
        salary: employee.salary || 0,
        startDate: employee.startDate ? employee.startDate.slice(0, 10) : '',
        contractType: employee.contractType || 'CDI',
        status: employee.status || 'active',
        skills: employee.skills || [],
        emergencyContact: employee.emergencyContact || { name: '', phone: '', relation: '' }
      });
      
      setSelectedProjects(employee.projects || []);
      setPhotoPreview(employee.photo || null);
      setPhotoFile(null);
    }
  }, [open, employee, projects]); // ✅ Ajouter projects dans les dépendances

  // ❌ SUPPRIMER la fonction loadProjects() complètement
  // const loadProjects = async () => { ... }

  // ✅ CORRECTION : Gérer les deux formats de nom de projet
  const toggleProject = (projectName) => {
    setSelectedProjects(prev => 
      prev.includes(projectName)
        ? prev.filter(p => p !== projectName)
        : [...prev, projectName]
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmergencyChange = (field, value) => {
    setFormValues(prev => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value
      }
    }));
  };

  const handlePhotoChange = (e) => {
  const file = e.target.files[0];
  
  // ✅ VALIDATION : Vérifier que le fichier existe et est valide
  if (!file) {
    console.warn('Aucun fichier sélectionné');
    return;
  }

  // ✅ VALIDATION : Vérifier que c'est bien un Blob/File
  if (!(file instanceof Blob)) {
    console.error('Le fichier sélectionné n\'est pas un Blob valide');
    return;
  }

  // ✅ VALIDATION : Vérifier le type MIME
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    console.error('Type de fichier non supporté:', file.type);
    alert('Seules les images (JPG, PNG, GIF, WEBP) sont autorisées');
    return;
  }

  // ✅ VALIDATION : Vérifier la taille (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    alert('Le fichier est trop volumineux (max 5MB)');
    return;
  }

  // ✅ Tout est OK, on peut procéder
  setPhotoFile(file);
  
  const reader = new FileReader();
  reader.onloadend = () => {
    setPhotoPreview(reader.result);
  };
  reader.onerror = () => {
    console.error('Erreur lors de la lecture du fichier');
    alert('Impossible de lire le fichier');
  };
  
  reader.readAsDataURL(file);
};


  if (!open || !employee) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const formData = new FormData();
      
      // Ajouter tous les champs depuis formValues
      formData.append('firstName', formValues.firstName);
      formData.append('lastName', formValues.lastName);
      formData.append('position', formValues.position);
      formData.append('department', formValues.department);
      formData.append('email', formValues.email);
      formData.append('phone', formValues.phone || '');
      formData.append('facebook', formValues.facebook || '');
      formData.append('linkedin', formValues.linkedin || '');
      formData.append('location', formValues.location || '');
      formData.append('salary', formValues.salary || 0);
      formData.append('startDate', formValues.startDate);
      formData.append('contractType', formValues.contractType);
      formData.append('status', formValues.status);
      
      // Ajouter projets
      formData.append('projects', JSON.stringify(selectedProjects));
      
      // Ajouter skills et contact d'urgence
      formData.append('skills', JSON.stringify(formValues.skills));
      formData.append('emergencyContact', JSON.stringify(formValues.emergencyContact));
      
      // Ajouter la photo si modifiée
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const response = await fetch(`${API_BASE}/api/employees/${employee.id}`, {
        method: 'PUT',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erreur mise à jour');
      }

      const updated = await response.json();
      onSave(updated);
      onClose();
      toast.success('Employé mis à jour avec succès');
    } catch (err) {
      console.error('Erreur:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Modifier le profil de {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-xs text-gray-500">
                Poste actuel : {employee.position} • Département : {employee.department}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Fermer
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {/* Photo de profil */}
          <div className="flex justify-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
                  <User className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg">
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Identité & contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded px-2">
                <User className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="firstName"
                  value={formValues.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full py-1 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                name="lastName"
                value={formValues.lastName}
                onChange={handleInputChange}
                required
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded px-2">
                <Mail className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="email"
                  type="email"
                  value={formValues.email}
                  onChange={handleInputChange}
                  required
                  className="w-full py-1 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <div className="flex items-center border rounded px-2">
                <Phone className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="phone"
                  value={formValues.phone}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                  placeholder="+261 34 12 345 67"
                />
              </div>
            </div>
          </div>

          {/* Poste, département, localisation, contrat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Poste <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border rounded px-2">
                <Briefcase className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="position"
                  value={formValues.position}
                  onChange={handleInputChange}
                  required
                  className="w-full py-1 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Département <span className="text-red-500">*</span>
              </label>
              <select
                name="department"
                value={formValues.department}
                onChange={handleInputChange}
                required
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="">-- Sélectionner --</option>
                <option value="IT">IT</option>
                <option value="Management">Management</option>
                <option value="Opérations">Opérations</option>
                <option value="Finance">Finance</option>
                <option value="RH">RH</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Localisation</label>
              <div className="flex items-center border rounded px-2">
                <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="location"
                  value={formValues.location}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                  placeholder="Antananarivo"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Type de contrat</label>
              <select
                name="contractType"
                value={formValues.contractType}
                onChange={handleInputChange}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Freelance">Freelance</option>
                <option value="Stage">Stage</option>
              </select>
            </div>
          </div>

          {/* Statut, date d'embauche, salaire */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Statut</label>
              <select
                name="status"
                value={formValues.status}
                onChange={handleInputChange}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="active">Actif</option>
                <option value="leave">Congé</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Date d'embauche</label>
              <div className="flex items-center border rounded px-2">
                <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="startDate"
                  type="date"
                  value={formValues.startDate}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Salaire mensuel (Ar)</label>
              <div className="flex items-center border rounded px-2">
                <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                <input
                  name="salary"
                  type="number"
                  min="0"
                  step="1000"
                  value={formValues.salary}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                />
              </div>
            </div>
          </div>


          {/* ✅ CORRECTION : Section Projets assignés */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-semibold">Projets assignés</h3>
              <span className="text-xs text-gray-500">
                ({selectedProjects.length} sélectionné{selectedProjects.length > 1 ? 's' : ''})
              </span>
            </div>
            
            {availableProjects.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun projet disponible</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded border">
                {availableProjects.map((project) => {
                  // ✅ CORRECTION : Gérer les deux formats de nom
                  const projectName = project.projectName || project.name || project.project_name;
                  
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => toggleProject(projectName)}
                      className={`
                        flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors
                        ${selectedProjects.includes(projectName)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      {projectName}
                      {/* ✅ Badge statut (optionnel) */}
                      {project.status === 'active' && (
                        <span className="ml-1 text-xs">✓</span>
                      )}
                      {selectedProjects.includes(projectName) && (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Réseaux sociaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Facebook</label>
              <div className="flex items-center border rounded px-2">
                <Facebook className="w-4 h-4 text-blue-600 mr-1" />
                <input
                  name="facebook"
                  value={formValues.facebook}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                  placeholder="https://facebook.com/..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">LinkedIn</label>
              <div className="flex items-center border rounded px-2">
                <Linkedin className="w-4 h-4 text-sky-700 mr-1" />
                <input
                  name="linkedin"
                  value={formValues.linkedin}
                  onChange={handleInputChange}
                  className="w-full py-1 text-sm outline-none"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
          </div>

          {/* Contact d'urgence */}
          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold mb-2">Contact d'urgence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom</label>
                <input
                  value={formValues.emergencyContact.name}
                  onChange={(e) => handleEmergencyChange('name', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Nom complet"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Relation</label>
                <input
                  value={formValues.emergencyContact.relation}
                  onChange={(e) => handleEmergencyChange('relation', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Époux/Épouse, Mère, etc."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                <input
                  value={formValues.emergencyContact.phone}
                  onChange={(e) => handleEmergencyChange('phone', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="+261 34 12 345 67"
                />
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
