// src/HumanResourcesPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  User,
  Mail,
  Phone,
  Facebook,
  Linkedin,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  Award,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  Clock,
  CheckCircle,
  X,
  Users,
} from 'lucide-react';
import { EmployeeEditModal } from './components/hr/EmployeeEditModal';
import { API_BASE, api } from './services/api';

const HumanResourcesPage = ({ projects = [] }) => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

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
    emergencyContact: { name: '', phone: '', relationship: '' },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      const formattedEmployees = response.map((emp) => ({
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
        startDate:
          emp.start_date || emp.startDate || new Date().toISOString().split('T')[0],
        contractType: emp.contract_type || emp.contractType || 'CDI',
        status: emp.status || 'active',
        skills:
          typeof emp.skills === 'string'
            ? JSON.parse(emp.skills || '[]')
            : emp.skills || [],
        projects:
          typeof emp.projects === 'string'
            ? JSON.parse(emp.projects || '[]')
            : emp.projects || [],
        emergencyContact:
          typeof emp.emergency_contact === 'string'
            ? JSON.parse(emp.emergency_contact || '{}')
            : emp.emergencyContact || emp.emergency_contact || {},
        createdAt: emp.created_at || emp.createdAt,
        updatedAt: emp.updated_at || emp.updatedAt,
      }));

      setEmployees(formattedEmployees);
    } catch (error) {
      console.error('❌ Erreur chargement employés:', error);
      toast.error('Erreur lors du chargement des employés');
      setEmployees([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkillsChange = (skillsString) => {
    const skillsArray = skillsString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setFormValues((prev) => ({ ...prev, skills: skillsArray }));
  };

  const handleEmergencyContactChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value },
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
      const formData = new FormData();
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

      // 🔐 Récupérer le token CSRF
      const csrfToken = await fetchCsrfToken();

      const response = await fetch(`${API_BASE}/api/employees`, {
        method: 'POST',
        credentials: 'include', // ✅ envoie les cookies (CSRF)
        headers: {
          ...getAuthHeader(), // ✅ Authorization: Bearer
          'X-CSRF-Token': csrfToken, // ✅ protection CSRF
          // NE PAS définir 'Content-Type' → laissé à FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erreur lors de la création');
      }

      const newEmployee = await response.json();
      setEmployees((prev) => [...prev, newEmployee]);

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
        emergencyContact: { name: '', phone: '', relationship: '' },
      });
      setPhotoFile(null);
      setPhotoPreview(null);
      setShowAddModal(false);

      toast.success('Employé ajouté avec succès');
    } catch (err) {
      console.error('Erreur ajout employé:', err);
      toast.error(err.message || "Erreur lors de l'ajout");
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('⚠️ Voulez-vous vraiment supprimer cet employé ?')) return;

    try {
      await api.delete(`/employees/${id}`); // ✅ Utilise api.delete

      setEmployees((prev) => prev.filter((e) => e.id !== id));
      toast.success('✅ Employé supprimé');
    } catch (err) {
      console.error('Erreur suppression:', err);
      toast.error(`❌ ${err.message || 'Erreur lors de la suppression'}`);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const firstName = emp.firstName || '';
      const lastName = emp.lastName || '';
      const position = emp.position || '';
      const department = emp.department || '';

      const matchesSearch =
        !searchTerm ||
        firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        position.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment =
        !selectedDepartment ||
        selectedDepartment === 'all' ||
        department === selectedDepartment;

      const matchesStatus = !selectedStatus || emp.status === selectedStatus;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchTerm, selectedDepartment, selectedStatus]);

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === 'active').length,
    onLeave: employees.filter((e) => e.status === 'leave').length,
    totalSalary: employees.reduce((sum, e) => sum + (e.salary || 0), 0),
  };

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header avec dégradé premium - Style ReceivablesScreen */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg border-2 border-blue-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Users className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Ressources Humaines</h2>
              <p className="text-sm text-white/80 mt-1 font-semibold">
                Gestion complète de l'équipe et des employés
              </p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              MY TEAM
            </p>
          </div>
        </div>
      </div>

      {/* Statistiques RH - Style ReceivablesScreen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6" strokeWidth={2.5} />}
          label="Total Employés"
          value={stats.total}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" strokeWidth={2.5} />}
          label="Actifs"
          value={stats.active}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" strokeWidth={2.5} />}
          label="En congé"
          value={stats.onLeave}
          gradient="from-orange-500 to-amber-600"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" strokeWidth={2.5} />}
          label="Masse Salariale"
          value={`${(stats.totalSalary / 1000000).toFixed(1)}M Ar`}
          gradient="from-purple-500 to-pink-600"
        />
      </div>

      {/* Barre de recherche et filtres - Style ReceivablesScreen */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md border-2 border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="pl-10 pr-8 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all bg-white font-semibold"
            >
              <option value="all">Tous les départements</option>
              <option value="IT">IT</option>
              <option value="Management">Management</option>
              <option value="Opérations">Opérations</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Liste
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-bold text-sm"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
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
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md border-2 border-slate-200 overflow-hidden">
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

      {/* Modals */}
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
              emergencyContact: { name: '', phone: '', relationship: '' },
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

      <EmployeeEditModal
        employee={editingEmployee}
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingEmployee(null);
        }}
        onSave={async (updated) => {
          try {
            console.log('📤 Sending update for employee ID:', updated.id);

            const response = await api.put(`/employees/${updated.id}`, updated);

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
              skills:
                typeof response.skills === 'string'
                  ? JSON.parse(response.skills)
                  : response.skills || [],
              projects:
                typeof response.projects === 'string'
                  ? JSON.parse(response.projects)
                  : response.projects || [],
              emergencyContact:
                typeof response.emergency_contact === 'string'
                  ? JSON.parse(response.emergency_contact)
                  : response.emergencyContact || {},
            };

            setEmployees((prev) =>
              prev.map((e) => (e.id === updated.id ? formattedEmployee : e))
            );

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

/* ==================== COMPOSANTS STYLISÉS ==================== */

const StatCard = ({ icon, label, value, gradient }) => (
  <div
    className={`bg-gradient-to-br ${gradient} rounded-lg shadow-md border-2 border-white/30 p-4`}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className="bg-white/20 p-1.5 rounded">{icon}</div>
      <p className="text-sm font-bold text-white uppercase tracking-wider leading-tight">
        {label}
      </p>
    </div>
    <p className="text-2xl font-black text-white leading-none">{value}</p>
  </div>
);

const EmployeeCard = ({ employee, onView, onEdit, onDelete }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-slate-100 text-slate-800';
      case 'leave':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return '✓ Actif';
      case 'inactive':
        return '⏸ Inactif';
      case 'leave':
        return '🏖 En congé';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-md border-2 border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all overflow-hidden">
      {/* Photo header */}
      <div className="relative h-40 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
        <img
          src={
            employee.photo
              ? `http://localhost:5002${employee.photo}`
              : '/default-avatar.png'
          }
          alt={`${employee.firstName} ${employee.lastName}`}
          className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
          onError={(e) => {
            if (e.target.src !== `${window.location.origin}/default-avatar.png`) {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            }
          }}
        />
        <div
          className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(employee.status)}`}
        >
          {getStatusLabel(employee.status)}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-sm font-bold text-blue-600">{employee.position}</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Briefcase className="w-4 h-4" strokeWidth={2.5} />
            <span className="font-semibold">{employee.department}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4" strokeWidth={2.5} />
            <span className="font-semibold">{employee.location}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-4 h-4" strokeWidth={2.5} />
            <span className="font-semibold">
              Depuis{' '}
              {new Date(employee.startDate).toLocaleDateString('fr-FR', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {employee.skills && employee.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {employee.skills.slice(0, 3).map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold"
              >
                {skill}
              </span>
            ))}
            {employee.skills.length > 3 && (
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                +{employee.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(employee);
            }}
            className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
          >
            <Edit className="w-4 h-4" strokeWidth={2.5} />
            Modifier
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(employee.id);
            }}
            className="flex items-center justify-center h-10 px-4 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm hover:from-red-600 hover:to-rose-700 transition-all shadow-md"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <button
          onClick={() => onView(employee)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
        >
          <Eye className="w-4 h-4" strokeWidth={2.5} />
          Voir le profil complet
        </button>
      </div>
    </div>
  );
};

/* ==================== EMPLOYEE TABLE ==================== */
const EmployeeTable = ({ employees, onView, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Employé
            </th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Poste
            </th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Département
            </th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-blue-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  {employee.photo ? (
                    <img
                      src={employee.photo}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-400" strokeWidth={2.5} />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-semibold">
                      {employee.location}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-bold text-slate-900">
                  {employee.position}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800">
                  {employee.department}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-bold text-slate-900">{employee.phone}</div>
                <div className="text-xs text-slate-500 font-semibold">
                  {employee.email}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                    employee.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : employee.status === 'leave'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {employee.status === 'active'
                    ? '✓ Actif'
                    : employee.status === 'leave'
                      ? '🏖 Congé'
                      : '⏸ Inactif'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex gap-2">
                  <button
                    onClick={() => onView(employee)}
                    className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    title="Voir les détails"
                  >
                    <Eye className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => onEdit(employee)}
                    className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    title="Modifier"
                  >
                    <Edit className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => onDelete(employee.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ==================== EMPLOYEE DETAILS MODAL ==================== */
const EmployeeDetailsModal = ({ employee, onClose, onEdit }) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête avec photo - Style premium */}
        <div className="relative h-48 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <div className="absolute -bottom-16 left-8">
            {employee.photo ? (
              <img
                src={employee.photo}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-xl"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center shadow-xl">
                <User className="w-16 h-16 text-slate-400" strokeWidth={2.5} />
              </div>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="pt-20 px-8 pb-8">
          {/* Nom et titre */}
          <div className="mb-6">
            <h2 className="text-3xl font-black text-slate-900 mb-1">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-lg text-blue-600 font-bold mb-3">{employee.position}</p>
            <div className="flex items-center gap-4">
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  employee.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : employee.status === 'leave'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-slate-100 text-slate-800'
                }`}
              >
                {employee.status === 'active'
                  ? '✓ Actif'
                  : employee.status === 'leave'
                    ? '🏖 En congé'
                    : '⏸ Inactif'}
              </span>
              <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                {employee.contractType}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informations générales */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 mb-3 border-b-2 border-slate-200 pb-2">
                Informations générales
              </h3>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    Département
                  </p>
                  <p className="text-slate-900 font-bold">{employee.department}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    Localisation
                  </p>
                  <p className="text-slate-900 font-bold">{employee.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    Date d'embauche
                  </p>
                  <p className="text-slate-900 font-bold">
                    {new Date(employee.startDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    Salaire mensuel
                  </p>
                  <p className="text-slate-900 font-bold">
                    {employee.salary.toLocaleString('fr-FR')} Ar
                  </p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800 mb-3 border-b-2 border-slate-200 pb-2">
                Contact
              </h3>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Email</p>
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-blue-600 hover:underline font-bold"
                  >
                    {employee.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Téléphone</p>
                  <a
                    href={`tel:${employee.phone}`}
                    className="text-blue-600 hover:underline font-bold"
                  >
                    {employee.phone}
                  </a>
                </div>
              </div>

              {employee.facebook && (
                <div className="flex items-start gap-3">
                  <Facebook className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Facebook</p>
                    <a
                      href={employee.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Voir le profil
                    </a>
                  </div>
                </div>
              )}

              {employee.linkedin && (
                <div className="flex items-start gap-3">
                  <Linkedin className="w-5 h-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">LinkedIn</p>
                    <a
                      href={employee.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Voir le profil
                    </a>
                  </div>
                </div>
              )}

              {/* Contact d'urgence */}
              {employee.emergencyContact && employee.emergencyContact.name && (
                <div className="mt-6 p-4 bg-red-50 rounded-xl border-2 border-red-200">
                  <h4 className="text-sm font-black text-red-800 mb-2 uppercase">
                    Contact d'urgence
                  </h4>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-red-900">
                      <strong>{employee.emergencyContact.name}</strong>
                      {employee.emergencyContact.relationship &&
                        ` (${employee.emergencyContact.relationship})`}
                    </p>
                    <p className="text-sm text-red-700 font-semibold">
                      {employee.emergencyContact.phone}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compétences */}
          {employee.skills && employee.skills.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-black text-slate-800 mb-3 border-b-2 border-slate-200 pb-2">
                Compétences
              </h3>
              <div className="flex flex-wrap gap-2">
                {employee.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Projets assignés */}
          {employee.projects && employee.projects.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-black text-slate-800 mb-3 border-b-2 border-slate-200 pb-2">
                Projets assignés
              </h3>
              <div className="space-y-2">
                {employee.projects.map((project, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg border-2 border-purple-200"
                  >
                    <Award className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
                    <span className="text-sm font-bold text-purple-800">{project}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex gap-3">
            <button
              className="flex-1 flex items-center justify-center gap-2 h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-bold"
              onClick={() => onEdit && onEdit(employee)}
            >
              <Edit className="w-4 h-4" strokeWidth={2.5} />
              Modifier
            </button>
            <button className="flex items-center justify-center gap-2 h-12 px-6 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-bold">
              <Download className="w-4 h-4" strokeWidth={2.5} />
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==================== ADD EMPLOYEE MODAL ==================== */
const AddEmployeeModal = ({
  onClose,
  onSave,
  formValues,
  photoPreview,
  handleInputChange,
  handleSkillsChange,
  handleEmergencyContactChange,
  handlePhotoChange,
  handleSubmit,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-b-2 border-blue-700 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">Ajouter un employé</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
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
                name="firstName"
                value={formValues.firstName}
                onChange={handleInputChange}
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
                name="lastName"
                value={formValues.lastName}
                onChange={handleInputChange}
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
                name="position"
                value={formValues.position}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Département <span className="text-red-500">*</span>
              </label>
              <select
                name="department"
                value={formValues.department}
                onChange={handleInputChange}
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
                name="email"
                value={formValues.email}
                onChange={handleInputChange}
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
                name="phone"
                value={formValues.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Localisation
              </label>
              <input
                type="text"
                name="location"
                value={formValues.location}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Salaire (Ar)
              </label>
              <input
                type="number"
                name="salary"
                value={formValues.salary}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Date d'embauche
              </label>
              <input
                type="date"
                name="startDate"
                value={formValues.startDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                Type de contrat
              </label>
              <select
                name="contractType"
                value={formValues.contractType}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all bg-white font-semibold"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Freelance">Freelance</option>
                <option value="Stage">Stage</option>
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
              value={formValues.skills.join(', ')}
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
                value={formValues.emergencyContact.name}
                onChange={(e) => handleEmergencyContactChange('name', e.target.value)}
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
              <input
                type="tel"
                placeholder="Téléphone"
                value={formValues.emergencyContact.phone}
                onChange={(e) => handleEmergencyContactChange('phone', e.target.value)}
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
              <input
                type="text"
                placeholder="Relation"
                value={formValues.emergencyContact.relationship}
                onChange={(e) =>
                  handleEmergencyContactChange('relationship', e.target.value)
                }
                className="px-4 py-2.5 border-2 border-red-200 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-semibold"
              />
            </div>
          </div>

          {/* Boutons d'action */}
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
              Créer l'employé
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HumanResourcesPage;
