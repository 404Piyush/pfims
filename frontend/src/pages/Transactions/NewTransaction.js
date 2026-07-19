import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { createTransaction } from '../../store/slices/transactionSlice';
import { fetchCategories } from '../../store/slices/categorySlice';
import TransactionForm from '../../components/Forms/TransactionForm';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const NewTransaction = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.transactions);
  const { categories, loading: categoriesLoading } = useSelector((state) => state.categories);

  useEffect(() => {
    // Load categories if not already loaded
    if (categories.length === 0) {
      dispatch(fetchCategories());
    }
  }, [dispatch, categories.length]);

  const handleSubmit = async (formData) => {
    try {
      const result = await dispatch(createTransaction(formData));
      if (createTransaction.fulfilled.match(result)) {
        toast.success('Transaction created successfully!');
        navigate('/transactions');
      } else {
        // Ensure we display a string message, not an object
        const errorMessage = typeof result.payload === 'string' 
          ? result.payload 
          : result.payload?.message || 'Failed to create transaction';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('An error occurred while creating the transaction');
    }
  };

  const handleCancel = () => {
    navigate('/transactions');
  };

  if (categoriesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleCancel}
          className="p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Add New Transaction</h1>
          <p className="text-secondary-600">Create a new financial transaction</p>
        </div>
      </div>

      {/* Form Container */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <TransactionForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={loading}
        />
      </div>
    </div>
  );
};

export default NewTransaction;