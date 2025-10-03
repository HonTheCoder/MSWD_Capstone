# Relief Allocation Management System

A comprehensive web-based application for managing relief goods allocation and distribution to affected communities during disasters and emergencies.

## 🌟 Features

### Core Functionality
- **User Management**: Role-based access control (MSWD Admin, Barangay Officials)
- **Resident Registration**: Complete resident profiling with vulnerability assessment
- **Inventory Management**: Real-time tracking of relief goods with batch management
- **Priority Calculation**: Advanced algorithm for determining relief allocation priority
- **Delivery Management**: Scheduling and tracking of relief goods distribution
- **Analytics & Reporting**: Visual dashboards and exportable reports
- **Mobile Responsive**: Optimized for both desktop and mobile devices

### Advanced Features
- **Priority Calculator**: Sophisticated scoring system based on:
  - Evacuation history
  - Economic status
  - Family size
  - Housing conditions
  - Geographic risk factors
- **Real-time Data**: Live updates using Firebase Firestore
- **Error Handling**: Comprehensive error management with user-friendly messages
- **Resource Loading**: Optimized lazy loading of external dependencies
- **Data Export**: CSV export capabilities for reports and analytics

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Firebase account and project
- Web browser with modern JavaScript support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ReliefAllocation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

4. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication and Firestore
   - Update `firebase.js` with your configuration
   - Deploy Firestore security rules and indexes

5. **Start development server**
   ```bash
   npm run dev
   ```

### Firebase Setup

1. **Firestore Collections Required:**
   - `users` - User accounts and roles
   - `residents` - Resident profiles and data
   - `deliveries` - Relief delivery records
   - `inventory` - Current stock levels
   - `inventory_logs` - Transaction history
   - `inventory_batches` - Batch management
   - `accountRequests` - New account requests

2. **Authentication:**
   - Enable Email/Password authentication
   - Set up user roles and permissions

3. **Security Rules:**
   Deploy the Firestore security rules to protect your data

## 📁 Project Structure

```
ReliefAllocation/
├── js/
│   ├── error-handler.js      # Global error handling
│   ├── priority-calculator.js # Priority calculation logic
│   └── resource-loader.js    # Dynamic resource loading
├── tests/
│   ├── setup.js             # Test configuration
│   └── *.test.js           # Unit tests
├── app.js                   # Main application logic
├── firebase.js              # Firebase configuration
├── chart.js                 # Chart and visualization logic
├── main.html               # Main application interface
├── index.html              # Landing page
├── styles.css              # Application styles
├── firestore.indexes.json  # Firestore indexes
├── .env.example            # Environment variables template
└── package.json            # Project configuration
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Individual function testing
- **Integration Tests**: Firebase operation testing
- **Mock Data**: Comprehensive test fixtures

## 🔧 Development

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Build and test
npm run build
```

### Development Server
```bash
# Start live development server
npm run dev

# Start Firebase hosting emulator
npm start
```

## 📊 Priority Calculation Algorithm

The system uses a sophisticated multi-factor scoring algorithm:

### Scoring Factors
1. **Evacuation History (35%)**: Frequency of past evacuations
2. **Income Level (25%)**: Economic vulnerability assessment
3. **Family Size (15%)**: Number of dependents
4. **Housing Condition (15%)**: Structural vulnerability
5. **Terrain Risk (10%)**: Geographic risk factors

### Priority Levels
- **Critical**: 90-100 points
- **High**: 75-89 points
- **Medium**: 50-74 points
- **Low**: 25-49 points
- **Very Low**: 0-24 points

## 🔐 Security Considerations

### Firebase Security
- Environment variables for sensitive configuration
- Firestore security rules implementation
- User authentication and role-based access
- Data validation and sanitization

### Best Practices
- Input validation on all forms
- SQL injection prevention
- XSS protection
- Secure data transmission

## 🚀 Deployment

### Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

### Production Checklist
- [ ] Environment variables configured
- [ ] Firebase security rules deployed
- [ ] Firestore indexes created
- [ ] Authentication providers configured
- [ ] Performance optimization completed
- [ ] Error monitoring set up

## 📈 Performance Optimization

### Implemented Optimizations
- **Lazy Loading**: External libraries loaded on demand
- **Resource Optimization**: Minimized bundle size
- **Caching Strategy**: Efficient data caching
- **Database Optimization**: Proper indexing and query optimization

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Connection Issues**
   - Check network connectivity
   - Verify Firebase configuration
   - Ensure proper authentication

2. **Permission Errors**
   - Verify user roles and permissions
   - Check Firestore security rules
   - Confirm authentication status

3. **Performance Issues**
   - Check network speed
   - Verify database indexes
   - Monitor console for errors

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Code Standards
- Follow ESLint configuration
- Use Prettier for formatting
- Write comprehensive tests
- Document all functions with JSDoc

## 📝 API Documentation

### Firebase Functions
- `addResidentToFirestore(data)`: Add new resident
- `getInventoryTotals()`: Get current inventory
- `calculatePriority(resident)`: Calculate priority score
- `scheduleDelivery(data)`: Schedule relief delivery

### Utility Functions
- `showSuccess(message)`: Display success notification
- `showError(message)`: Display error notification
- `exportToCSV(data, filename)`: Export data to CSV

## 📊 Analytics & Monitoring

### Metrics Tracked
- User engagement and activity
- System performance and errors
- Relief distribution effectiveness
- Priority calculation accuracy

### Reporting Features
- Real-time dashboards
- Exportable reports
- Visual analytics
- Performance metrics

## 🗺️ Roadmap

### Upcoming Features
- [ ] SMS notifications for deliveries
- [ ] Offline capability for remote areas
- [ ] Advanced reporting and analytics
- [ ] Integration with weather APIs
- [ ] Multi-language support
- [ ] Mobile application

### Technical Improvements
- [ ] Performance monitoring
- [ ] Automated testing pipeline
- [ ] Security audit implementation
- [ ] Accessibility improvements
- [ ] SEO optimization

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 👥 Support

For support, please contact:
- **Development Team**: [Your Email]
- **Documentation**: [Documentation Link]
- **Issues**: [GitHub Issues Link]

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- Chart.js for data visualization
- Bootstrap for responsive design
- Community contributors and testers

---

*Last updated: [Current Date]*
*Version: 1.0.0*