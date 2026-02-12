import React, { useState, useEffect } from 'react';
import { 
  TagIcon, 
  SwatchIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const CategoryForm = ({ 
  category = null, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    color: '#3B82F6',
    description: ''
  });

  const [errors, setErrors] = useState({});

  // Predefined color options
  const colorOptions = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#14B8A6', // Teal
    '#F43F5E'  // Rose
  ];

  // Populate form when editing
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        type: category.type || 'expense',
        color: category.color || '#3B82F6',
        description: category.description || ''
      });
    }
  }, [category]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Enter a category name (e.g., Groceries, Rent)';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
    }

    if (!formData.type) {
      newErrors.type = 'Select whether this category is Income or Expense';
    }

    if (!formData.color) {
      newErrors.color = 'Pick a color to make this category easy to spot';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // For default categories, exclude name and type from updates
    const submitData = { ...formData };
    if (category?.isDefault) {
      delete submitData.name;
      delete submitData.type;
    }

    onSubmit(submitData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category Name */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Category Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <TagIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`input pl-10 ${errors.name ? 'border-red-500' : ''} ${category?.isDefault ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            placeholder="Enter category name"
            disabled={category?.isDefault}
          />
        </div>
        {category?.isDefault && (
          <p className="mt-1 text-sm text-gray-500">Default category names cannot be changed</p>
        )}
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Category Type */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Category Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'income', label: 'Income', color: 'green' },
            { value: 'expense', label: 'Expense', color: 'red' }
          ].map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => !category?.isDefault && handleChange('type', value)}
              disabled={category?.isDefault}
              className={`p-3 rounded-lg border-2 transition-colors ${
                formData.type === value
                  ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                  : 'border-secondary-200 hover:border-secondary-300'
              } ${category?.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
        {category?.isDefault && (
          <p className="mt-1 text-sm text-gray-500">Default category types cannot be changed</p>
        )}
        {errors.type && (
          <p className="mt-1 text-sm text-red-600">{errors.type}</p>
        )}
      </div>

      {/* Color Selection */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Color
        </label>
        <div className="space-y-3">
          {/* Color Preview */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SwatchIcon className="h-5 w-5 text-secondary-400" />
              </div>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className={`input pl-10 pr-16 ${errors.color ? 'border-red-500' : ''}`}
                placeholder="#3B82F6"
              />
              <div 
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <div 
                  className="w-8 h-8 rounded-lg border-2 border-white shadow-sm"
                  style={{ backgroundColor: formData.color }}
                />
              </div>
            </div>
          </div>

          {/* Color Options */}
          <div className="grid grid-cols-6 gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange('color', color)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  formData.color === color
                    ? 'border-secondary-400 scale-110'
                    : 'border-secondary-200 hover:border-secondary-300'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
        {errors.color && (
          <p className="mt-1 text-sm text-red-600">{errors.color}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Description (Optional)
        </label>
        <div className="relative">
          <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
            <DocumentTextIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            className="input pl-10"
            placeholder="Add a description for this category..."
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-secondary-200">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </div>
          ) : (
            <span>{category ? 'Update Category' : 'Add Category'}</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default CategoryForm;
