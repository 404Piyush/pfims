import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { fetchCategories, deleteCategory } from '../../store/slices/categorySlice';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import Modal from '../../components/UI/Modal';
import CategoryForm from '../../components/Forms/CategoryForm';
import ConfirmationDialog from '../../components/UI/ConfirmationDialog';

const Categories = () => {
  const dispatch = useDispatch();
  const { categories, loading, error } = useSelector((state) => state.categories);
  
  // State for modals and forms
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Load categories on component mount
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Filter categories based on search and type
  const filteredCategories = Array.isArray(categories) ? categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || category.type === typeFilter;
    return matchesSearch && matchesType;
  }) : [];

  // Group categories by type
  const groupedCategories = filteredCategories.reduce((acc, category) => {
    if (!acc[category.type]) {
      acc[category.type] = [];
    }
    acc[category.type].push(category);
    return acc;
  }, {});

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setShowCategoryModal(true);
  };

  const handleDelete = (category) => {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedCategory) {
      await dispatch(deleteCategory(selectedCategory._id));
      setShowDeleteDialog(false);
      setSelectedCategory(null);
    }
  };

  const getCategoryIcon = (type) => {
    return type === 'income' ? (
      <ArrowTrendingUpIcon className="h-5 w-5 text-success-600" />
    ) : (
      <ArrowTrendingDownIcon className="h-5 w-5 text-danger-600" />
    );
  };

  const getCategoryTypeColor = (type) => {
    return type === 'income' 
      ? 'bg-success-100 text-success-800 border-success-200' 
      : 'bg-danger-100 text-danger-800 border-danger-200';
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      yellow: 'bg-yellow-500',
      purple: 'bg-purple-500',
      pink: 'bg-pink-500',
      indigo: 'bg-indigo-500',
      orange: 'bg-orange-500',
      teal: 'bg-teal-500',
      cyan: 'bg-cyan-500',
    };
    return colorMap[color] || 'bg-gray-500';
  };

  if (loading && categories.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Categories</h1>
          <p className="text-secondary-600">Organize your transactions with custom categories</p>
        </div>
        <button
          onClick={() => {
            setSelectedCategory(null);
            setShowCategoryModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-8">
        {Object.entries(groupedCategories).map(([type, categoryList]) => (
          <div key={type} className="space-y-4">
            <div className="flex items-center space-x-3">
              {getCategoryIcon(type)}
              <h2 className="text-xl font-semibold text-secondary-900 capitalize">
                {type} Categories
              </h2>
              <span className="text-sm text-secondary-500">
                ({categoryList.length})
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryList.map((category) => (
                <div
                  key={category._id}
                  className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg ${getColorClasses(category.color)} flex items-center justify-center`}>
                        <TagIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-secondary-900">
                          {category.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCategoryTypeColor(category.type)}`}>
                          {category.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-primary-600 hover:text-primary-700 p-1"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        className="text-danger-600 hover:text-danger-700 p-1"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {category.description && (
                    <p className="text-sm text-secondary-600 mb-4">
                      {category.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-1 text-secondary-500">
                      <ChartBarIcon className="h-4 w-4" />
                      <span>{category.transactionCount || 0} transactions</span>
                    </div>
                    {category.budget && category.budget.monthly > 0 && (
                      <div className="text-primary-600 font-medium">
                        Budget: ₹{category.budget.monthly.toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  {category.isDefault && (
                    <div className="mt-3 pt-3 border-t border-secondary-100">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                        Default Category
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCategories.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-12 text-center">
          <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
            <TagIcon className="h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            {searchTerm || typeFilter !== 'all' ? 'No categories found' : 'No categories yet'}
          </h3>
          <p className="text-secondary-600 mb-6">
            {searchTerm || typeFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Create your first category to start organizing your transactions.'
            }
          </p>
          {(!searchTerm && typeFilter === 'all') && (
            <button
              onClick={() => {
                setSelectedCategory(null);
                setShowCategoryModal(true);
              }}
              className="btn-primary"
            >
              Add Category
            </button>
          )}
        </div>
      )}

      {/* Statistics */}
      {categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Category Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary-900">
                {categories.length}
              </div>
              <div className="text-sm text-secondary-600">Total Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">
                {Array.isArray(categories) ? categories.filter(c => c.type === 'income').length : 0}
              </div>
              <div className="text-sm text-secondary-600">Income Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-danger-600">
                {Array.isArray(categories) ? categories.filter(c => c.type === 'expense').length : 0}
              </div>
              <div className="text-sm text-secondary-600">Expense Categories</div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setSelectedCategory(null);
        }}
        title={selectedCategory ? 'Edit Category' : 'Add Category'}
      >
        <CategoryForm
          category={selectedCategory}
          onSuccess={() => {
            setShowCategoryModal(false);
            setSelectedCategory(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${selectedCategory?.name}"? This action cannot be undone and will affect all associated transactions.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={loading}
      />
    </div>
  );
};

export default Categories;