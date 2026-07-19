const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

// Generate JWT token for piyush@gmail.com
const payload = { id: '68e4c8cb0ffdfa69f0364d2f' };
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-do-not-use-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET env not set; using insecure dev fallback. Set JWT_SECRET to a 32+ char random string before running.');
}
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

console.log('Generated JWT token for piyush@gmail.com');
console.log('Testing transactions API...\n');

// Test transactions API
const curlCommand = `curl -s -H "Authorization: Bearer ${token}" "http://localhost:3001/api/transactions"`;

exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (stderr) {
    console.error('Stderr:', stderr);
    return;
  }
  
  try {
    const response = JSON.parse(stdout);
    console.log('Transactions API Response:');
    console.log(JSON.stringify(response, null, 2));
    
    // Check structure
    if (response.data && response.data.transactions) {
      console.log(`\nFound ${response.data.transactions.length} transactions in response.data.transactions`);
    } else if (response.transactions) {
      console.log(`\nFound ${response.transactions.length} transactions in response.transactions`);
    } else if (Array.isArray(response)) {
      console.log(`\nFound ${response.length} transactions as direct array`);
    } else {
      console.log('\nUnexpected response structure');
    }
  } catch (parseError) {
    console.error('Failed to parse JSON response:', parseError);
    console.log('Raw response:', stdout);
  }
});
