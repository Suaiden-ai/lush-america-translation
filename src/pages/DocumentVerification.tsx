import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, FileText, Calendar } from 'lucide-react';
import { db } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Document = Database['public']['Tables']['translated_documents']['Row'];

export function DocumentVerification() {
  const [verificationCode, setVerificationCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [searchResult, setSearchResult] = useState<Document | null>(null);

  const handleVerification = async () => {
    if (!verificationCode.trim()) return;

    setIsSearching(true);
    setSearchComplete(false);

    try {
      const foundDocument = await db.verifyDocument(verificationCode.trim());
      setSearchResult(foundDocument || null);
    } catch (error) {
      console.error('Error verifying document:', error);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
      setSearchComplete(true);
    }
  };

  const resetSearch = () => {
    setVerificationCode('');
    setSearchResult(null);
    setSearchComplete(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Document Verification
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Verify the authenticity of documents translated by TheFutureOfEnglish
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Enter Verification Code
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="e.g., A1B2C3D4-E5F6-7890-ABCD-EF1234567890"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-tfe-blue-500 focus:border-tfe-blue-500 text-lg font-mono"
                  disabled={isSearching}
                />
                <button
                  onClick={handleVerification}
                  disabled={isSearching || !verificationCode.trim()}
                  className="px-6 py-3 bg-tfe-blue-950 text-white rounded-r-lg hover:bg-tfe-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Search className="w-5 h-5" />
                  <span>{isSearching ? 'Verifying...' : 'Verify'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                The verification code can be found on the first page of your translated document
              </p>
            </div>

            {/* Search Results */}
            {searchComplete && (
              <div className="mt-8">
                {searchResult ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-green-900">
                          Document Verified ✓
                        </h3>
                        <p className="text-green-700">
                          This document was translated by Lush America Translations
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="bg-white p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <FileText className="w-5 h-5 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Document Name</span>
                        </div>
                        <p className="text-gray-900 font-medium">{searchResult.filename}</p>
                      </div>

                      <div className="bg-white p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <Calendar className="w-5 h-5 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Translation Date</span>
                        </div>
                        <p className="text-gray-900 font-medium">
                          {searchResult.upload_date ? new Date(searchResult.upload_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-lg">
                        <div className="flex items-center mb-2">
                          <FileText className="w-5 h-5 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Pages</span>
                        </div>
                        <p className="text-gray-900 font-medium">{searchResult.pages} pages</p>
                      </div>
                    </div>

                    <div className="mt-6 bg-white p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">Verification Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Verification Code:</span>
                          <span className="font-mono text-gray-900">{searchResult.verification_code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="text-green-600 font-medium capitalize">Authenticated</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Authenticated:</span>
                          <span className="text-green-600 font-medium">Yes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-tfe-red-50 border border-tfe-red-200 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <XCircle className="w-8 h-8 text-tfe-red-600 mr-3" />
                      <div>
                        <h3 className="text-lg font-semibold text-tfe-red-950">
                          Document Not Found
                        </h3>
                        <p className="text-tfe-red-700">
                          The verification code you entered was not found in our system
                        </p>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">Possible Reasons:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• The verification code was entered incorrectly</li>
                        <li>• The document has not been processed yet</li>
                        <li>• The verification code has expired</li>
                        <li>• The document was not translated by TheFutureOfEnglish</li>
                      </ul>
                    </div>
                  </div>
                )}

                <div className="mt-6 text-center">
                  <button
                    onClick={resetSearch}
                    className="px-6 py-2 text-tfe-blue-950 bg-tfe-blue-100 hover:bg-tfe-blue-200 rounded-lg transition-colors"
                  >
                    Search Another Document
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            About Document Verification
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What is Document Verification?
              </h3>
              <p className="text-gray-600 mb-4">
                Document verification allows you to confirm the authenticity of translations 
                provided by TheFutureOfEnglish. Each certified translation comes with a unique 
                verification code that can be used to validate the document.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                How to Find Your Verification Code
              </h3>
              <p className="text-gray-600 mb-4">
                The verification code is provided when your translation is completed. 
                It can be found on the translated document itself, in your email confirmation, 
                or in your account dashboard.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Why Verify Documents?
              </h3>
              <ul className="text-gray-600 space-y-2">
                <li>• Ensure document authenticity</li>
                <li>• Prevent fraud and forgery</li>
                <li>• Meet official requirements</li>
                <li>• Provide peace of mind</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Need Help?
              </h3>
              <p className="text-gray-600 mb-4">
                If you're having trouble with document verification or need assistance, 
                please contact our support team. We're here to help ensure your documents 
                are properly verified and accepted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}