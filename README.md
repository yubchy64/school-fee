# School Fee Management System

A comprehensive web-based application for managing school fees, student records, and billing built with HTML, CSS, JavaScript, and Firebase.

## 🚀 Features

- **Authentication System**: Secure login/logout with Firebase Auth
- **Student Management**: Add, view, edit, and delete student records
- **Fee Structure**: Create and manage different fee categories (mandatory/optional)
- **Bill Generation**: Auto-generate bills for students with fee breakdowns
- **Printable Receipts**: Generate and print professional fee receipts
- **Dashboard**: Real-time statistics and overview
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 📁 Project Structure

```
school-fee-management/
├── index.html              # Login page
├── dashboard.html          # Main application dashboard
├── css/
│   └── styles.css         # Custom styles and print formatting
├── js/
│   └── app.js             # Main application logic
├── firebase.json          # Firebase hosting configuration
├── firestore.rules        # Firestore security rules
├── firestore.indexes.json # Database indexes
└── README.md              # This file
```

## 🛠️ Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Authentication** and **Firestore Database**
4. Enable **Hosting** for deployment

### 2. Firebase Authentication Setup

1. Go to Authentication > Sign-in method
2. Enable **Email/Password** provider
3. Create a test user:
   - Email: `admin@school.com`
   - Password: `admin123`

### 3. Firestore Database Setup

1. Go to Firestore Database
2. Create database in **test mode** (for development)
3. The app will automatically create these collections:
   - `students` - Student records
   - `fee_structure` - Fee categories
   - `bills` - Generated bills

### 4. Firebase Configuration

1. Go to Project Settings > General
2. Scroll down to "Your apps" section
3. Click on "Add app" and select Web app
4. Copy the Firebase configuration object
5. Replace the placeholder in both `index.html` and `dashboard.html`:

```javascript
// Replace this placeholder in both HTML files:
window.firebaseConfig = {
    // Paste your Firebase config here
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

### 5. Local Development

1. Install Firebase CLI (if not installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project directory:
   ```bash
   firebase init
   ```
   - Select Firestore, Hosting
   - Choose your Firebase project
   - Use default settings for Firestore
   - Set public directory as `.` (current directory)
   - Configure as single-page app: No
   - Set up automatic builds: No

4. Serve locally:
   ```bash
   firebase serve
   ```

### 6. Deploy to Firebase Hosting

```bash
firebase deploy
```

## 📊 Database Schema

### Students Collection
```javascript
{
  id: "auto-generated",
  name: "John Doe",
  class: "10",
  roll_number: "101",
  created_at: timestamp
}
```

### Fee Structure Collection
```javascript
{
  id: "auto-generated",
  fee_name: "Tuition Fee",
  amount: 5000,
  is_mandatory: true,
  created_at: timestamp
}
```

### Bills Collection
```javascript
{
  id: "auto-generated",
  student_id: "student_doc_id",
  student_name: "John Doe",
  student_class: "10",
  student_roll: "101",
  fee_breakdown: [
    {
      fee_name: "Tuition Fee",
      amount: 5000
    }
  ],
  total_amount: 5000,
  bill_date: timestamp,
  status: "unpaid" // unpaid, paid, overdue
}
```

## 💡 Usage Guide

### 1. Initial Login
- Use the demo account: `admin@school.com` / `admin123`
- Or create your own account in Firebase Console

### 2. Adding Students
1. Go to **Students** tab
2. Click **Add Student** button
3. Fill in student details (Name, Class, Roll Number)
4. Click **Save**

### 3. Setting Up Fee Structure
1. Go to **Fee Structure** tab
2. Click **Add Fee Category** button
3. Enter fee details:
   - Fee Name (e.g., "Tuition Fee", "Bus Fee")
   - Amount in rupees
   - Select Mandatory/Optional
4. Click **Save**

### 4. Generating Bills
1. Add students and fee structure first
2. Go to **Bills & Receipts** tab
3. Click **Generate Bills** button
4. Bills will be auto-created for all students with mandatory fees

### 5. Managing Bills
- **Mark Paid/Unpaid**: Click the status button on each bill card
- **Print Receipt**: Click the "Receipt" button to open printable receipt
- **View Details**: Each bill shows student info, fee breakdown, and total amount

### 6. Dashboard Overview
- **Total Students**: Count of registered students
- **Total Fees Collected**: Sum of all paid bills
- **Pending Bills**: Count of unpaid bills

## 🎨 Customization

### Styling
- Modify `css/styles.css` for custom styling
- Colors and branding can be changed in CSS variables
- Print styles are included for professional receipts

### School Information
- Update school details in the receipt template (line ~445 in `js/app.js`)
- Change school name, address, and contact information

### Currency
- The system uses Indian Rupees (₹) by default
- Change currency symbol in `js/app.js` if needed

## 🔒 Security

- **Authentication**: Only logged-in users can access the system
- **Firestore Rules**: Database access restricted to authenticated users
- **Client-side Validation**: Forms include basic validation
- **Real-time Updates**: Data syncs automatically across sessions

## 📱 Browser Compatibility

- **Modern browsers**: Chrome, Firefox, Safari, Edge
- **Responsive design**: Works on mobile and tablet devices
- **Print support**: Professional receipt printing

## 🐛 Troubleshooting

### Common Issues

1. **Login not working**:
   - Check Firebase configuration
   - Ensure Authentication is enabled
   - Verify user credentials

2. **Data not loading**:
   - Check Firestore rules
   - Verify internet connection
   - Check browser console for errors

3. **Print not working**:
   - Ensure browser allows printing
   - Check print preview before printing

### Support
For technical issues, check the browser console for error messages and ensure all Firebase services are properly configured.

## 📄 License

This project is open source and available under the MIT License.