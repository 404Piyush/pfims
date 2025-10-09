# Personal Finance Management System (PFIMS)

A comprehensive web application for managing personal finances, built with React, Node.js, and MongoDB.

## 🚀 Live Demo
**Repository**: https://github.com/404Piyush/pfims.git

## 📋 Features

- **Dashboard**: Overview of financial health with key metrics
- **Transaction Management**: Add, edit, and categorize income/expenses
- **Budget Planning**: Create and track budgets with progress monitoring
- **Category Management**: Organize transactions with custom categories
- **Reports & Analytics**: Detailed financial insights and trends
- **User Authentication**: Secure login and registration system

## 🛠️ Tech Stack

### Frontend
- **React** - User interface framework
- **Redux Toolkit** - State management
- **Tailwind CSS** - Styling and responsive design
- **React Router** - Navigation and routing

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/404Piyush/pfims.git
cd pfims
```

### 2. Backend Setup
```bash
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration:
# MONGODB_URI=mongodb://localhost:27017/pfims
# JWT_SECRET=your_jwt_secret_key
# PORT=3001
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Database Setup
Make sure MongoDB is running on your system. The application will automatically create the necessary collections.

## 🚀 Running the Application

### Development Mode

1. **Start Backend Server**:
```bash
cd backend
npm run dev
```
The backend will run on `http://localhost:3001`

2. **Start Frontend Development Server**:
```bash
cd frontend
npm start
```
The frontend will run on `http://localhost:3000`

### Production Mode

1. **Build Frontend**:
```bash
cd frontend
npm run build
```

2. **Start Production Server**:
```bash
cd backend
npm start
```

## 🔧 Environment Variables

### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/pfims
JWT_SECRET=your_super_secret_jwt_key
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001/api
```

## 📁 Project Structure

```
pfims/
├── backend/
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/         # MongoDB models
│   ├── routes/         # API routes
│   ├── scripts/        # Utility scripts
│   └── server.js       # Entry point
├── frontend/
│   ├── public/         # Static files
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── store/      # Redux store and slices
│   │   └── utils/      # Utility functions
│   └── package.json
└── README.md
```

## 🧪 Testing

### Backend API Testing
The project includes comprehensive API testing scripts:

```bash
cd backend
node scripts/testBudgetsAPI.js
node scripts/testCategoriesAPI.js
node scripts/testTransactionsAPI.js
node scripts/testReportsAPI.js
```

### Database Verification
```bash
cd backend
node scripts/checkPiyushUser.js
node scripts/checkPiyushBudgets.js
node scripts/checkPiyushCategories.js
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify database permissions

2. **JWT Authentication Issues**:
   - Verify JWT_SECRET is set in .env
   - Check token expiration
   - Clear browser localStorage if needed

3. **Redux State Issues**:
   - Check browser console for errors
   - Verify API responses in Network tab
   - Use Redux DevTools for debugging

### Recent Fixes Applied
- ✅ Fixed Redux state management for categories, budgets, and transactions
- ✅ Improved API response handling for nested data structures
- ✅ Enhanced error handling and validation
- ✅ Added comprehensive testing scripts

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Transactions
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Categories
- `GET /api/categories` - Get categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Budgets
- `GET /api/budgets` - Get budgets
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Reports
- `GET /api/reports/overview` - Financial overview
- `GET /api/reports/spending-analysis` - Spending analysis
- `GET /api/reports/budget-performance` - Budget performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Piyush Utkar**
- GitHub: [@404Piyush](https://github.com/404Piyush)
- Email: piyush@example.com

## 🙏 Acknowledgments

- React community for excellent documentation
- MongoDB team for the robust database solution
- All contributors who helped improve this project

---

## 📈 Recent Updates

For detailed information about recent changes and improvements, see [RECENT_CHANGES.md](RECENT_CHANGES.md).

### Latest Version Features:
- ✅ Fixed Redux state management issues
- ✅ Improved data handling and validation
- ✅ Enhanced error boundaries and user feedback
- ✅ Comprehensive API testing suite
- ✅ Better authentication flow

---

**Happy Financial Management! 💰**