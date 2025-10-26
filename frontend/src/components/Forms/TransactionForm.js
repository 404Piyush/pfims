import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  CurrencyDollarIcon, 
  CalendarIcon, 
  TagIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const TransactionForm = ({ 
  transaction = null, 
  onSubmit, 
  onCancel, 
  isLoading = false 
}) => {
  const { categories } = useSelector((state) => state.categories);
  
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    title: '',
    description: '',
    category: '',
    account: 'Cash', // Default account
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [errors, setErrors] = useState({});

  // Populate form when editing
  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type || 'expense',
        amount: transaction.amount?.toString() || '',
        title: transaction.title || '',
        description: transaction.description || '',
        category: transaction.category?._id || transaction.category || '',
        account: transaction.account || 'Cash',
        date: transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: transaction.notes || ''
      });
    }
  }, [transaction]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.account.trim()) {
      newErrors.account = 'Account is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      // Validate that date is not in the future
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today
      
      if (selectedDate > today) {
        newErrors.date = 'Transaction date cannot be in the future';
      }
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
      amount: parseFloat(formData.amount)
    };

    // Safety check for onSubmit function
    if (typeof onSubmit === 'function') {
      onSubmit(submitData);
    } else {
      console.error('onSubmit is not a function:', onSubmit);
    }
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
      {/* Transaction Type */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Transaction Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleChange('type', 'income')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              formData.type === 'income'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-secondary-200 hover:border-secondary-300'
            }`}
          >
            <span className="font-medium">Income</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange('type', 'expense')}
            className={`p-3 rounded-lg border-2 transition-colors ${
              formData.type === 'expense'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-secondary-200 hover:border-secondary-300'
            }`}
          >
            <span className="font-medium">Expense</span>
          </button>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Amount
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

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Title
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DocumentTextIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className={`input pl-10 ${errors.title ? 'border-red-500' : ''}`}
            placeholder="Enter transaction title"
          />
        </div>
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title}</p>
        )}
      </div>

      {/* Account */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Account
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CurrencyDollarIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            value={formData.account}
            onChange={(e) => handleChange('account', e.target.value)}
            className={`input pl-10 ${errors.account ? 'border-red-500' : ''}`}
            placeholder="Enter account name"
          />
        </div>
        {errors.account && (
          <p className="mt-1 text-sm text-red-600">{errors.account}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Description (Optional)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DocumentTextIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className={`input pl-10 ${errors.description ? 'border-red-500' : ''}`}
            placeholder="Enter transaction description"
          />
        </div>
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description}</p>
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
            {Array.isArray(categories) && categories
              ?.filter(cat => cat.type === formData.type)
              ?.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category}</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Date
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarIcon className="h-5 w-5 text-secondary-400" />
          </div>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            className={`input pl-10 ${errors.date ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.date && (
          <p className="mt-1 text-sm text-red-600">{errors.date}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="input"
          placeholder="Add any additional notes..."
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
            <span>{transaction ? 'Update Transaction' : 'Add Transaction'}</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;