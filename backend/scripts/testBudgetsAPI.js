const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

// Generate JWT token for the user
const userId = '68e4c8cb0ffdfa69f0364d2f'; // piyush@gmail.com user ID
const JWT_SECRET = 'pfims_super_secret_jwt_key_for_development_only_2024';
const token = jwt.sign(
  { id: userId }, // Use 'id' instead of 'userId' to match auth middleware
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Generated JWT token for testing budgets API');

// Test the budgets API
const curlCommand = `curl -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" http://localhost:3001/api/budgets`;

console.log('Testing budgets API...');
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  if (stderr) {
    console.error('Stderr:', stderr);
  }
  
  console.log('API Response:');
  try {
    const response = JSON.parse(stdout);
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('Raw response:', stdout);
  }
});