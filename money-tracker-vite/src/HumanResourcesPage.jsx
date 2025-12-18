// src/HumanResourcesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './assets/HumanResourcesPage.css'; 
import { 
  User, Mail, Phone, Facebook, Linkedin, MapPin, Calendar,
  Briefcase, DollarSign, Award, Edit, Trash2, Plus, Search,
  Filter, Upload, Download, Eye, Clock, CheckCircle, X
} from 'lucide-react';
import { EmployeeEditModal } from './components/hr/EmployeeEditModal';
import { API_BASE, api } from './services/api';

/**
 * Page principale de gestion des ressources humaines
 * Permet de visualiser, ajouter, modifier et gérer les employés
 */
const HumanResourcesPage = ({ projects = [] }) => {
  // États pour la gestion des employés
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // États pour les modales
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // ✅ État pour le formulaire d'ajout
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
    salary: '',
    startDate: new Date().toISOString().split('T')[0],
    contractType: 'CDI',
    skills: [],
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    }
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Chargement initial des employés
  useEffect(() => {
  loadEmployees();
}, []);

  /**
   * Charge la liste des employés depuis l'API
   */
  const loadEmployees = async () => {
  try {
    const response = await api.get('/employees');
    
    // ✅ Transformer CORRECTEMENT snake_case → camelCase
    const formattedEmployees = response.map(emp => ({
      id: emp.id,
      firstName: emp.first_name || emp.firstName || 'Prénom',
      lastName: emp.last_name || emp.lastName || 'Nom',
      photo: emp.photo,
      position: emp.position || 'Poste',
      department: emp.department || 'Département',
      email: emp.email || '',
      phone: emp.phone || '',
      facebook: emp.facebook || '',
      linkedin: emp.linkedin || '',
      location: emp.location || '',
      salary: parseFloat(emp.salary) || 0,
      startDate: emp.start_date || emp.startDate || new Date().toISOString().split('T')[0],
      contractType: emp.contract_type || emp.contractType || 'CDI',
      status: emp.status || 'active',
      skills: typeof emp.skills === 'string' ? JSON.parse(emp.skills || '[]') : (emp.skills || []),
      projects: typeof emp.projects === 'string' ? JSON.parse(emp.projects || '[]') : (emp.projects || []),
      emergencyContact: typeof emp.emergency_contact === 'string' 
        ? JSON.parse(emp.emergency_contact || '{}') 
        : (emp.emergencyContact || emp.emergency_contact || {}),
      createdAt: emp.created_at || emp.createdAt,
      updatedAt: emp.updated_at || emp.updatedAt
    }));
    
    console.log('✅ Employés chargés:', formattedEmployees);
    setEmployees(formattedEmployees);
  } catch (error) {
    console.error('❌ Erreur chargement employés:', error);
    toast.error('Erreur lors du chargement des employés');
    setEmployees([]);
  }
};


  /**
   * Gère les changements de champs du formulaire
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Gère les changements de compétences
   */
  const handleSkillsChange = (skillsString) => {
    const skillsArray = skillsString.split(',').map(s => s.trim()).filter(Boolean);
    setFormValues(prev => ({
      ...prev,
      skills: skillsArray
    }));
  };

  /**
   * Gère les changements du contact d'urgence
   */
  const handleEmergencyContactChange = (field, value) => {
    setFormValues(prev => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [field]: value
      }
    }));
  };

  /**
   * Gère le changement de photo
   */
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

 
  // Dans handleSubmit de HumanResourcesPage.jsx
  const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const formData = new FormData();
    
    // Ajouter tous les champs
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
    formData.append('skills', JSON.stringify(formValues.skills));
    formData.append('emergencyContact', JSON.stringify(formValues.emergencyContact));
    
    if (photoFile) {
      formData.append('photo', photoFile);
    }

    // ✅ Utiliser fetch avec l'URL complète
    const response = await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Erreur lors de la création');
    }

    const newEmployee = await response.json();
    
    // Ajouter à la liste
    setEmployees(prev => [...prev, newEmployee]);
    
    // Réinitialiser le formulaire
    setFormValues({
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
      startDate: new Date().toISOString().split('T')[0],
      contractType: 'CDI',
      skills: [],
      emergencyContact: { name: '', phone: '', relationship: '' }
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowAddModal(false);
    
    toast.success('Employé ajouté avec succès');
  } catch (err) {
    console.error('Erreur ajout employé:', err);
    toast.error(err.message || 'Erreur lors de l\'ajout');
  }
};


  /**
   * Gère la mise à jour d'un employé
   */
  const handleEmployeeUpdated = (updated) => {
    if (!updated || !updated.id) {
      return;
    }
    setEmployees(prev =>
      prev.map(e => (e.id === updated.id ? updated : e))
    );
  };

  /**
   * Gère la suppression d'un employé
   */
  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('⚠️ Voulez-vous vraiment supprimer cet employé ?')) return;
    
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erreur suppression');
      }

      setEmployees(prev => prev.filter(e => e.id !== id));
      toast.success('✅ Employé supprimé');
    } catch (err) {
      console.error('Erreur:', err);
      toast.error(`❌ ${err.message}`);
    }
  };

  /**
   * Filtre les employés selon les critères
   */
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const firstName = emp.firstName || '';
      const lastName = emp.lastName || '';
      const position = emp.position || '';
      const department = emp.department || '';
      
      const matchesSearch = !searchTerm || 
        firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !selectedDepartment || 
        selectedDepartment === 'all' || 
        department === selectedDepartment;
      
      const matchesStatus = !selectedStatus || 
        emp.status === selectedStatus;
      
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchTerm, selectedDepartment, selectedStatus]);

  /**
   * Calcule les statistiques RH
   */
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'leave').length,
    totalSalary: employees.reduce((sum, e) => sum + (e.salary || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          👥 TEAM
        </h1>
        <p className="text-gray-600">Gestion de l'équipe</p>
      </div>

      {/* Statistiques RH */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<User className="w-6 h-6" />}
          label="Total Employés"
          value={stats.total}
          color="bg-blue-500"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Actifs"
          value={stats.active}
          color="bg-green-500"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="En congé"
          value={stats.onLeave}
          color="bg-orange-500"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Masse Salariale"
          value={`${(stats.totalSalary / 1000000).toFixed(1)}M Ar`}
          color="bg-purple-500"
        />
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtre département */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Tous les départements</option>
              <option value="IT">IT</option>
              <option value="Management">Management</option>
              <option value="Opérations">Opérations</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          {/* Mode d'affichage */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Liste
            </button>
          </div>

          {/* Bouton Ajouter */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste des employés */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onView={() => setSelectedEmployee(employee)}
              onEdit={(emp) => {
                setEditingEmployee(emp);
                setIsEditOpen(true);
              }}
              onDelete={handleDeleteEmployee}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <EmployeeTable
            employees={filteredEmployees}
            onView={setSelectedEmployee}
            onEdit={(emp) => {
              setEditingEmployee(emp);
              setIsEditOpen(true);
            }}
            onDelete={handleDeleteEmployee}
          />
        </div>
      )}

      {/* Modal détails employé */}
      {selectedEmployee && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onEdit={(emp) => {
            setSelectedEmployee(null);
            setEditingEmployee(emp);
            setIsEditOpen(true);
          }}
        />
      )}

      {/* Modal ajout employé */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => {
            setShowAddModal(false);
            setFormValues({
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
              startDate: new Date().toISOString().split('T')[0],
              contractType: 'CDI',
              skills: [],
              emergencyContact: { name: '', phone: '', relationship: '' }
            });
            setPhotoFile(null);
            setPhotoPreview(null);
          }}
          onSave={loadEmployees}
          formValues={formValues}
          photoPreview={photoPreview}
          handleInputChange={handleInputChange}
          handleSkillsChange={handleSkillsChange}
          handleEmergencyContactChange={handleEmergencyContactChange}
          handlePhotoChange={handlePhotoChange}
          handleSubmit={handleSubmit}
        />
      )}

      {/* Modal édition employé */}
      <EmployeeEditModal
        employee={editingEmployee}
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingEmployee(null);
        }}
        onSave={async (updated) => {
          try {
            const response = await api.put(`/employees/${updated.id}`, updated);
            
            // Transformer la réponse serveur
            const formattedEmployee = {
              id: response.id,
              firstName: response.first_name || response.firstName,
              lastName: response.last_name || response.lastName,
              photo: response.photo,
              position: response.position,
              department: response.department,
              email: response.email,
              phone: response.phone,
              facebook: response.facebook,
              linkedin: response.linkedin,
              location: response.location,
              salary: response.salary,
              startDate: response.start_date || response.startDate,
              contractType: response.contract_type || response.contractType,
              status: response.status,
              skills: typeof response.skills === 'string' ? JSON.parse(response.skills) : response.skills || [],
              projects: typeof response.projects === 'string' ? JSON.parse(response.projects) : response.projects || [],
              emergencyContact: typeof response.emergency_contact === 'string' 
                ? JSON.parse(response.emergency_contact) 
                : response.emergencyContact || {},
            };
            
            setEmployees(prev => prev.map(e => e.id === updated.id ? formattedEmployee : e));
            
            setIsEditOpen(false);
            setEditingEmployee(null);
            toast.success('✅ Employé mis à jour');
          } catch (error) {
            console.error('Erreur mise à jour employé:', error);
            toast.error('❌ Erreur lors de la mise à jour');
          }
        }}
        projects={projects}
      />
    </div>
  );
};

/**
 * Composant Carte Statistique
 */
const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
      <div className={`${color} p-3 rounded-lg text-white`}>
        {icon}
      </div>
    </div>
  </div>
);

/**
 * Composant Carte Employé (Vue Grille)
 */
const EmployeeCard = ({ employee, onView, onEdit, onDelete }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'status-actif';
      case 'inactive': return 'status-inactive';
      case 'leave': return 'status-conge';
      default: return 'status-actif';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return '✓ Actif';
      case 'inactive': return '⏸ Inactif';
      case 'leave': return '🏖 En congé';
      default: return status;
    }
  };

  return (
    <div className="employee-card">
      {/* Header avec photo */}
<div className="employee-card-header">
  <img 
    src={employee.photo ? `http://localhost:5002${employee.photo}` : '/default-avatar.png'} 
    alt={`${employee.firstName} ${employee.lastName}`}
    className="employee-photo"
    onError={(e) => {
      // ✅ FIX: Vérifier si on n'a pas déjà mis le fallback
      if (e.target.src !== `${window.location.origin}/default-avatar.png`) {
        e.target.onerror = null; // Désactiver pour éviter la boucle
        e.target.src = '/default-avatar.png';
      }
    }}
  />
  <div className={`employee-status ${getStatusColor(employee.status)}`}>
    {getStatusLabel(employee.status)}
  </div>
</div>


      {/* Body */}
      <div className="employee-card-body">
        <h3 className="employee-name">
          {employee.firstName} {employee.lastName}
        </h3>
        <p className="employee-position">{employee.position}</p>

        {/* Infos */}
        <div className="employee-info">
          <div className="employee-info-item">
            <Briefcase className="w-4 h-4" />
            <span>{employee.department}</span>
          </div>
          <div className="employee-info-item">
            <MapPin className="w-4 h-4" />
            <span>{employee.location}</span>
          </div>
          <div className="employee-info-item">
            <Calendar className="w-4 h-4" />
            <span>
              Depuis {new Date(employee.startDate).toLocaleDateString('fr-FR', { 
                month: 'short', 
                year: 'numeric' 
              })}
            </span>
          </div>
        </div>

        {/* Compétences */}
        {employee.skills && employee.skills.length > 0 && (
          <div className="employee-skills">
            <div className="skills-list">
              {employee.skills.slice(0, 3).map((skill, idx) => (
                <span key={idx} className="skill-tag">{skill}</span>
              ))}
              {employee.skills.length > 3 && (
                <span className="skill-tag">+{employee.skills.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Contacts */}
        <div className="employee-contacts">
          <a 
            href={`mailto:${employee.email}`} 
            className="contact-btn"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="w-5 h-5" />
          </a>
          <a 
            href={`tel:${employee.phone}`} 
            className="contact-btn"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-5 h-5" />
          </a>
          {employee.facebook && (
            <a 
              href={employee.facebook} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <Facebook className="w-5 h-5" />
            </a>
          )}
          {employee.linkedin && (
            <a 
              href={employee.linkedin} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <Linkedin className="w-5 h-5" />
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="employee-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(employee);
            }}
            className="action-btn"
          >
            <Edit className="w-4 h-4" />
            <span>Modifier</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(employee.id);
            }}
            className="action-btn action-delete"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer</span>
          </button>
        </div>

        {/* Voir profil */}
        <button onClick={() => onView(employee)} className="btn-view-profile">
          <Eye className="w-4 h-4" />
          Voir le profil complet
        </button>
      </div>
    </div>
  );
};


/**
 * Composant Table Employés (Vue Liste)
 */
const EmployeeTable = ({ employees, onView, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Employé
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Poste
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Département
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
  {employees.map(employee => (
    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap"> 
        <div className="flex items-center">
          {employee.photo ? (
            <img
              src={employee.photo}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="w-40 h-40 rounded-full object-cover flex-shrink-0" 

            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div className="ml-3"> 
            <div className="text-sm font-medium text-gray-900">
              {employee.firstName} {employee.lastName}
            </div>
            <div className="text-xs text-gray-500">{employee.location}</div> 
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap"> 
        <div className="text-sm text-gray-900">{employee.position}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
          {employee.department}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm text-gray-900">{employee.phone}</div>
        <div className="text-xs text-gray-500">{employee.email}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
          employee.status === 'active' ? 'bg-green-100 text-green-800' :
          employee.status === 'leave' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {employee.status === 'active' ? 'Actif' : 
           employee.status === 'leave' ? 'Congé' : 'Inactif'}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onView(employee)}
          className="text-blue-600 hover:text-blue-900 mr-2 transition-colors"
          title="Voir les détails"
        >
          <Eye className="w-4 h-4 inline" />
        </button>
        <button
          onClick={() => onEdit(employee)}
          className="text-gray-600 hover:text-gray-900 mr-2 transition-colors"
          title="Modifier"
        >
          <Edit className="w-4 h-4 inline" />
        </button>
        <button
          onClick={() => onDelete(employee.id)}
          className="text-red-600 hover:text-red-900 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4 inline" />
        </button>
      </td>
    </tr>
  ))}
</tbody>
      </table>
    </div>
  );
};

/**
 * Modal Détails Employé
 */
const EmployeeDetailsModal = ({ employee, onClose, onEdit }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* En-tête avec photo */}
        <div className="relative h-48 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-16 left-8">
            {employee.photo ? (
              <img
                src={employee.photo}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-xl"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center shadow-xl">
                <User className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="pt-20 px-8 pb-8">
          {/* Nom et titre */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-1">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-lg text-gray-600 mb-2">{employee.position}</p>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                employee.status === 'active' ? 'bg-green-100 text-green-800' :
                employee.status === 'leave' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {employee.status === 'active' ? 'Actif' : employee.status === 'leave' ? 'En congé' : 'Inactif'}
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {employee.contractType}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Informations générales</h3>
              
              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Département</p>
                  <p className="text-gray-800 font-medium">{employee.department}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Localisation</p>
                  <p className="text-gray-800 font-medium">{employee.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Date d'embauche</p>
                  <p className="text-gray-800 font-medium">
                    {new Date(employee.startDate).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Salaire mensuel</p>
                  <p className="text-gray-800 font-medium">
                    {employee.salary.toLocaleString('fr-FR')} Ar
                  </p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact</h3>
              
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a href={`mailto:${employee.email}`} className="text-blue-600 hover:underline font-medium">
                    {employee.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Téléphone</p>
                  <a href={`tel:${employee.phone}`} className="text-blue-600 hover:underline font-medium">
                    {employee.phone}
                  </a>
                </div>
              </div>

              {employee.facebook && (
                <div className="flex items-start gap-3">
                  <Facebook className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Facebook</p>
                    <a href={employee.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                      Voir le profil
                    </a>
                  </div>
                </div>
              )}

              {employee.linkedin && (
                <div className="flex items-start gap-3">
                  <Linkedin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">LinkedIn</p>
                    <a href={employee.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                      Voir le profil
                    </a>
                  </div>
                </div>
              )}

              {/* Contact d'urgence */}
              {employee.emergencyContact && employee.emergencyContact.name && (
                <div className="mt-6 p-4 bg-red-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Contact d'urgence</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-700">
                      <strong>{employee.emergencyContact.name}</strong> 
                      {employee.emergencyContact.relationship && ` (${employee.emergencyContact.relationship})`}
                    </p>
                    <p className="text-sm text-gray-600">{employee.emergencyContact.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compétences */}
          {employee.skills && employee.skills.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Compétences</h3>
              <div className="flex flex-wrap gap-2">
                {employee.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Projets assignés */}
          {employee.projects && employee.projects.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Projets assignés</h3>
              <div className="space-y-2">
                {employee.projects.map((project, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">{project}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            <button
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
              onClick={() => onEdit && onEdit(employee)}
            >
              <Edit className="w-4 h-4 inline mr-2" />
              Modifier
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4 inline mr-2" />
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Modal Ajout Employé
 */
const AddEmployeeModal = ({ 
  onClose, 
  onSave, 
  formValues, 
  photoPreview, 
  handleInputChange, 
  handleSkillsChange, 
  handleEmergencyContactChange, 
  handlePhotoChange, 
  handleSubmit 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Ajouter un employé</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo de profil */}
          <div className="flex justify-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 cursor-pointer hover:bg-blue-600 transition-colors">
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

          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formValues.firstName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formValues.lastName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poste <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="position"
                value={formValues.position}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Département <span className="text-red-500">*</span>
              </label>
              <select
                name="department"
                value={formValues.department}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner...</option>
                <option value="IT">IT</option>
                <option value="Management">Management</option>
                <option value="Opérations">Opérations</option>
                <option value="Finance">Finance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formValues.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                name="phone"
                value={formValues.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <input
                type="url"
                name="facebook"
                value={formValues.facebook}
                onChange={handleInputChange}
                placeholder="https://facebook.com/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              <input
                type="url"
                name="linkedin"
                value={formValues.linkedin}
                onChange={handleInputChange}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localisation</label>
              <input
                type="text"
                name="location"
                value={formValues.location}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire (Ar)</label>
              <input
                type="number"
                name="salary"
                value={formValues.salary}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'embauche <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formValues.startDate}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
              <select
                name="contractType"
                value={formValues.contractType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>
          </div>

          {/* Compétences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compétences (séparées par des virgules)
            </label>
            <input
              type="text"
              value={formValues.skills.join(', ')}
              onChange={(e) => handleSkillsChange(e.target.value)}
              placeholder="React, Node.js, TypeScript..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Contact d'urgence */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Contact d'urgence</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={formValues.emergencyContact.name}
                  onChange={(e) => handleEmergencyContactChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formValues.emergencyContact.phone}
                  onChange={(e) => handleEmergencyContactChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                <input
                  type="text"
                  value={formValues.emergencyContact.relationship}
                  onChange={(e) => handleEmergencyContactChange('relationship', e.target.value)}
                  placeholder="Père, Mère, Conjoint..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Ajouter l'employé
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HumanResourcesPage;
