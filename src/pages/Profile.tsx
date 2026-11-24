import { Link } from 'react-router-dom';
import { ArrowLeft, LogIn, Shield } from 'lucide-react';
import { useState } from 'react';

export default function Profile() {
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account and preferences
        </p>
      </div>

      {/* Current Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-2xl font-bold">
            G
          </div>
          <div>
            <h2 className="text-xl font-semibold">Guest User</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Play locally without an account</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium">
              <Shield className="w-4 h-4" />
              Guest Mode
            </span>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Your progress is stored locally on this device. Create an account to sync across devices and unlock additional features.
          </p>
        </div>

        <button
          onClick={() => setShowSyncPrompt(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          <LogIn className="w-5 h-5" />
          Create Account / Sign In
        </button>
      </div>

      {/* Features Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">What you get with an account</h3>
        <ul className="space-y-3">
          {[
            'Sync progress across all devices',
            'Detailed long-term statistics',
            'Cloud backup of your data',
            'Participate in future challenges',
          ].map((feature, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sync Prompt Modal */}
      {showSyncPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-semibold mb-4">Create Account</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This feature will be available after we set up authentication. For now, continue playing as a guest!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncPrompt(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Continue as Guest
              </button>
              <button
                onClick={() => setShowSyncPrompt(false)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
