import React, { useState, useEffect } from 'react';
import { GitMerge, Code, KeyRound, User, Loader2, Copy, Check, Eye, EyeOff, Info, HelpCircle } from 'lucide-react';
import { TokenGenerationResponse, MergeSimulationResponse } from '../types';

interface MergeSimulatorInterfaceProps {
  translations: any;
}

// Mock Flask Backend Configuration (Mirrored from Python code)
const MOCK_SECRET_KEY = 'your_very_secret_key';
const MOCK_ALLOWED_STRATEGIES = ['fast-forward', 'squash', 'rebase'];
const MOCK_PROTECTED_BRANCHES = {
  'main': ['fast-forward'],
  'develop': ['fast-forward', 'squash'],
  'release': ['rebase'],
};

// --- Mock JWT Token Handling (Client-side Simulation) ---
// Note: This is a simplified, insecure client-side simulation purely for UI demonstration.
// Do NOT use this for real-world JWT handling.
const mockGenerateToken = (userId: string): TokenGenerationResponse => {
  if (!userId) {
    return { error: 'Missing user_id' };
  }

  const header = { "alg": "HS256", "typ": "JWT" };
  const payload = {
    'user_id': userId,
    'exp': Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');

  // Simulate a "signature" - in a real JWT, this would be cryptographically signed.
  // Here, it's just a placeholder to complete the JWT structure.
  const signature = 'mock_signature_for_demo'; // Simplified for simulation

  return { token: `${encodedHeader}.${encodedPayload}.${signature}` };
};

const mockVerifyToken = (token: string): string | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const decodedPayload = JSON.parse(atob(parts[1]));
    if (decodedPayload.exp * 1000 < Date.now()) {
      return null; // Token expired
    }
    return decodedPayload.user_id || null;
  } catch (e) {
    return null; // Invalid token format
  }
};

// --- Mock Merge Logic (Client-side Simulation) ---
const mockMergeCode = (token: string | null, branchFrom: string, branchTo: string, strategy: string): MergeSimulationResponse => {
  if (!token) {
    return { error: 'Authentication failed: No token provided or token expired.' };
  }
  
  const userId = mockVerifyToken(token);
  if (!userId) {
    return { error: 'Authentication failed: Invalid or expired token.' };
  }

  if (!branchFrom || !branchTo || !strategy) {
    return { error: 'Missing required fields: from, to, strategy.' };
  }

  if (!MOCK_ALLOWED_STRATEGIES.includes(strategy)) {
    return { error: `Strategy "${strategy}" is not allowed.` };
  }

  const allowedStrategiesForBranch = MOCK_PROTECTED_BRANCHES[branchTo as keyof typeof MOCK_PROTECTED_BRANCHES] || MOCK_ALLOWED_STRATEGIES;

  if (!allowedStrategiesForBranch.includes(strategy)) {
    return { error: `Merge to "${branchTo}" only allows strategies: ${allowedStrategiesForBranch.join(', ')}.` };
  }

  return {
    status: 'success',
    merged_from: branchFrom,
    merged_to: branchTo,
    strategy: strategy,
  };
};

const flaskCode = `from flask import Flask, request, jsonify
from flask_httpauth import HTTPTokenAuth
import jwt
import datetime

# --------------------
# Initial Configuration
# --------------------

app = Flask(__name__)
auth = HTTPTokenAuth(scheme='Bearer')

# Secret key for JWT
SECRET_KEY = 'your_very_secret_key'

# Sample allowed strategies
ALLOWED_STRATEGIES = ['fast-forward', 'squash', 'rebase']

# Define protected branches and allowed strategy
PROTECTED_BRANCHES = {
    'main': ['fast-forward'],
    'develop': ['fast-forward', 'squash'],
    'release': ['rebase']
}

# --------------------
# JWT Token Handling
# --------------------

def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# --------------------
# Auth Verification
# --------------------

@auth.verify_token
def verify_auth_token(token):
    user_id = verify_token(token)
    return user_id is not None

# --------------------
# Merge Strategy API
# --------------------

@app.route('/merge', methods=['POST'])
@auth.login_required
def merge_code():
    data = request.get_json()
    branch_from = data.get('from')
    branch_to = data.get('to')
    strategy = data.get('strategy')

    if not all([branch_from, branch_to, strategy]):
        return jsonify({'error': 'Missing required fields'}), 400

    if strategy not in ALLOWED_STRATEGIES:
        return jsonify({'error': f'Strategy "{strategy}" is not allowed'}), 403

    allowed_strategies = PROTECTED_BRANCHES.get(branch_to, ALLOWED_STRATEGIES)

    if strategy not in allowed_strategies:
        return jsonify({
            'error': f'Merge to "{branch_to}" only allows strategies: {allowed_strategies}'
        }), 403

    return jsonify({
        'status': 'success',
        'merged_from': branch_from,
        'merged_to': branch_to,
        'strategy': strategy
    }), 200

# --------------------
# Token Generation (For Testing)
# --------------------

@app.route('/token', methods=['POST'])
def get_token():
    data = request.get_json()
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    token = generate_token(user_id)
    return jsonify({'token': token})

# --------------------
# Entry Point
# --------------------

if __name__ == '__main__':
    app.run(debug=True)`;


const MergeSimulatorInterface: React.FC<MergeSimulatorInterfaceProps> = ({ translations }) => {
  const [userIdInput, setUserIdInput] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [fromBranch, setFromBranch] = useState('feature/my-branch');
  const [toBranch, setToBranch] = useState('main');
  const [strategy, setStrategy] = useState('fast-forward');
  const [apiResponse, setApiResponse] = useState<MergeSimulationResponse | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMergeLoading, setIsMergeLoading] = useState(false);

  // Function to simulate token generation
  const handleGenerateToken = async () => {
    if (!userIdInput.trim()) {
      setTokenError(translations.tokenError);
      return;
    }
    setIsTokenLoading(true);
    setTokenError(null);
    setGeneratedToken(null);
    setApiResponse(null); // Clear previous API response

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const result = mockGenerateToken(userIdInput.trim());
    if (result.token) {
      setGeneratedToken(result.token);
    } else if (result.error) {
      setTokenError(result.error);
    }
    setIsTokenLoading(false);
  };

  // Function to simulate merge request
  const handleSendMergeRequest = async () => {
    if (!generatedToken) {
      setMergeError(translations.mergeFailed + " " + translations.authSection);
      return;
    }
    if (!fromBranch.trim() || !toBranch.trim() || !strategy.trim()) {
      setMergeError(translations.mergeFailed + " Missing branch/strategy details.");
      return;
    }

    setIsMergeLoading(true);
    setMergeError(null);
    setApiResponse(null);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    const result = mockMergeCode(generatedToken, fromBranch.trim(), toBranch.trim(), strategy.trim());
    setApiResponse(result);
    if (result.error) {
      setMergeError(result.error);
    }
    setIsMergeLoading(false);
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(flaskCode);
    // You might want to add a state for code copied, similar to tokenCopied
  };


  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center transition-colors">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-600 flex items-center justify-center text-white shadow-md">
            <GitMerge size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{translations.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{translations.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 text-center sm:text-right max-w-lg">
          {translations.description}
        </p>
      </div>

      {/* Main Content Area: Two Columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left Column: Flask Code Display */}
        <div className="relative overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4 sticky top-0 bg-slate-50 dark:bg-slate-950 z-10">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Code size={18} className="text-purple-500" /> {translations.codeExplanation}
            </h3>
            <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                title={translations.copyCode}
            >
                <Copy size={14} />
                <span>{translations.copyCode}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{translations.codeExplanationDesc}</p>
          <div className="bg-slate-800 rounded-lg overflow-hidden relative shadow-md">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono relative p-3">
              {flaskCode.split('\n').map((line, index) => (
                <div key={index} className="flex hover:bg-slate-700/50 transition-colors duration-100">
                  <span className="text-slate-500 w-8 text-right select-none pr-2 flex-shrink-0">
                    {index + 1}
                  </span>
                  <code className="flex-1 break-words">{line}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Right Column: Interactive API Client */}
        <div className="overflow-y-auto p-4 space-y-8">
          {/* Authentication Section */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg flex items-center gap-2">
              <User size={20} className="text-blue-500" /> {translations.authSection}
            </h3>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder={translations.tokenPlaceholder}
                className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-blue-500 focus:border-blue-500"
                disabled={isTokenLoading}
              />
              <button
                onClick={handleGenerateToken}
                disabled={isTokenLoading || !userIdInput.trim()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isTokenLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {translations.generateToken}
              </button>
            </div>

            {tokenError && (
              <p className="text-red-500 text-sm flex items-center gap-2">
                <Info size={16} /> {tokenError}
              </p>
            )}

            {generatedToken && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{translations.generatedToken}:</label>
                <div className="relative bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-xs font-mono break-all text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                  {generatedToken}
                  <button
                    onClick={handleCopyToken}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300 transition-colors"
                    title={translations.copyToken}
                  >
                    {tokenCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 relative">
              <KeyRound size={16} />
              <span>{translations.secretKey}:</span>
              <span className="font-mono ml-1">
                {showSecretKey ? MOCK_SECRET_KEY : '************************'}
              </span>
              <button
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showSecretKey ? "Hide Secret Key" : "Show Secret Key"}
              >
                {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {/* Moved the title prop to a wrapping span for tooltip functionality */}
              <span title="The SECRET_KEY is used to sign JWTs. In a real application, this should be kept server-side and highly secured.">
                <HelpCircle size={16} className="text-slate-400 ml-2" />
              </span>
            </div>
          </div>

          {/* Merge Request Simulation Section */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-lg flex items-center gap-2">
              <GitMerge size={20} className="text-teal-500" /> {translations.mergeSection}
            </h3>

            <div>
              <label htmlFor="from-branch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{translations.fromBranch}</label>
              <input
                type="text"
                id="from-branch"
                value={fromBranch}
                onChange={(e) => setFromBranch(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500"
                disabled={isMergeLoading}
              />
            </div>

            <div>
              <label htmlFor="to-branch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{translations.toBranch}</label>
              <input
                type="text"
                id="to-branch"
                value={toBranch}
                onChange={(e) => setToBranch(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500"
                disabled={isMergeLoading}
              />
            </div>

            <div>
              <label htmlFor="strategy" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{translations.strategy}</label>
              <select
                id="strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-teal-500 focus:border-teal-500"
                disabled={isMergeLoading}
              >
                {MOCK_ALLOWED_STRATEGIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSendMergeRequest}
              disabled={isMergeLoading || !generatedToken || !fromBranch.trim() || !toBranch.trim() || !strategy.trim()}
              className="w-full px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isMergeLoading ? <Loader2 size={18} className="animate-spin" /> : null}
              {translations.sendRequest}
            </button>

            {mergeError && (
              <p className="text-red-500 text-sm flex items-center gap-2">
                <Info size={16} /> {mergeError}
              </p>
            )}

            {apiResponse && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{translations.response}:</label>
                <pre className={`
                  bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-xs font-mono overflow-x-auto border
                  ${apiResponse.error ? 'border-red-400 text-red-700 dark:text-red-300' : 'border-green-400 text-green-700 dark:text-green-300'}
                `}>
                  <code>{JSON.stringify(apiResponse, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeSimulatorInterface;