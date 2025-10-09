const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

// Generate JWT token for the user
const userId = '68e4c8cb0ffdfa69f0364d2f'; // piyush@gmail.com user ID
const JWT_SECRET = 'pfims_super_secret_jwt_key_for_development_only_2024';
const token = jwt.sign(
  { id: userId },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated JWT token for testing reports API');

// Test different reports endpoints
const endpoints = [
  '/api/reports/overview',
  '/api/reports/spending-analysis',
  '/api/reports/budget-performance',
  '/api/reports/cash-flow'
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const curlCommand = `curl -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" http://localhost:3001${endpoint}`;
    
    console.log(`\n=== Testing ${endpoint} ===`);
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error.message);
        resolve();
        return;
      }
      
      try {
        const response = JSON.parse(stdout);
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw response:', stdout);
      }
      resolve();
    });
  });
}

async function testAllEndpoints() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

testAllEndpoints();