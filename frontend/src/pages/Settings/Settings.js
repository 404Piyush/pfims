import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  EyeIcon,
  PaintBrushIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import Modal from '../../components/UI/Modal';

const Settings = () => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  
  // Application settings state
  const [settings, setSettings] = useState({
    // General Settings
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    
    // Display Settings
    theme: 'light',
    compactMode: false,
    showAnimations: true,
    
    // Privacy Settings
    profileVisibility: 'private',
    dataSharing: false,
    analyticsTracking: true,
    
    // Notification Settings
    emailNotifications: true,
    pushNotifications: true,
    budgetAlerts: true,
    transactionAlerts: false,
    weeklyReports: true,
    monthlyReports: true,
    
    // Security Settings
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true,
    
    // Data & Storage
    autoBackup: true,
    dataRetention: 365,
    exportFormat: 'csv',
  });

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Handle setting changes
  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle toggle changes
  const handleToggleChange = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      // Here you would dispatch an action to save settings
      console.log('Saving settings:', settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  // Reset settings to default
  const handleResetSettings = () => {
    setSettings({
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      currency: 'USD',
      theme: 'light',
      compactMode: false,
      showAnimations: true,
      profileVisibility: 'private',
      dataSharing: false,
      analyticsTracking: true,
      emailNotifications: true,
      pushNotifications: true,
      budgetAlerts: true,
      transactionAlerts: false,
      weeklyReports: true,
      monthlyReports: true,
      twoFactorAuth: false,
      sessionTimeout: 30,
      loginAlerts: true,
      autoBackup: true,
      dataRetention: 365,
      exportFormat: 'csv',
    });
  };

  // Export data
  const handleExportData = () => {
    console.log('Exporting data in format:', settings.exportFormat);
    setShowExportModal(false);
    alert('Data export initiated. You will receive an email when ready.');
  };

  // Delete account
  const handleDeleteAccount = () => {
    console.log('Account deletion requested');
    setShowDeleteModal(false);
    alert('Account deletion request submitted. You will receive a confirmation email.');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const SettingSection = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary-600" />
        </div>
        <h2 className="text-lg font-semibold text-secondary-900">{title}</h2>
      </div>
      {children}
    </div>
  );

  const ToggleSwitch = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium text-secondary-900">{label}</h3>
        {description && <p className="text-sm text-secondary-600">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
          <p className="text-secondary-600">Manage your application preferences and configuration</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleResetSettings}
            className="btn-secondary flex items-center space-x-2"
          >
            <XMarkIcon className="h-4 w-4" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={handleSaveSettings}
            className="btn-primary flex items-center space-x-2"
          >
            <CheckIcon className="h-4 w-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <SettingSection title="General" icon={CogIcon}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
                className="input"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
                className="input"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Date Format
              </label>
              <select
                value={settings.dateFormat}
                onChange={(e) => handleSettingChange('general', 'dateFormat', e.target.value)}
                className="input"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => handleSettingChange('general', 'currency', e.target.value)}
                className="input"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
              </select>
            </div>
          </div>
        </SettingSection>

        {/* Display Settings */}
        <SettingSection title="Display" icon={PaintBrushIcon}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: SunIcon, label: 'Light' },
                  { value: 'dark', icon: MoonIcon, label: 'Dark' },
                  { value: 'auto', icon: ComputerDesktopIcon, label: 'Auto' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => handleSettingChange('display', 'theme', value)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      settings.theme === value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-secondary-200 hover:border-secondary-300'
                    }`}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <ToggleSwitch
              checked={settings.compactMode}
              onChange={() => handleToggleChange('compactMode')}
              label="Compact Mode"
              description="Use smaller spacing and condensed layouts"
            />

            <ToggleSwitch
              checked={settings.showAnimations}
              onChange={() => handleToggleChange('showAnimations')}
              label="Show Animations"
              description="Enable smooth transitions and animations"
            />
          </div>
        </SettingSection>

        {/* Notification Settings */}
        <SettingSection title="Notifications" icon={BellIcon}>
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.emailNotifications}
              onChange={() => handleToggleChange('emailNotifications')}
              label="Email Notifications"
              description="Receive notifications via email"
            />

            <ToggleSwitch
              checked={settings.pushNotifications}
              onChange={() => handleToggleChange('pushNotifications')}
              label="Push Notifications"
              description="Receive push notifications in browser"
            />

            <ToggleSwitch
              checked={settings.budgetAlerts}
              onChange={() => handleToggleChange('budgetAlerts')}
              label="Budget Alerts"
              description="Get alerts when approaching budget limits"
            />

            <ToggleSwitch
              checked={settings.transactionAlerts}
              onChange={() => handleToggleChange('transactionAlerts')}
              label="Transaction Alerts"
              description="Get notified of new transactions"
            />

            <ToggleSwitch
              checked={settings.weeklyReports}
              onChange={() => handleToggleChange('weeklyReports')}
              label="Weekly Reports"
              description="Receive weekly financial summaries"
            />

            <ToggleSwitch
              checked={settings.monthlyReports}
              onChange={() => handleToggleChange('monthlyReports')}
              label="Monthly Reports"
              description="Receive monthly financial reports"
            />
          </div>
        </SettingSection>

        {/* Security Settings */}
        <SettingSection title="Security" icon={ShieldCheckIcon}>
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.twoFactorAuth}
              onChange={() => handleToggleChange('twoFactorAuth')}
              label="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
            />

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Session Timeout (minutes)
              </label>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                className="input"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={0}>Never</option>
              </select>
            </div>

            <ToggleSwitch
              checked={settings.loginAlerts}
              onChange={() => handleToggleChange('loginAlerts')}
              label="Login Alerts"
              description="Get notified of new login attempts"
            />
          </div>
        </SettingSection>

        {/* Privacy Settings */}
        <SettingSection title="Privacy" icon={EyeIcon}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Profile Visibility
              </label>
              <select
                value={settings.profileVisibility}
                onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                className="input"
              >
                <option value="private">Private</option>
                <option value="friends">Friends Only</option>
                <option value="public">Public</option>
              </select>
            </div>

            <ToggleSwitch
              checked={settings.dataSharing}
              onChange={() => handleToggleChange('dataSharing')}
              label="Data Sharing"
              description="Allow sharing anonymized data for service improvement"
            />

            <ToggleSwitch
              checked={settings.analyticsTracking}
              onChange={() => handleToggleChange('analyticsTracking')}
              label="Analytics Tracking"
              description="Help improve the app by sharing usage analytics"
            />
          </div>
        </SettingSection>

        {/* Data & Storage */}
        <SettingSection title="Data & Storage" icon={CurrencyDollarIcon}>
          <div className="space-y-4">
            <ToggleSwitch
              checked={settings.autoBackup}
              onChange={() => handleToggleChange('autoBackup')}
              label="Auto Backup"
              description="Automatically backup your data daily"
            />

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Data Retention (days)
              </label>
              <select
                value={settings.dataRetention}
                onChange={(e) => handleSettingChange('data', 'dataRetention', parseInt(e.target.value))}
                className="input"
              >
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
                <option value={730}>2 years</option>
                <option value={-1}>Forever</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Export Format
              </label>
              <select
                value={settings.exportFormat}
                onChange={(e) => handleSettingChange('data', 'exportFormat', e.target.value)}
                className="input"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowExportModal(true)}
                className="btn-secondary flex-1"
              >
                Export Data
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary flex-1"
              >
                Import Data
              </button>
            </div>
          </div>
        </SettingSection>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-red-900">Delete Account</h3>
                <p className="text-sm text-red-700">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Data Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Data"
      >
        <div className="space-y-4">
          <p className="text-secondary-600">
            Export all your financial data in {settings.exportFormat.toUpperCase()} format. 
            You will receive an email with the download link once the export is ready.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowExportModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleExportData}
              className="btn-primary"
            >
              Export Data
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Data Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Data"
      >
        <div className="space-y-4">
          <p className="text-secondary-600">
            Import your financial data from a CSV, JSON, or Excel file. 
            Make sure your data follows the required format.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Select File
            </label>
            <input
              type="file"
              accept=".csv,.json,.xlsx"
              className="input"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowImportModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowImportModal(false)}
              className="btn-primary"
            >
              Import Data
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900">This action cannot be undone</h3>
              <p className="text-sm text-red-700">
                All your data, including transactions, budgets, and reports will be permanently deleted.
              </p>
            </div>
          </div>
          
          <p className="text-secondary-600">
            Type <strong>DELETE</strong> to confirm account deletion:
          </p>
          
          <input
            type="text"
            placeholder="Type DELETE to confirm"
            className="input"
          />
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;