const jwt = require('jsonwebtoken');
const axios = require('axios');

// Generate JWT token for piyush@gmail.com
const payload = { id: '68e4c8cb0ffdfa69f0364d2f' };
const JWT_SECRET = 'pfims_super_secret_jwt_key_for_development_only_2024';
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

async function testIncomeTransaction() {
  try {
    console.log('Testing income transaction creation...\n');
    
    // First, get available categories
    console.log('1. Fetching available categories...');
    const categoriesResponse = await axios.get('http://localhost:3001/api/categories', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Available categories:');
    const categories = categoriesResponse.data;
    categories.forEach(cat => {
      console.log(`- ${cat.name} (${cat.type}) - ID: ${cat._id}`);
    });
    
    // Find an income category
    const incomeCategory = categories.find(cat => cat.type === 'income');
    if (!incomeCategory) {
      console.log('\n❌ No income category found!');
      return;
    }
    
    console.log(`\n2. Using income category: ${incomeCategory.name}`);
    
    // Create a test income transaction
    const testTransaction = {
      title: 'Test Income Transaction',
      amount: 1000.00,
      type: 'income',
      category: incomeCategory._id,
      account: 'Bank Account',
      description: 'Testing income transaction creation',
      date: new Date().toISOString().split('T')[0],
      notes: 'This is a test transaction'
    };
    
    console.log('\n3. Creating test income transaction...');
    console.log('Transaction data:', JSON.stringify(testTransaction, null, 2));
    
    const transactionResponse = await axios.post('http://localhost:3001/api/transactions', testTransaction, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Income transaction created successfully!');
    console.log('Response:', JSON.stringify(transactionResponse.data, null, 2));
    
    // Now fetch transactions to verify it was added
    console.log('\n4. Fetching transactions to verify...');
    const transactionsResponse = await axios.get('http://localhost:3001/api/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const transactions = transactionsResponse.data.data ? transactionsResponse.data.data.transactions : transactionsResponse.data;
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    
    console.log(`\nFound ${incomeTransactions.length} income transactions:`);
    incomeTransactions.forEach(t => {
      console.log(`- ${t.title}: ₹${t.amount} (${new Date(t.date).toLocaleDateString()})`);
    });
    
  } catch (error) {
    console.log('\n❌ Error during test:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testIncomeTransaction();