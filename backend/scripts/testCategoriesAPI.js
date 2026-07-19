const jwt = require('jsonwebtoken');
const { exec } = require('child_process');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-do-not-use-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET env not set; using insecure dev fallback. Set JWT_SECRET to a 32+ char random string before running.');
}
const userId = '68e4c8cb0ffdfa69f0364d2f';
const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });

console.log('Generated JWT token for testing categories API');
console.log('Token:', token.substring(0, 50) + '...');

const curlCommand = `curl -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" http://localhost:5000/api/categories`;

exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  if (stderr) {
    console.error('Stderr:', stderr);
  }
  console.log('\nAPI Response:');
  console.log(stdout);
});