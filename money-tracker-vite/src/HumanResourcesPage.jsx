// src/HumanResourcesPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Facebook, Linkedin, MapPin, Calendar,
  Briefcase, DollarSign, Award, Edit, Trash2, Plus, Search,
  Filter, Upload, Download, Eye, Clock, CheckCircle
} from 'lucide-react';

const HumanResourcesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock data - à remplacer par vos données réelles
  const mockEmployees = [
    {
      id: 1,
      firstName: 'Jean',
      lastName: 'Rakoto',
      photo: null, // '/avatars/jean.jpg',
      position: 'Développeur Full-Stack',
      department: 'IT',
      email: 'jean.rakoto@company.mg',
      phone: '+261 34 12 345 67',
      facebook: 'https://facebook.com/jrakoto',
      linkedin: 'https://linkedin.com/in/jrakoto',
      location: 'Antananarivo',
      salary: 2500000, // Ar
      startDate: '2024-01-15',
      status: 'active', // active, inactive, leave
      skills: ['React', 'Node.js', 'PostgreSQL'],
      projects: ['Money Tracker', 'NATIORA'],
      contractType: 'CDI',
      emergencyContact: {
        name: 'Marie Rakoto',
        phone: '+261 34 98 765 43',
        relation: 'Épouse'
      }
    },
    {
      id: 2,
      firstName: 'Nadia',
      lastName: 'Andria',
      photo: null,
      position: 'Chef de Projet',
      department: 'Management',
      email: 'nadia.andria@company.mg',
      phone: '+261 33 22 334 45',
      facebook: 'https://facebook.com/nandria',
      linkedin: 'https://linkedin.com/in/nandria',
      location: 'Antananarivo',
      salary: 3000000,
      startDate: '2023-06-01',
      status: 'active',
      skills: ['Gestion de projet', 'Leadership', 'Agile'],
      projects: ['NEMO EXPORT'],
      contractType: 'CDI',
      emergencyContact: {
        name: 'Paul Andria',
        phone: '+261 33 55 667 78',
        relation: 'Frère'
      }
    },
    {
      id: 3,
      firstName: 'Rivo',
      lastName: 'Rajaona',
      photo: null,
      position: 'Éleveur',
      department: 'Opérations',
      email: 'rivo.rajaona@company.mg',
      phone: '+261 32 44 556 67',
      facebook: null,
      linkedin: null,
      location: 'Bypass',
      salary: 1200000,
      startDate: '2024-03-01',
      status: 'active',
      skills: ['Élevage', 'Soins animaux', 'Agriculture'],
      projects: ['Natiora - Élevage mixte'],
      contractType: 'CDD',
      emergencyContact: {
        name: 'Soa Rajaona',
        phone: '+261 32 77 889 90',
        relation: 'Mère'
      }
    }
  ];

  useEffect(() => {
    // Charger les employés depuis votre API
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEmployees = async () => {
    try {
      // Simulation appel API
      // const response = await fetch(`${API_URL}/employees`);
      // const data = await response.json();
      // setEmployees(data);
      
      setEmployees(mockEmployees);
    } catch (error) {
      console.error('Erreur chargement employés:', error);
    }
  };

  // Filtrer les employés
  const filteredEmployees = employees.filter(emp => {
    const matchSearch = 
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchDepartment = 
      filterDepartment === 'all' || emp.department === filterDepartment;
    
    return matchSearch && matchDepartment;
  });

  // Statistiques RH
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'leave').length,
    totalSalary: employees.reduce((sum, e) => sum + e.salary, 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          👥 Ressources Humaines
        </h1>
        <p className="text-gray-600">Gestion de l'équipe et des collaborateurs</p>
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
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
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
              className={`px-4 py-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
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
          {filteredEmployees.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onView={() => setSelectedEmployee(employee)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <EmployeeTable
            employees={filteredEmployees}
            onView={setSelectedEmployee}
          />
        </div>
      )}

      {/* Modal détails employé */}
      {selectedEmployee && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {/* Modal ajout employé */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSave={loadEmployees}
        />
      )}
    </div>
  );
};

// Composant Carte Statistique
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

// Composant Carte Employé (Vue Grille)
const EmployeeCard = ({ employee, onView }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'leave': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'inactive': return 'Inactif';
      case 'leave': return 'En congé';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden group">
      {/* En-tête avec photo */}
      <div className="relative h-32 bg-gradient-to-r from-blue-400 to-purple-500">
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
          <div className="relative">
            {employee.photo ? (
              <img
                src={employee.photo}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-24 h-24 rounded-full border-4 border-white object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white ${
              employee.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="pt-14 px-6 pb-6">
        {/* Nom et statut */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 mb-1">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{employee.position}</p>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
            {getStatusLabel(employee.status)}
          </span>
        </div>

        {/* Informations */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Briefcase className="w-4 h-4" />
            <span>{employee.department}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4" />
            <span>{employee.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Depuis {new Date(employee.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Compétences */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {employee.skills.slice(0, 3).map((skill, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs">
                {skill}
              </span>
            ))}
            {employee.skills.length > 3 && (
              <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-md text-xs">
                +{employee.skills.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Contacts sociaux */}
        <div className="flex items-center justify-center gap-3 mb-4 pt-4 border-t border-gray-100">
          <a href={`mailto:${employee.email}`} className="text-gray-400 hover:text-blue-500 transition-colors">
            <Mail className="w-5 h-5" />
          </a>
          <a href={`tel:${employee.phone}`} className="text-gray-400 hover:text-green-500 transition-colors">
            <Phone className="w-5 h-5" />
          </a>
          {employee.facebook && (
            <a href={employee.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
              <Facebook className="w-5 h-5" />
            </a>
          )}
          {employee.linkedin && (
            <a href={employee.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-700 transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
          )}
        </div>

        {/* Bouton Voir détails */}
        <button
          onClick={() => onView(employee)}
          className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all opacity-0 group-hover:opacity-100"
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Voir le profil
        </button>
      </div>
    </div>
  );
};

// Composant Table Employés (Vue Liste)
const EmployeeTable = ({ employees, onView }) => {
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
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {employee.photo ? (
                    <img
                      src={employee.photo}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{employee.location}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{employee.position}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {employee.department}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{employee.phone}</div>
                <div className="text-sm text-gray-500">{employee.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  employee.status === 'active' ? 'bg-green-100 text-green-800' :
                  employee.status === 'leave' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {employee.status === 'active' ? 'Actif' : employee.status === 'leave' ? 'Congé' : 'Inactif'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onView(employee)}
                  className="text-blue-600 hover:text-blue-900 mr-3"
                >
                  <Eye className="w-4 h-4 inline" />
                </button>
                <button className="text-gray-600 hover:text-gray-900 mr-3">
                  <Edit className="w-4 h-4 inline" />
                </button>
                <button className="text-red-600 hover:text-red-900">
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

// Modal Détails Employé
const EmployeeDetailsModal = ({ employee, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* En-tête avec photo */}
        <div className="relative h-48 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            ✕
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
              <div className="mt-6 p-4 bg-red-50 rounded-lg">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Contact d'urgence</h4>
                <div className="space-y-1">
                  <p className="text-sm text-gray-700">
                    <strong>{employee.emergencyContact.name}</strong> ({employee.emergencyContact.relation})
                  </p>
                  <p className="text-sm text-gray-600">{employee.emergencyContact.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Compétences */}
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

          {/* Projets assignés */}
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

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            <button className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all">
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

// Modal Ajout Employé
const AddEmployeeModal = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    photo: null,
    position: '',
    department: 'IT',
    email: '',
    phone: '',
    facebook: '',
    linkedin: '',
    location: 'Antananarivo',
    salary: '',
    startDate: new Date().toISOString().split('T')[0],
    contractType: 'CDI',
    skills: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  });

  const [photoPreview, setPhotoPreview] = useState(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Préparer les données
    const employeeData = {
      ...formData,
      skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
      salary: parseFloat(formData.salary),
      status: 'active',
      emergencyContact: {
        name: formData.emergencyContactName,
        phone: formData.emergencyContactPhone,
        relation: formData.emergencyContactRelation
      }
    };

    try {
      // Envoyer à votre API
      // const response = await fetch(`${API_URL}/employees`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(employeeData)
      // });
      
      console.log('Nouvel employé:', employeeData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Erreur ajout employé:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Ajouter un employé</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo de profil */}
          <div className="flex justify-center">
            <div className="relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-16 h-16 text-gray-400" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 cursor-pointer hover:bg-blue-600 transition-colors">
                <Upload className="w-4 h-4" />
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Informations personnelles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poste *</label>
              <input
                type="text"
                required
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
              <select
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="IT">IT</option>
                <option value="Management">Management</option>
                <option value="Opérations">Opérations</option>
                <option value="Finance">Finance</option>
                <option value="RH">RH</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+261 34 12 345 67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <input
                type="url"
                value={formData.facebook}
                onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                placeholder="https://facebook.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              <input
                type="url"
                value={formData.linkedin}
                onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localisation *</label>
              <input
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire mensuel (Ar) *</label>
              <input
                type="number"
                required
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'embauche *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat *</label>
              <select
                required
                value={formData.contractType}
                onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Compétences (séparées par des virgules)</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="React, Node.js, PostgreSQL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Contact d'urgence - CORRECTION DE LA SYNTAXE ICI */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Contact d'urgence</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="+261 34 12 345 67"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relation *</label>
                <select
                  required
                  value={formData.emergencyContactRelation}
                  onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner...</option>
                  <option value="Époux/Épouse">Époux/Épouse</option>
                  <option value="Père">Père</option>
                  <option value="Mère">Mère</option>
                  <option value="Frère">Frère</option>
                  <option value="Sœur">Sœur</option>
                  <option value="Enfant">Enfant</option>
                  <option value="Ami(e)">Ami(e)</option>
                  <option value="Autre">Autre</option>
                </select>
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