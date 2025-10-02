import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  CurrencyDollarIcon, 
  CalendarIcon, 
  TagIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const BudgetForm = ({ 
  budget = null, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}) => {
  const { categories } = useSelector((state) => state.categories);
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    description: '',
    alertThreshold: 80
  });

  const [errors, setErrors] = useState({});

  // Calculate end date based on period and start date
  const calculateEndDate = (startDate, period) => {
    const start = new Date(startDate);
    let end = new Date(start);

    switch (period) {
      case 'weekly':
        end.setDate(start.getDate() + 6);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        end.setDate(start.getDate() - 1);
        break;
      case 'quarterly':
        end.setMonth(start.getMonth() + 3);
        end.setDate(start.getDate() - 1);
        break;
      case 'yearly':
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(start.getDate() - 1);
        break;
      default:
        break;
    }

    return end.toISOString().split('T')[0];
  };

  // Populate form when editing
  useEffect(() => {
    if (budget) {
      const startDate = budget.startDate ? new Date(budget.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const endDate = budget.endDate ? new Date(budget.endDate).toISOString().split('T')[0] : calculateEndDate(startDate, budget.period || 'monthly');
      
      setFormData({
        name: budget.name || '',
        amount: budget.amount?.toString() || '',
        category: budget.category?._id || budget.category || '',
        period: budget.period || 'monthly',
        startDate,
        endDate,
        description: budget.description || '',
        alertThreshold: budget.alertThreshold || 80
      });
    }
  }, [budget]);

  // Update end date when start date or period changes
  useEffect(() => {
    if (formData.startDate && formData.period) {
      const newEndDate = calculateEndDate(formData.startDate, formData.period);
      setFormData(prev => ({
        ...prev,
        endDate: newEndDate
      }));
    }
  }, [formData.startDate, formData.period]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Budget name is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (formData.alertThreshold < 0 || formData.alertThreshold > 100) {
      newErrors.alertThreshold = 'Alert threshold must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      amount: parseFloat(formData.amount),
      alertThreshold: parseInt(formData.alertThreshold)
    };

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

  const periodOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Budget Name */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Budget Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DocumentTextIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`input pl-10 ${errors.name ? 'border-red-500' : ''}`}
            placeholder="Enter budget name"
          />
        </div>
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Budget Amount
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CurrencyDollarIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
            className={`input pl-10 ${errors.amount ? 'border-red-500' : ''}`}
            placeholder="0.00"
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Category
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <TagIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <select
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
            className={`input pl-10 ${errors.category ? 'border-red-500' : ''}`}
          >
            <option value="">Select a category</option>
            {categories?.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name} ({category.type})
              </option>
            ))}
          </select>
        </div>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category}</p>
        )}
      </div>

      {/* Budget Period */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Budget Period
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {periodOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleChange('period', value)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                formData.period === value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-secondary-200 hover:border-secondary-300'
              }`}
            >
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            Start Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-secondary-400" />
            </div>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className={`input pl-10 ${errors.startDate ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            End Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-secondary-400" />
            </div>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className={`input pl-10 ${errors.endDate ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Alert Threshold */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Alert Threshold ({formData.alertThreshold}%)
        </label>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={formData.alertThreshold}
            onChange={(e) => handleChange('alertThreshold', e.target.value)}
            className="w-full h-2 bg-secondary-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-secondary-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-secondary-600">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>You'll be alerted when spending reaches {formData.alertThreshold}% of this budget</span>
          </div>
        </div>
        {errors.alertThreshold && (
          <p className="mt-1 text-sm text-red-600">{errors.alertThreshold}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Description (Optional)
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="input"
          placeholder="Add any additional notes about this budget..."
        />
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
            <span>{budget ? 'Update Budget' : 'Create Budget'}</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default BudgetForm;