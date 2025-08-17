// School Fee Management System - Main Application Logic

// Import Firebase functions
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    onSnapshot,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// Global variables
let currentUser = null;
let studentsData = [];
let feesData = [];
let billsData = [];
let paymentsData = [];
let paymentTrackingData = [];
let filteredStudentsData = [];
let filteredPaymentsData = [];
let filteredBillsData = [];
let excelImportData = [];
let editingStudentId = null;
let lastFocusedElement = null;

// Helper function to safely convert Firebase Timestamp or Date to JavaScript Date
function safeDate(dateValue) {
    if (!dateValue) return null;
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
        return dateValue;
    }
    
    // If it's a Firebase Timestamp (has seconds property)
    if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
        return new Date(dateValue.seconds * 1000);
    }
    
    // If it's a string or number, try to parse it
    try {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
        console.error('Error parsing date:', dateValue, error);
        return null;
    }
}

// Helper function to format date safely
function formatDate(dateValue, options = {}) {
    const date = safeDate(dateValue);
    if (!date) return 'Invalid Date';
    
    try {
        if (options.time) {
            return date.toLocaleString();
        } else {
            return date.toLocaleDateString();
        }
    } catch (error) {
        console.error('Error formatting date:', dateValue, error);
        return 'Invalid Date';
    }
}
let currentStudentFilters = {
    search: '',
    class: '',
    sort: 'name'
};
let currentFeeFilters = {
    class: '',
    type: ''
};
let currentPaymentFilters = {
    search: '',
    status: '',
    class: '',
    sort: 'name'
};
let currentBillFilters = {
    search: '',
    class: '',
    status: '',
    sort: 'name'
};

// User permissions configuration
const USER_PERMISSIONS = {
    'admin@school.com': {
        role: 'admin',
        permissions: ['view_payments', 'add_payments', 'export_reports', 'send_notices', 'manage_students', 'manage_fees']
    },
    // Add more users with different permission levels
    'staff@school.com': {
        role: 'staff',
        permissions: ['view_payments', 'add_payments']
    },
    'viewer@school.com': {
        role: 'viewer',
        permissions: ['view_payments']
    }
};

function hasPermission(permission) {
    if (!currentUser || !currentUser.email) return false;
    
    const userPerms = USER_PERMISSIONS[currentUser.email];
    if (!userPerms) return false;
    
    return userPerms.permissions.includes(permission);
}

function enforcePermissions() {
    // Hide/disable elements based on user permissions
    if (!hasPermission('add_payments')) {
        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) addPaymentBtn.style.display = 'none';
    }
    
    if (!hasPermission('export_reports')) {
        const exportBtn = document.getElementById('exportPaymentsBtn');
        if (exportBtn) exportBtn.style.display = 'none';
    }
    
    if (!hasPermission('send_notices')) {
        const noticesBtn = document.getElementById('sendOverdueNoticesBtn');
        if (noticesBtn) noticesBtn.style.display = 'none';
    }
    
    if (!hasPermission('view_payments')) {
        const paymentsTab = document.getElementById('paymentsTab');
        if (paymentsTab) paymentsTab.style.display = 'none';
    }
}

// Initialize app when DOM is loaded
console.log('Adding DOMContentLoaded event listener');

function initializeApp() {
    console.log('Initializing app');
    console.log('window.auth:', window.auth);
    console.log('window.db:', window.db);
    
    if (!window.auth || !window.db) {
        console.error('Firebase services not initialized properly');
        // Try again after a short delay
        setTimeout(initializeApp, 100);
        return;
    }
    
    initializeAuth();
    initializeUI();
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app');
    initializeApp();
});

// ==================== AUTHENTICATION ====================

function initializeAuth() {
    // Check if we're on login page or dashboard
    const pathname = window.location.pathname;
    const isLoginPage = pathname.includes('index.html') || pathname === '/' || pathname === '/index.html';
    const isDashboardPage = pathname.includes('dashboard.html') || pathname === '/dashboard.html' || pathname === '/dashboard';
    
    console.log('Initializing auth, window.location.pathname:', pathname);
    console.log('isLoginPage:', isLoginPage);
    console.log('isDashboardPage:', isDashboardPage);
    
    onAuthStateChanged(window.auth, (user) => {
        console.log('Auth state changed, user:', user);
        if (user) {
            currentUser = user;
            console.log('User is logged in:', user.email);
            if (isLoginPage) {
                console.log('Redirecting to dashboard');
                window.location.href = 'dashboard.html';
            } else if (isDashboardPage) {
                console.log('Initializing dashboard');
                initializeDashboard();
            } else {
                console.log('Not on login or dashboard page, redirecting to dashboard');
                window.location.href = 'dashboard.html';
            }
        } else {
            currentUser = null;
            console.log('User is not logged in');
            if (!isLoginPage) {
                console.log('Redirecting to login');
                window.location.href = 'index.html';
            }
        }
    });
}

function initializeUI() {
    console.log('Initializing UI');
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    console.log('Login form element:', loginForm);
    if (loginForm) {
        console.log('Adding submit event listener to login form');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.log('Login form not found');
    }
    
    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    console.log('Logout button element:', logoutBtn);
    if (logoutBtn) {
        console.log('Adding click event listener to logout button');
        logoutBtn.addEventListener('click', handleLogout);
    } else {
        console.log('Logout button not found');
    }
    
    // Tab navigation
    initializeTabNavigation();
    
    // Form handlers
    initializeFormHandlers();
    
    // Modal handlers
    initializeModalHandlers();
}

async function handleLogin(e) {
    e.preventDefault();
    
    console.log('Login form submitted');
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    
    console.log('Attempting login with:', email);
    
    try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';
        errorMessage.classList.add('hidden');
        
        const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
        console.log('Login successful:', userCredential.user);
        
    } catch (error) {
        console.error('Login error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        errorMessage.textContent = getErrorMessage(error.code);
        errorMessage.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i data-lucide="log-in" class="h-4 w-4 mr-2"></i>Sign In';
        lucide.createIcons();
    }
}

async function handleLogout() {
    console.log('Attempting logout');
    try {
        await signOut(window.auth);
        console.log('Logout successful');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/user-disabled':
            return 'User account has been disabled.';
        case 'auth/user-not-found':
            return 'No user found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        default:
            return 'An error occurred. Please try again.';
    }
}

// ==================== DASHBOARD INITIALIZATION ====================

function initializeDashboard() {
    // Display user email
    const userEmail = document.getElementById('userEmail');
    if (userEmail && currentUser) {
        userEmail.textContent = currentUser.email;
    }
    
    // Load data
    loadStudents();
    loadFees();
    loadBills();
    loadPayments();
    loadPaymentTracking();
    updateDashboardStats();
    
    // Initialize enhanced features
    initializeSearchAndFilters();
    initializeBillsSearch();
    renderClassStatsGrid();
    
    // Enforce user permissions
    enforcePermissions();
    
    // Initialize payment tracking after a short delay to ensure all data is loaded
    setTimeout(() => {
        if (studentsData.length > 0 || billsData.length > 0 || paymentsData.length > 0) {
            updatePaymentTracking();
            initializePaymentFilters();
        }
    }, 1000);
}

// ==================== TAB NAVIGATION ====================

function initializeTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.id.replace('Tab', 'Content');
            console.log('Tab clicked:', button.id, 'Target:', targetTab);
            
            // Remove active class from all tabs
            tabButtons.forEach(btn => {
                btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
                btn.classList.add('text-gray-500', 'border-transparent');
            });
            
            // Add active class to clicked tab
            button.classList.add('active', 'border-blue-500', 'text-blue-600');
            button.classList.remove('text-gray-500', 'border-transparent');
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.add('hidden'));
            
            // Show target tab content
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                
                // Initialize payment tracking when payments tab is opened
                if (targetTab === 'paymentsContent') {
                    console.log('Payments tab opened, initializing payment tracking...');
                    setTimeout(() => {
                        updatePaymentTracking();
                        initializePaymentFilters();
                    }, 100);
                }
                
                // Initialize bills search when bills tab is opened
                if (targetTab === 'billsContent') {
                    console.log('Bills tab opened, initializing bills search...');
                    setTimeout(() => {
                        initializeBillsSearch();
                        renderBillsGrid();
                    }, 100);
                }
            }
        });
    });
}

// ==================== FORM HANDLERS ====================

function initializeFormHandlers() {
    // Student form handlers
    const addStudentBtn = document.getElementById('addStudentBtn');
    const cancelStudentBtn = document.getElementById('cancelStudentBtn');
    const studentForm = document.getElementById('studentForm');
    
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', () => showAddStudentForm());
    }
    if (cancelStudentBtn) {
        cancelStudentBtn.addEventListener('click', () => hideAddStudentForm());
    }
    if (studentForm) {
        studentForm.addEventListener('submit', handleAddStudent);
    }
    
    // Fee form handlers
    const addFeeBtn = document.getElementById('addFeeBtn');
    const cancelFeeBtn = document.getElementById('cancelFeeBtn');
    const feeForm = document.getElementById('feeForm');
    
    if (addFeeBtn) {
        addFeeBtn.addEventListener('click', () => showAddFeeForm());
    }
    if (cancelFeeBtn) {
        cancelFeeBtn.addEventListener('click', () => hideAddFeeForm());
    }
    if (feeForm) {
        feeForm.addEventListener('submit', handleAddFee);
    }
    
    // Payment form handlers
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    const paymentForm = document.getElementById('paymentForm');
    
    if (addPaymentBtn) {
        addPaymentBtn.addEventListener('click', () => showAddPaymentForm());
    }
    if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', () => hideAddPaymentForm());
    }
    if (paymentForm) {
        paymentForm.addEventListener('submit', handleAddPayment);
    }
    
    // Export handlers
    const exportPaymentsBtn = document.getElementById('exportPaymentsBtn');
    const closeExportModal = document.getElementById('closeExportModal');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const exportForm = document.getElementById('exportForm');
    
    if (exportPaymentsBtn) {
        exportPaymentsBtn.addEventListener('click', () => showExportModal());
    }
    if (closeExportModal) {
        closeExportModal.addEventListener('click', () => hideExportModal());
    }
    if (cancelExportBtn) {
        cancelExportBtn.addEventListener('click', () => hideExportModal());
    }
    if (exportForm) {
        exportForm.addEventListener('submit', handleExportPayments);
    }
    
    // Overdue notices handler
    const sendOverdueNoticesBtn = document.getElementById('sendOverdueNoticesBtn');
    if (sendOverdueNoticesBtn) {
        sendOverdueNoticesBtn.addEventListener('click', handleSendOverdueNotices);
    }
    
    // Bills handlers
    const generateBillsBtn = document.getElementById('generateBillsBtn');
    if (generateBillsBtn) {
        generateBillsBtn.addEventListener('click', handleGenerateBills);
    }
    
    // Excel import handlers
    const importExcelBtn = document.getElementById('importExcelBtn');
    const closeExcelImportModal = document.getElementById('closeExcelImportModal');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const excelFileInput = document.getElementById('excelFileInput');
    const processImportBtn = document.getElementById('processImportBtn');
    
    if (importExcelBtn) {
        importExcelBtn.addEventListener('click', () => showExcelImportModal());
    }
    if (closeExcelImportModal) {
        closeExcelImportModal.addEventListener('click', () => hideExcelImportModal());
    }
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => hideExcelImportModal());
    }
    if (excelFileInput) {
        excelFileInput.addEventListener('change', handleExcelFileSelect);
    }
    if (processImportBtn) {
        processImportBtn.addEventListener('click', handleExcelImport);
    }
}

// ==================== STUDENT MANAGEMENT ====================

function showAddStudentForm() {
    lastFocusedElement = document.activeElement;
    document.getElementById('addStudentForm').classList.remove('hidden');
    document.getElementById('addStudentBtn').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('studentName').focus();
    }, 100);
}

function hideAddStudentForm() {
    document.getElementById('addStudentForm').classList.add('hidden');
    document.getElementById('addStudentBtn').classList.remove('hidden');
    document.getElementById('studentForm').reset();
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

async function handleAddStudent(e) {
    e.preventDefault();
    
    const name = document.getElementById('studentName').value;
    const studentClass = document.getElementById('studentClass').value;
    const rollNumber = document.getElementById('studentRoll').value;
    
    try {
        await addDoc(collection(window.db, 'students'), {
            name: name,
            class: studentClass,
            roll_number: rollNumber,
            created_at: serverTimestamp()
        });
        
        hideAddStudentForm();
        showNotification('Student added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding student:', error);
        showNotification('Error adding student. Please try again.', 'error');
    }
}

async function loadStudents() {
    try {
        const studentsCollection = collection(window.db, 'students');
        const studentsQuery = query(studentsCollection, orderBy('name'));
        
        // Real-time listener
        onSnapshot(studentsQuery, (snapshot) => {
            studentsData = [];
            snapshot.forEach((doc) => {
                studentsData.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Students data loaded:', studentsData.length);
            renderStudentsTable();
            updateDashboardStats();
            
            // Update payment tracking when students data changes
            if (paymentsData.length > 0 || billsData.length > 0) {
                updatePaymentTracking();
            }
        }, (error) => {
            console.error('Error in students listener:', error);
        });
        
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function renderStudentsTable() {
    // Initialize filtered data if filters exist, otherwise use all students
    if (document.getElementById('searchStudents')) {
        filteredStudentsData = [...studentsData];
        applyStudentFilters();
    } else {
        // Use original rendering logic when enhanced UI not available
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        studentsData.forEach(student => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.class}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.roll_number}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="deleteStudent('${student.id}')"
                            class="text-red-600 hover:text-red-900 ml-4">
                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Reinitialize icons
        lucide.createIcons();
    }
    
    // Update class stats when students change
    renderClassStatsGrid();
}

async function deleteStudent(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) {
        showNotification('Student not found.', 'error');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete ${student.name}?

This action will permanently remove:
- Student record
- All associated bills
- All payment history
- All financial records

This action cannot be undone.

Type "DELETE" to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE') {
        showNotification('Student deletion cancelled.', 'info');
        return;
    }
    
    try {
        // Delete associated payments first
        const studentPayments = paymentsData.filter(payment => payment.student_id === studentId);
        for (const payment of studentPayments) {
            await deleteDoc(doc(window.db, 'payments', payment.id));
        }
        
        // Delete associated bills
        const studentBills = billsData.filter(bill => bill.student_id === studentId);
        for (const bill of studentBills) {
            await deleteDoc(doc(window.db, 'bills', bill.id));
        }
        
        // Delete the student
        await deleteDoc(doc(window.db, 'students', studentId));
        
        showNotification(`${student.name} and all associated records deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting student:', error);
        showNotification('Error deleting student. Please try again.', 'error');
    }
}

// ==================== FEE STRUCTURE MANAGEMENT ====================

function showAddFeeForm() {
    document.getElementById('addFeeForm').classList.remove('hidden');
    document.getElementById('addFeeBtn').classList.add('hidden');
}

function hideAddFeeForm() {
    document.getElementById('addFeeForm').classList.add('hidden');
    document.getElementById('addFeeBtn').classList.remove('hidden');
    document.getElementById('feeForm').reset();
}

async function handleAddFee(e) {
    e.preventDefault();
    
    const feeName = document.getElementById('feeName').value;
    const feeAmount = parseFloat(document.getElementById('feeAmount').value);
    const isMandatory = document.getElementById('feeMandatory').value === 'true';
    const classFrom = parseInt(document.getElementById('feeClassFrom').value);
    const classTo = parseInt(document.getElementById('feeClassTo').value);
    
    // Validate class range
    if (classFrom > classTo) {
        showNotification('From Class cannot be greater than To Class.', 'error');
        return;
    }
    
    try {
        await addDoc(collection(window.db, 'fee_structure'), {
            fee_name: feeName,
            amount: feeAmount,
            is_mandatory: isMandatory,
            class_from: classFrom,
            class_to: classTo,
            created_at: serverTimestamp()
        });
        
        hideAddFeeForm();
        showNotification('Fee category added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding fee:', error);
        showNotification('Error adding fee category. Please try again.', 'error');
    }
}

async function loadFees() {
    try {
        const feesCollection = collection(window.db, 'fee_structure');
        const feesQuery = query(feesCollection, orderBy('fee_name'));
        
        // Real-time listener
        onSnapshot(feesQuery, (snapshot) => {
            feesData = [];
            snapshot.forEach((doc) => {
                feesData.push({ id: doc.id, ...doc.data() });
            });
            
            renderFeesTable();
            updateDashboardStats();
        });
        
    } catch (error) {
        console.error('Error loading fees:', error);
    }
}

function renderFeesTable() {
    const tbody = document.getElementById('feesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Filter fees based on current filters
    let filteredFees = [...feesData];
    
    if (currentFeeFilters.class) {
        if (currentFeeFilters.class.includes('-')) {
            // Range filter (e.g., "1-5", "6-8")
            const [from, to] = currentFeeFilters.class.split('-').map(Number);
            filteredFees = filteredFees.filter(fee => {
                const feeFrom = fee.class_from || 1;
                const feeTo = fee.class_to || 12;
                return (feeFrom <= to && feeTo >= from);
            });
        } else {
            // Single class filter
            const targetClass = parseInt(currentFeeFilters.class);
            filteredFees = filteredFees.filter(fee => {
                const feeFrom = fee.class_from || 1;
                const feeTo = fee.class_to || 12;
                return (targetClass >= feeFrom && targetClass <= feeTo);
            });
        }
    }
    
    if (currentFeeFilters.type !== '') {
        const isMandatory = currentFeeFilters.type === 'true';
        filteredFees = filteredFees.filter(fee => fee.is_mandatory === isMandatory);
    }
    
    filteredFees.forEach(fee => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        const classRange = fee.class_from && fee.class_to
            ? `Class ${fee.class_from}${fee.class_from === fee.class_to ? '' : ` - ${fee.class_to}`}`
            : 'All Classes';
            
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${fee.fee_name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹${fee.amount.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    fee.is_mandatory ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }">
                    ${fee.is_mandatory ? 'Mandatory' : 'Optional'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${classRange}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="deleteFee('${fee.id}')"
                        class="text-red-600 hover:text-red-900 ml-4">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

async function deleteFee(feeId) {
    if (confirm('Are you sure you want to delete this fee category?')) {
        try {
            await deleteDoc(doc(window.db, 'fee_structure', feeId));
            showNotification('Fee category deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting fee:', error);
            showNotification('Error deleting fee category. Please try again.', 'error');
        }
    }
}

// ==================== BILL GENERATION ====================

async function handleGenerateBills() {
    const generateBtn = document.getElementById('generateBillsBtn');
    const originalText = generateBtn.innerHTML;
    
    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i data-lucide="loader" class="h-4 w-4 mr-2 inline animate-spin"></i>Generating...';
        
        for (const student of studentsData) {
            // Check if bill already exists for this student
            const existingBills = billsData.filter(bill => bill.student_id === student.id);
            
            if (existingBills.length === 0) {
                // Get applicable fees for this student's class
                const studentClass = parseInt(student.class);
                const applicableFees = feesData.filter(fee => {
                    if (!fee.is_mandatory) return false; // Only mandatory fees for auto-generation
                    
                    const feeFrom = fee.class_from || 1;
                    const feeTo = fee.class_to || 12;
                    
                    return studentClass >= feeFrom && studentClass <= feeTo;
                });
                
                const totalAmount = applicableFees.reduce((sum, fee) => sum + fee.amount, 0);
                
                if (applicableFees.length > 0) {
                    await addDoc(collection(window.db, 'bills'), {
                        student_id: student.id,
                        student_name: student.name,
                        student_class: student.class,
                        student_roll: student.roll_number,
                        fee_breakdown: applicableFees.map(fee => ({
                            fee_name: fee.fee_name,
                            amount: fee.amount
                        })),
                        total_amount: totalAmount,
                        bill_date: serverTimestamp(),
                        status: 'unpaid'
                    });
                }
            }
        }
        
        showNotification('Bills generated successfully with class-specific fees!', 'success');
        
    } catch (error) {
        console.error('Error generating bills:', error);
        showNotification('Error generating bills. Please try again.', 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

async function loadBills() {
    try {
        const billsCollection = collection(window.db, 'bills');
        const billsQuery = query(billsCollection, orderBy('bill_date', 'desc'));
        
        // Real-time listener
        onSnapshot(billsQuery, (snapshot) => {
            billsData = [];
            snapshot.forEach((doc) => {
                billsData.push({ id: doc.id, ...doc.data() });
            });
            
            renderBillsGrid();
            updateDashboardStats();
        });
        
    } catch (error) {
        console.error('Error loading bills:', error);
    }
}

function renderBillsGrid() {
    // Initialize filtered data if filters exist, otherwise use all bills
    if (document.getElementById('searchBills')) {
        filteredBillsData = [...billsData];
        applyBillFilters();
    } else {
        renderAllBills();
    }
}

function renderAllBills() {
    const grid = document.getElementById('billsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (billsData.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i data-lucide="file-text" class="h-16 w-16 text-gray-300 mx-auto mb-4"></i>
                <p class="text-gray-500">No bills generated yet. Click "Generate Bills" to create bills for all students.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    billsData.forEach(bill => {
        renderBillCard(bill, grid);
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

function applyBillFilters() {
    filteredBillsData = [...billsData];
    
    // Apply search filter
    if (currentBillFilters.search) {
        const searchTerm = currentBillFilters.search.toLowerCase();
        filteredBillsData = filteredBillsData.filter(bill =>
            bill.student_name.toLowerCase().includes(searchTerm) ||
            bill.total_amount.toString().includes(searchTerm) ||
            bill.student_class.toString().includes(searchTerm) ||
            bill.student_roll.toString().includes(searchTerm)
        );
    }
    
    // Apply class filter
    if (currentBillFilters.class) {
        filteredBillsData = filteredBillsData.filter(bill =>
            bill.student_class === currentBillFilters.class
        );
    }
    
    // Apply status filter
    if (currentBillFilters.status) {
        filteredBillsData = filteredBillsData.filter(bill =>
            bill.status === currentBillFilters.status
        );
    }
    
    // Apply sorting
    filteredBillsData.sort((a, b) => {
        switch (currentBillFilters.sort) {
            case 'name':
                return a.student_name.localeCompare(b.student_name);
            case 'amount':
                return b.total_amount - a.total_amount;
            case 'date':
                const aDate = a.bill_date ? new Date(a.bill_date.seconds * 1000) : new Date(0);
                const bDate = b.bill_date ? new Date(b.bill_date.seconds * 1000) : new Date(0);
                return bDate - aDate;
            case 'status':
                return a.status.localeCompare(b.status);
            default:
                return 0;
        }
    });
    
    renderFilteredBillsGrid();
    updateFilteredBillsCount();
    updateBillsFilterInfo();
}

function renderFilteredBillsGrid() {
    const grid = document.getElementById('billsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (filteredBillsData.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i data-lucide="search" class="h-16 w-16 text-gray-300 mx-auto mb-4"></i>
                <p class="text-gray-500">No bills found matching your search criteria.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    filteredBillsData.forEach(bill => {
        renderBillCard(bill, grid);
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

function renderBillCard(bill, grid) {
    // Calculate pending due balance by subtracting payments from total bill amount
    const studentPayments = paymentsData.filter(payment => payment.student_id === bill.student_id);
    const totalPaid = studentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingDue = Math.max(0, bill.total_amount - totalPaid);
    
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-lg p-6 hover-card';
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h4 class="text-lg font-semibold text-gray-900">${bill.student_name}</h4>
                <p class="text-sm text-gray-600">Class: ${bill.student_class} | Roll: ${bill.student_roll}</p>
            </div>
            <span class="status-${bill.status}">${bill.status.toUpperCase()}</span>
        </div>
        
        <div class="mb-4">
            <p class="text-2xl font-bold text-gray-900">₹${pendingDue.toLocaleString()}</p>
            <p class="text-sm text-gray-600">
                Pending Due Balance
            </p>
            <p class="text-xs text-gray-500">
                Total: ₹${bill.total_amount.toLocaleString()} | Paid: ₹${totalPaid.toLocaleString()}
            </p>
            <p class="text-xs text-gray-500">
                Bill Date: ${formatDate(bill.bill_date)}
            </p>
        </div>
        
        <div class="flex space-x-2">
            <button onclick="showReceipt('${bill.id}')"
                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                <i data-lucide="printer" class="h-4 w-4 mr-1 inline"></i>
                Receipt
            </button>
            <button onclick="toggleBillStatus('${bill.id}', '${bill.status}')"
                    class="flex-1 ${bill.status === 'paid' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-md text-sm font-medium">
                ${bill.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
            </button>
            <button onclick="deleteBill('${bill.id}')"
                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium">
                <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
        </div>
    `;
    grid.appendChild(card);
}

function updateFilteredBillsCount() {
    const countEl = document.getElementById('filteredBillsCount');
    if (countEl) {
        const count = filteredBillsData ? filteredBillsData.length : billsData.length;
        countEl.textContent = count.toString();
    }
}

function updateBillsFilterInfo() {
    const infoEl = document.getElementById('billsFilterInfo');
    if (infoEl) {
        let infoText = '';
        if (currentBillFilters.class) {
            infoText += `Class: ${currentBillFilters.class}`;
        }
        if (currentBillFilters.status) {
            infoText += `${infoText ? ', ' : ''}Status: ${currentBillFilters.status}`;
        }
        infoEl.textContent = infoText ? `(${infoText})` : '';
    }
}

function initializeBillsSearch() {
    // Bills search and filters
    const searchInput = document.getElementById('searchBills');
    const classFilter = document.getElementById('filterBillsByClass');
    const statusFilter = document.getElementById('filterBillsByStatus');
    const sortSelect = document.getElementById('sortBills');
    const clearFiltersBtn = document.getElementById('clearBillFilters');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleBillsSearch);
    }
    if (classFilter) {
        classFilter.addEventListener('change', handleBillsClassFilter);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', handleBillsStatusFilter);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', handleBillsSort);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearBillsFilters);
    }
}

function handleBillsSearch() {
    currentBillFilters.search = document.getElementById('searchBills').value.toLowerCase();
    applyBillFilters();
}

function handleBillsClassFilter() {
    currentBillFilters.class = document.getElementById('filterBillsByClass').value;
    applyBillFilters();
}

function handleBillsStatusFilter() {
    currentBillFilters.status = document.getElementById('filterBillsByStatus').value;
    applyBillFilters();
}

function handleBillsSort() {
    currentBillFilters.sort = document.getElementById('sortBills').value;
    applyBillFilters();
}

function clearBillsFilters() {
    currentBillFilters = { search: '', class: '', status: '', sort: 'name' };
    document.getElementById('searchBills').value = '';
    document.getElementById('filterBillsByClass').value = '';
    document.getElementById('filterBillsByStatus').value = '';
    document.getElementById('sortBills').value = 'name';
    applyBillFilters();
}



async function deleteBill(billId) {
    const bill = billsData.find(b => b.id === billId);
    if (!bill) {
        showNotification('Bill not found.', 'error');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete the bill for ${bill.student_name} (₹${bill.total_amount.toLocaleString()})?
    
This action cannot be undone and will permanently remove:
- The bill record
- All associated payment history
- Fee breakdown information

Type "DELETE" to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE') {
        showNotification('Bill deletion cancelled.', 'info');
        return;
    }
    
    try {
        // Delete associated payments first
        const associatedPayments = paymentsData.filter(payment => payment.student_id === bill.student_id);
        
        for (const payment of associatedPayments) {
            await deleteDoc(doc(window.db, 'payments', payment.id));
        }
        
        // Delete the bill
        await deleteDoc(doc(window.db, 'bills', billId));
        
        showNotification(`Bill for ${bill.student_name} deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting bill:', error);
        showNotification('Error deleting bill. Please try again.', 'error');
    }
}

async function toggleBillStatus(billId, currentStatus) {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    
    try {
        await updateDoc(doc(window.db, 'bills', billId), {
            status: newStatus
        });
        
        showNotification(`Bill marked as ${newStatus}!`, 'success');
        
    } catch (error) {
        console.error('Error updating bill status:', error);
        showNotification('Error updating bill status. Please try again.', 'error');
    }
}

// ==================== RECEIPT FUNCTIONALITY ====================

function initializeModalHandlers() {
    const closeModalBtn = document.getElementById('closeReceiptModal');
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideReceiptModal);
    }
    
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', printReceipt);
    }
}

function showReceipt(billId) {
    const bill = billsData.find(b => b.id === billId);
    if (!bill) return;
    
    const receiptContent = document.getElementById('receiptContent');
    receiptContent.innerHTML = generateReceiptHTML(bill);
    
    document.getElementById('receiptModal').classList.remove('hidden');
    lucide.createIcons();
}

function hideReceiptModal() {
    document.getElementById('receiptModal').classList.add('hidden');
}

function generateReceiptHTML(bill) {
    return `
        <div class="receipt-preview">
            <div class="receipt-header">
                <div class="receipt-school-name">Gyanodaya Ma. Vi.</div>
                <div>Patthargadhawa, Deukhuri, Dang</div>
                <div>Phone: +9779806206072</div>
                <br>
                <div class="receipt-title">FEE RECEIPT</div>
            </div>
            
            <div class="receipt-details">
                <div class="receipt-info-row">
                    <span><strong>Receipt No:</strong></span>
                    <span>${bill.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div class="receipt-info-row">
                    <span><strong>Date:</strong></span>
                    <span>${formatDate(bill.bill_date)}</span>
                </div>
                <div class="receipt-info-row">
                    <span><strong>Student Name:</strong></span>
                    <span>${bill.student_name}</span>
                </div>
                <div class="receipt-info-row">
                    <span><strong>Class:</strong></span>
                    <span>${bill.student_class}</span>
                </div>
                <div class="receipt-info-row">
                    <span><strong>Roll Number:</strong></span>
                    <span>${bill.student_roll}</span>
                </div>
            </div>
            
            <table class="fee-breakdown-table">
                <thead>
                    <tr>
                        <th>Fee Description</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.fee_breakdown.map(fee => `
                        <tr>
                            <td>${fee.fee_name}</td>
                            <td style="text-align: right;">₹${fee.amount.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td><strong>TOTAL AMOUNT</strong></td>
                        <td style="text-align: right;"><strong>₹${bill.total_amount.toLocaleString()}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: center;">
                <p><strong>Status: ${bill.status.toUpperCase()}</strong></p>
                <br>
                <p>Thank you for your payment!</p>
            </div>
        </div>
    `;
}

function printReceipt() {
    window.print();
}

// ==================== PAYMENT TRACKING MANAGEMENT ====================

async function loadPayments() {
    try {
        const paymentsCollection = collection(window.db, 'payments');
        const paymentsQuery = query(paymentsCollection, orderBy('payment_date', 'desc'));
        
        // Real-time listener
        onSnapshot(paymentsQuery, (snapshot) => {
            paymentsData = [];
            snapshot.forEach((doc) => {
                paymentsData.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Payments data loaded:', paymentsData.length);
            updatePaymentTracking();
            updateDashboardStats();
        }, (error) => {
            console.error('Error in payments listener:', error);
        });
        
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

async function loadPaymentTracking() {
    // This function will be called when students, bills, and payments are loaded
    // to calculate and render the payment tracking dashboard
    updatePaymentTracking();
}

function updatePaymentTracking() {
    try {
        console.log('Starting payment tracking update...');
        console.log('Students data:', studentsData.length);
        console.log('Bills data:', billsData.length);
        console.log('Payments data:', paymentsData.length);
        
        // Calculate payment tracking data for each student
        paymentTrackingData = [];
        
        if (studentsData.length === 0) {
            console.log('No students data available');
            renderPaymentTrackingTable();
            updatePaymentSummaryCards();
            return;
        }
        
        // Get active student IDs for filtering orphaned data
        const activeStudentIds = studentsData.map(student => student.id);
        
        // Filter out orphaned bills and payments for deleted students
        const activeBills = billsData.filter(bill => activeStudentIds.includes(bill.student_id));
        const activePayments = paymentsData.filter(payment => activeStudentIds.includes(payment.student_id));
        
        // Clean up orphaned data if found
        const orphanedBills = billsData.filter(bill => !activeStudentIds.includes(bill.student_id));
        const orphanedPayments = paymentsData.filter(payment => !activeStudentIds.includes(payment.student_id));
        
        // Log orphaned data for debugging and clean up automatically
        if (orphanedBills.length > 0 || orphanedPayments.length > 0) {
            console.warn(`Found orphaned data: ${orphanedBills.length} bills, ${orphanedPayments.length} payments`);
            cleanupOrphanedData(orphanedBills, orphanedPayments);
        }
        
        studentsData.forEach(student => {
            // Find student's bills and payments (using filtered active data)
            const studentBills = activeBills.filter(bill => bill.student_id === student.id);
            const studentPayments = activePayments.filter(payment => payment.student_id === student.id);
            
            // Calculate totals
            const totalDue = studentBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
            const totalPaid = studentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            const amountDue = Math.max(0, totalDue - totalPaid);
            
            // Determine payment status
            let status = 'pending';
            if (totalPaid >= totalDue && totalDue > 0) {
                status = 'paid_full';
            } else if (totalPaid > 0 && totalPaid < totalDue) {
                status = 'partial_payment';
            } else if (totalDue > 0 && isOverdue(studentBills)) {
                status = 'overdue';
            }
            
            // Get last payment info
            const lastPayment = studentPayments.length > 0 ? studentPayments[0] : null;
            
            paymentTrackingData.push({
                student_id: student.id,
                student_name: student.name,
                student_class: student.class,
                student_roll: student.roll_number,
                total_due: totalDue,
                total_paid: totalPaid,
                amount_due: amountDue,
                payment_status: status,
                last_payment: lastPayment,
                payment_count: studentPayments.length,
                bills: studentBills,
                payments: studentPayments
            });
        });
        
        console.log('Payment tracking data generated:', paymentTrackingData.length, 'records');
        renderPaymentTrackingTable();
        updatePaymentSummaryCards();
        
    } catch (error) {
        console.error('Error in updatePaymentTracking:', error);
        showNotification('Error updating payment tracking data', 'error');
    }
}

async function cleanupOrphanedData(orphanedBills, orphanedPayments) {
    try {
        // Clean up orphaned payments
        for (const payment of orphanedPayments) {
            await deleteDoc(doc(window.db, 'payments', payment.id));
            console.log(`Cleaned up orphaned payment: ${payment.id}`);
        }
        
        // Clean up orphaned bills
        for (const bill of orphanedBills) {
            await deleteDoc(doc(window.db, 'bills', bill.id));
            console.log(`Cleaned up orphaned bill: ${bill.id}`);
        }
        
        if (orphanedBills.length > 0 || orphanedPayments.length > 0) {
            showNotification(`Cleaned up ${orphanedBills.length} orphaned bills and ${orphanedPayments.length} orphaned payments`, 'info');
        }
        
    } catch (error) {
        console.error('Error cleaning up orphaned data:', error);
    }
}

function isOverdue(bills) {
    // Check if any bill is overdue (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return bills.some(bill => {
        if (bill.bill_date && bill.bill_date.seconds) {
            const billDate = new Date(bill.bill_date.seconds * 1000);
            return billDate < thirtyDaysAgo && bill.status === 'unpaid';
        }
        return false;
    });
}

function showAddPaymentForm() {
    // Populate student dropdown
    const studentSelect = document.getElementById('paymentStudentId');
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Select Student</option>';
        
        studentsData.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.name} (Class ${student.class}, Roll ${student.roll_number})`;
            studentSelect.appendChild(option);
        });
        
        // Add event listener to populate fee names when student is selected
        studentSelect.addEventListener('change', populateFeeNames);
    }
    
    // Set today's date as default
    const paymentDateInput = document.getElementById('paymentDate');
    if (paymentDateInput) {
        const today = new Date().toISOString().split('T')[0];
        paymentDateInput.value = today;
    }
    
    const addPaymentForm = document.getElementById('addPaymentForm');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    if (addPaymentForm && addPaymentBtn) {
        addPaymentForm.classList.remove('hidden');
        addPaymentBtn.classList.add('hidden');
    }
}

function populateFeeNames() {
    const studentId = document.getElementById('paymentStudentId').value;
    const feeNameSelect = document.getElementById('feeNameSelect');
    
    if (!studentId || !feeNameSelect) {
        return;
    }
    
    // Clear existing options
    feeNameSelect.innerHTML = '<option value="">Select Fee Name</option>';
    
    // Find the selected student
    const student = studentsData.find(s => s.id === studentId);
    if (!student) {
        return;
    }
    
    const studentClass = parseInt(student.class);
    
    // Filter fees applicable to this student's class
    const applicableFees = feesData.filter(fee => {
        const feeFrom = fee.class_from || 1;
        const feeTo = fee.class_to || 12;
        return studentClass >= feeFrom && studentClass <= feeTo;
    });
    
    // Populate fee dropdown
    applicableFees.forEach(fee => {
        const option = document.createElement('option');
        option.value = fee.fee_name;
        option.textContent = `${fee.fee_name} (₹${fee.amount.toLocaleString()})`;
        feeNameSelect.appendChild(option);
    });
    
    if (applicableFees.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No fees available for this class';
        option.disabled = true;
        feeNameSelect.appendChild(option);
    }
}

function hideAddPaymentForm() {
    const addPaymentForm = document.getElementById('addPaymentForm');
    const addPaymentBtn = document.getElementById('addPaymentBtn');
    const paymentForm = document.getElementById('paymentForm');
    
    if (addPaymentForm && addPaymentBtn) {
        addPaymentForm.classList.add('hidden');
        addPaymentBtn.classList.remove('hidden');
    }
    if (paymentForm) {
        paymentForm.reset();
    }
}

async function handleAddPayment(e) {
    e.preventDefault();
    
    const studentId = document.getElementById('paymentStudentId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const feeName = document.getElementById('feeNameSelect').value;
    const reference = document.getElementById('paymentReference').value;
    const paymentDate = new Date(document.getElementById('paymentDate').value);
    
    // Find student details
    const student = studentsData.find(s => s.id === studentId);
    if (!student) {
        showNotification('Please select a valid student.', 'error');
        return;
    }
    
    // Validate fee selection
    if (!feeName) {
        showNotification('Please select a fee name.', 'error');
        return;
    }
    
    try {
        // Add payment to database
        await addDoc(collection(window.db, 'payments'), {
            student_id: studentId,
            student_name: student.name,
            student_class: student.class,
            student_roll: student.roll_number,
            amount: amount,
            fee_name: feeName,
            reference_number: reference,
            payment_date: paymentDate,
            created_at: serverTimestamp()
        });
        
        // Update bill status if payment covers the bill
        const studentBills = billsData.filter(bill => bill.student_id === studentId && bill.status === 'unpaid');
        let remainingAmount = amount;
        
        for (const bill of studentBills) {
            if (remainingAmount >= bill.total_amount) {
                await updateDoc(doc(window.db, 'bills', bill.id), {
                    status: 'paid',
                    paid_date: serverTimestamp()
                });
                remainingAmount -= bill.total_amount;
            } else if (remainingAmount > 0) {
                // Partial payment - mark as partially paid
                await updateDoc(doc(window.db, 'bills', bill.id), {
                    status: 'partial',
                    partial_amount: remainingAmount,
                    last_payment_date: serverTimestamp()
                });
                remainingAmount = 0;
            }
            
            if (remainingAmount <= 0) break;
        }
        
        hideAddPaymentForm();
        showNotification('Payment added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding payment:', error);
        showNotification('Error adding payment. Please try again.', 'error');
    }
}

function renderPaymentTrackingTable() {
    console.log('Rendering payment tracking table...', paymentTrackingData.length, 'records');
    
    // Check if payment tracking data exists
    if (!paymentTrackingData || paymentTrackingData.length === 0) {
        console.log('No payment tracking data available');
        const tbody = document.getElementById('paymentsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                        <i data-lucide="credit-card" class="h-8 w-8 mx-auto mb-2"></i>
                        <p>No payment data available. Add some students and generate bills first.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
        }
        return;
    }
    
    // Apply filters first
    filteredPaymentsData = [...paymentTrackingData];
    applyPaymentFilters();
}

function applyPaymentFilters() {
    filteredPaymentsData = [...paymentTrackingData];
    
    // Apply search filter
    if (currentPaymentFilters.search) {
        const searchTerm = currentPaymentFilters.search.toLowerCase();
        filteredPaymentsData = filteredPaymentsData.filter(item =>
            item.student_name.toLowerCase().includes(searchTerm) ||
            item.student_id.toLowerCase().includes(searchTerm) ||
            item.total_due.toString().includes(searchTerm) ||
            item.total_paid.toString().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (currentPaymentFilters.status) {
        filteredPaymentsData = filteredPaymentsData.filter(item =>
            item.payment_status === currentPaymentFilters.status
        );
    }
    
    // Apply class filter
    if (currentPaymentFilters.class) {
        filteredPaymentsData = filteredPaymentsData.filter(item =>
            item.student_class === currentPaymentFilters.class
        );
    }
    
    // Apply sorting
    filteredPaymentsData.sort((a, b) => {
        switch (currentPaymentFilters.sort) {
            case 'name':
                return a.student_name.localeCompare(b.student_name);
            case 'amount_due':
                return b.amount_due - a.amount_due;
            case 'last_payment':
                const aDate = a.last_payment ? safeDate(a.last_payment.payment_date) || new Date(0) : new Date(0);
                const bDate = b.last_payment ? safeDate(b.last_payment.payment_date) || new Date(0) : new Date(0);
                return bDate - aDate;
            case 'status':
                return a.payment_status.localeCompare(b.payment_status);
            default:
                return 0;
        }
    });
    
    renderFilteredPaymentTrackingTable();
    updateFilteredPaymentCount();
}

function renderFilteredPaymentTrackingTable() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredPaymentsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    <i data-lucide="search" class="h-8 w-8 mx-auto mb-2"></i>
                    <p>No payment records found matching your criteria.</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    filteredPaymentsData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        // Status badge styling
        const statusConfig = {
            'paid_full': { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid in Full' },
            'partial_payment': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial Payment' },
            'overdue': { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue' },
            'pending': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Pending' }
        };
        
        const status = statusConfig[item.payment_status] || statusConfig.pending;
        
        row.innerHTML = `
            <td class="px-6 py-4">
                <div>
                    <div class="text-sm font-medium text-gray-900">${item.student_name}</div>
                    <div class="text-sm text-gray-500">Class ${item.student_class} • Roll ${item.student_roll}</div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.bg} ${status.text}">
                    ${status.label}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">₹${item.amount_due.toLocaleString()}</div>
                <div class="text-sm text-gray-500">of ₹${item.total_due.toLocaleString()}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">₹${item.total_paid.toLocaleString()}</div>
                <div class="text-sm text-gray-500">${item.payment_count} payment${item.payment_count !== 1 ? 's' : ''}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">
                    ${item.last_payment ?
                        `${formatDate(item.last_payment.payment_date)}<br>
                         <span class="text-gray-500">${item.last_payment.fee_name || 'Fee not specified'}</span>` :
                        'No payments'
                    }
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex space-x-2">
                    <button onclick="showPaymentHistory('${item.student_id}')"
                            class="text-blue-600 hover:text-blue-900 text-sm">
                        <i data-lucide="history" class="h-4 w-4 mr-1 inline"></i>
                        History
                    </button>
                    <button onclick="showAddPaymentForStudent('${item.student_id}')"
                            class="text-green-600 hover:text-green-900 text-sm">
                        <i data-lucide="plus-circle" class="h-4 w-4 mr-1 inline"></i>
                        Add Payment
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

function updatePaymentSummaryCards() {
    console.log('Updating payment summary cards...');
    
    // Total collected
    const totalCollected = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const totalCollectedEl = document.getElementById('totalPaymentsCollected');
    if (totalCollectedEl) {
        totalCollectedEl.textContent = `₹${totalCollected.toLocaleString()}`;
        console.log('Updated total collected:', totalCollected);
    } else {
        console.warn('totalPaymentsCollected element not found');
    }
    
    // Total outstanding
    const totalOutstanding = paymentTrackingData.reduce((sum, item) => sum + Math.max(0, item.amount_due || 0), 0);
    const totalOutstandingEl = document.getElementById('totalOutstanding');
    if (totalOutstandingEl) {
        totalOutstandingEl.textContent = `₹${totalOutstanding.toLocaleString()}`;
        console.log('Updated total outstanding:', totalOutstanding);
    } else {
        console.warn('totalOutstanding element not found');
    }
    
    // Overdue count
    const overdueCount = paymentTrackingData.filter(item => item.payment_status === 'overdue').length;
    const overdueCountEl = document.getElementById('overdueCount');
    if (overdueCountEl) {
        overdueCountEl.textContent = overdueCount.toString();
        console.log('Updated overdue count:', overdueCount);
    } else {
        console.warn('overdueCount element not found');
    }
    
    // Collection rate
    const totalDue = paymentTrackingData.reduce((sum, item) => sum + (item.total_due || 0), 0);
    const collectionRate = totalDue > 0 ? ((totalCollected / totalDue) * 100).toFixed(1) : 0;
    const collectionRateEl = document.getElementById('collectionRate');
    if (collectionRateEl) {
        collectionRateEl.textContent = `${collectionRate}%`;
        console.log('Updated collection rate:', collectionRate);
    } else {
        console.warn('collectionRate element not found');
    }
    
    console.log('Payment summary cards update completed');
}

function updateFilteredPaymentCount() {
    const countEl = document.getElementById('filteredPaymentCount');
    if (countEl) {
        countEl.textContent = filteredPaymentsData.length.toString();
    }
}

function showPaymentHistory(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    const payments = paymentsData.filter(p => p.student_id === studentId);
    
    if (!student) return;
    
    const modal = document.getElementById('paymentHistoryModal');
    const content = document.getElementById('paymentHistoryContent');
    
    if (!modal || !content) return;
    
    if (payments.length === 0) {
        content.innerHTML = `
            <div class="text-center py-8">
                <i data-lucide="credit-card" class="h-16 w-16 text-gray-300 mx-auto mb-4"></i>
                <p class="text-gray-500">No payment history found for ${student.name}</p>
            </div>
        `;
    } else {
        // Group payments by fee name and calculate totals
        const feeWisePayments = {};
        let totalPaid = 0;
        
        payments.forEach(payment => {
            const feeName = payment.fee_name || 'Fee not specified';
            if (!feeWisePayments[feeName]) {
                feeWisePayments[feeName] = {
                    totalAmount: 0,
                    paymentCount: 0,
                    payments: []
                };
            }
            feeWisePayments[feeName].totalAmount += payment.amount;
            feeWisePayments[feeName].paymentCount += 1;
            feeWisePayments[feeName].payments.push(payment);
            totalPaid += payment.amount;
        });
        
        // Generate fee-wise summary HTML
        const feeSummaryHTML = Object.entries(feeWisePayments)
            .sort((a, b) => b[1].totalAmount - a[1].totalAmount) // Sort by amount descending
            .map(([feeName, feeData]) => `
                <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                        <span class="font-medium text-gray-900">${feeName}</span>
                        <span class="text-sm text-gray-500 ml-2">(${feeData.paymentCount} payment${feeData.paymentCount > 1 ? 's' : ''})</span>
                    </div>
                    <span class="font-semibold text-green-600">₹${feeData.totalAmount.toLocaleString()}</span>
                </div>
            `).join('');
        
        content.innerHTML = `
            <div class="mb-6">
                <h4 class="font-medium text-gray-900">${student.name}</h4>
                <p class="text-sm text-gray-600">Class ${student.class} • Roll ${student.roll_number}</p>
            </div>
            
            <!-- Fee-wise Payment Summary -->
            <div class="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h5 class="font-medium text-green-800 mb-3 flex items-center">
                    <i data-lucide="pie-chart" class="h-4 w-4 mr-2"></i>
                    Fee-wise Payment Summary
                </h5>
                <div class="space-y-1">
                    ${feeSummaryHTML}
                </div>
                <div class="mt-3 pt-3 border-t border-green-300">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-green-800">Total Paid:</span>
                        <span class="font-bold text-green-800 text-lg">₹${totalPaid.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <!-- Individual Payment History -->
            <div class="mb-4">
                <h5 class="font-medium text-gray-800 mb-3 flex items-center">
                    <i data-lucide="clock" class="h-4 w-4 mr-2"></i>
                    Payment History (${payments.length} transaction${payments.length > 1 ? 's' : ''})
                </h5>
            </div>
            <div class="space-y-4 max-h-64 overflow-y-auto">
                ${payments.map(payment => `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="font-medium text-gray-900">₹${payment.amount.toLocaleString()}</div>
                                <div class="text-sm text-gray-600">${payment.fee_name || 'Fee not specified'}</div>
                                ${payment.reference_number ? `<div class="text-sm text-gray-500">Ref: ${payment.reference_number}</div>` : ''}
                            </div>
                            <div class="text-right">
                                <div class="text-sm text-gray-900">${formatDate(payment.payment_date)}</div>
                                <div class="text-xs text-gray-500">${formatDate(payment.created_at, {time: true})}</div>
                                <div class="mt-2 flex space-x-2">
                                    <button onclick="editPayment('${payment.id}')"
                                            class="text-blue-600 hover:text-blue-800 text-xs">
                                        <i data-lucide="edit" class="h-4 w-4 mr-1 inline"></i>
                                        Edit
                                    </button>
                                    <button onclick="deletePayment('${payment.id}')"
                                            class="text-red-600 hover:text-red-800 text-xs">
                                        <i data-lucide="trash-2" class="h-4 w-4 mr-1 inline"></i>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function showAddPaymentForStudent(studentId) {
    showAddPaymentForm();
    const paymentStudentSelect = document.getElementById('paymentStudentId');
    if (paymentStudentSelect) {
        paymentStudentSelect.value = studentId;
    }
}

function showExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function handleExportPayments(e) {
    e.preventDefault();
    
    const format = document.getElementById('exportFormat').value;
    const reportType = document.getElementById('reportType').value;
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;
    
    try {
        if (format === 'csv') {
            await exportToCSV(reportType, fromDate, toDate);
        } else {
            await exportToPDF(reportType, fromDate, toDate);
        }
        
        hideExportModal();
        showNotification('Report exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting report:', error);
        showNotification('Error exporting report. Please try again.', 'error');
    }
}

async function exportToCSV(reportType, fromDate, toDate) {
    let data = [];
    let filename = `payment_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    
    switch (reportType) {
        case 'summary':
            data = paymentTrackingData.map(item => ({
                'Student Name': item.student_name,
                'Class': item.student_class,
                'Roll Number': item.student_roll,
                'Total Due': item.total_due,
                'Total Paid': item.total_paid,
                'Amount Outstanding': item.amount_due,
                'Payment Status': item.payment_status,
                'Payment Count': item.payment_count,
                'Last Payment Date': item.last_payment ? formatDate(item.last_payment.payment_date) : 'N/A'
            }));
            break;
            
        case 'detailed':
            data = paymentsData.map(payment => ({
                'Student Name': payment.student_name,
                'Class': payment.student_class,
                'Roll Number': payment.student_roll,
                'Amount': payment.amount,
                'Fee Name': payment.fee_name || 'Not specified',
                'Reference Number': payment.reference_number || '',
                'Payment Date': formatDate(payment.payment_date),
                'Created Date': formatDate(payment.created_at)
            }));
            break;
            
        case 'overdue':
            data = paymentTrackingData
                .filter(item => item.payment_status === 'overdue')
                .map(item => ({
                    'Student Name': item.student_name,
                    'Class': item.student_class,
                    'Roll Number': item.student_roll,
                    'Amount Due': item.amount_due,
                    'Days Overdue': Math.floor((new Date() - new Date(item.bills[0]?.bill_date?.seconds * 1000)) / (1000 * 60 * 60 * 24))
                }));
            break;
            
        case 'class_wise':
            const classSummary = {};
            paymentTrackingData.forEach(item => {
                if (!classSummary[item.student_class]) {
                    classSummary[item.student_class] = {
                        students: 0,
                        totalDue: 0,
                        totalPaid: 0,
                        outstanding: 0
                    };
                }
                classSummary[item.student_class].students++;
                classSummary[item.student_class].totalDue += item.total_due;
                classSummary[item.student_class].totalPaid += item.total_paid;
                classSummary[item.student_class].outstanding += item.amount_due;
            });
            
            data = Object.entries(classSummary).map(([className, summary]) => ({
                'Class': className,
                'Total Students': summary.students,
                'Total Due': summary.totalDue,
                'Total Collected': summary.totalPaid,
                'Outstanding': summary.outstanding,
                'Collection Rate': summary.totalDue > 0 ? ((summary.totalPaid / summary.totalDue) * 100).toFixed(2) + '%' : '0%'
            }));
            break;
    }
    
    // Convert to CSV
    if (data.length === 0) {
        throw new Error('No data available for export');
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

async function exportToPDF(reportType, fromDate, toDate) {
    // For PDF export, we'll create a simple HTML report and use browser print
    let reportHtml = `
        <html>
        <head>
            <title>Payment Report - ${reportType}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>Payment Report - ${reportType.replace('_', ' ').toUpperCase()}</h1>
            <div class="summary">
                <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Students:</strong> ${paymentTrackingData.length}</p>
                <p><strong>Total Collected:</strong> ₹${paymentsData.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
                <p><strong>Total Outstanding:</strong> ₹${paymentTrackingData.reduce((sum, item) => sum + Math.max(0, item.amount_due), 0).toLocaleString()}</p>
            </div>
    `;
    
    // Add table based on report type
    switch (reportType) {
        case 'summary':
            reportHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Class</th>
                            <th>Total Due</th>
                            <th>Total Paid</th>
                            <th>Outstanding</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentTrackingData.map(item => `
                            <tr>
                                <td>${item.student_name}</td>
                                <td>${item.student_class}</td>
                                <td>₹${item.total_due.toLocaleString()}</td>
                                <td>₹${item.total_paid.toLocaleString()}</td>
                                <td>₹${item.amount_due.toLocaleString()}</td>
                                <td>${item.payment_status.replace('_', ' ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            break;
    }
    
    reportHtml += `
        </body>
        </html>
    `;
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.print();
}

async function handleSendOverdueNotices() {
    const overduePayments = paymentTrackingData.filter(item => item.payment_status === 'overdue');
    
    if (overduePayments.length === 0) {
        showNotification('No overdue payments found.', 'info');
        return;
    }
    
    try {
        // In a real application, this would send actual notifications
        // For now, we'll show a success message
        showNotification(`Overdue notices sent to ${overduePayments.length} students.`, 'success');
        
        // Log the overdue notices (in real app, this would be sent via email/SMS)
        console.log('Overdue notices sent to:', overduePayments.map(item => ({
            name: item.student_name,
            amount: item.amount_due,
            class: item.student_class
        })));
        
    } catch (error) {
        console.error('Error sending overdue notices:', error);
        showNotification('Error sending overdue notices. Please try again.', 'error');
    }
}

// ==================== PAYMENT FILTERS ====================

function initializePaymentFilters() {
    // Payment search and filters
    const searchInput = document.getElementById('searchPayments');
    const statusFilter = document.getElementById('filterPaymentStatus');
    const classFilter = document.getElementById('filterPaymentClass');
    const sortSelect = document.getElementById('sortPayments');
    const clearFiltersBtn = document.getElementById('clearPaymentFilters');
    
    if (searchInput) {
        searchInput.addEventListener('input', handlePaymentSearch);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', handlePaymentStatusFilter);
    }
    if (classFilter) {
        classFilter.addEventListener('change', handlePaymentClassFilter);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', handlePaymentSort);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearPaymentFilters);
    }
    
    // Initialize with default filters
    applyPaymentFilters();
}

function handlePaymentSearch() {
    currentPaymentFilters.search = document.getElementById('searchPayments').value.toLowerCase();
    applyPaymentFilters();
}

function handlePaymentStatusFilter() {
    currentPaymentFilters.status = document.getElementById('filterPaymentStatus').value;
    applyPaymentFilters();
}

function handlePaymentClassFilter() {
    currentPaymentFilters.class = document.getElementById('filterPaymentClass').value;
    applyPaymentFilters();
}

function handlePaymentSort() {
    currentPaymentFilters.sort = document.getElementById('sortPayments').value;
    applyPaymentFilters();
}

function clearPaymentFilters() {
    currentPaymentFilters = { search: '', status: '', class: '', sort: 'name' };
    document.getElementById('searchPayments').value = '';
    document.getElementById('filterPaymentStatus').value = '';
    document.getElementById('filterPaymentClass').value = '';
    document.getElementById('sortPayments').value = 'name';
    applyPaymentFilters();
    updatePaymentFilterInfo();
}

function updatePaymentFilterInfo() {
    const infoEl = document.getElementById('paymentFilterInfo');
    if (infoEl) {
        let infoText = '';
        if (currentPaymentFilters.status) {
            infoText += `Status: ${currentPaymentFilters.status}`;
        }
        if (currentPaymentFilters.class) {
            infoText += `${infoText ? ', ' : ''}Class: ${currentPaymentFilters.class}`;
        }
        infoEl.textContent = infoText ? `(${infoText})` : '';
    }
}

// ==================== PAYMENT DELETE FUNCTIONALITY ====================

// Edit payment functionality
function editPayment(paymentId) {
    const payment = paymentsData.find(p => p.id === paymentId);
    if (!payment) {
        showNotification('Payment not found.', 'error');
        return;
    }
    
    // Hide the payment history modal
    document.getElementById('paymentHistoryModal').classList.add('hidden');
    
    // Show the add payment form with pre-filled data
    showAddPaymentForm();
    
    // Pre-fill the form with payment data
    document.getElementById('paymentStudentId').value = payment.student_id;
    document.getElementById('paymentAmount').value = payment.amount;
    document.getElementById('paymentReference').value = payment.reference_number || '';
    
    // Trigger fee name population first, then set the value
    populateFeeNames();
    setTimeout(() => {
        document.getElementById('feeNameSelect').value = payment.fee_name || '';
    }, 100);
    
    // Format payment date for input field
    const paymentDate = safeDate(payment.payment_date);
    const formattedDate = paymentDate ? paymentDate.toISOString().split('T')[0] : '';
    document.getElementById('paymentDate').value = formattedDate;
    
    // Disable student selection since we're editing an existing payment
    document.getElementById('paymentStudentId').disabled = true;
    
    // Add a hidden field to track the payment ID being edited
    let editPaymentIdInput = document.getElementById('editPaymentId');
    if (!editPaymentIdInput) {
        editPaymentIdInput = document.createElement('input');
        editPaymentIdInput.type = 'hidden';
        editPaymentIdInput.id = 'editPaymentId';
        document.getElementById('paymentForm').appendChild(editPaymentIdInput);
    }
    editPaymentIdInput.value = paymentId;
    
    // Change the submit button text
    const submitButton = document.querySelector('#paymentForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="save" class="h-4 w-4 mr-1 inline"></i>Update Payment';
        lucide.createIcons();
    }
    
    // Update the form submit handler to use edit functionality
    document.getElementById('paymentForm').removeEventListener('submit', handleAddPayment);
    document.getElementById('paymentForm').addEventListener('submit', handleEditPayment);
}

async function handleEditPayment(e) {
    e.preventDefault();
    
    const paymentId = document.getElementById('editPaymentId').value;
    const studentId = document.getElementById('paymentStudentId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const feeName = document.getElementById('feeNameSelect').value;
    const reference = document.getElementById('paymentReference').value;
    const paymentDate = new Date(document.getElementById('paymentDate').value);
    
    // Find student details
    const student = studentsData.find(s => s.id === studentId);
    if (!student) {
        showNotification('Student not found.', 'error');
        return;
    }
    
    // Validate fee selection
    if (!feeName) {
        showNotification('Please select a fee name.', 'error');
        return;
    }
    
    try {
        // Update payment in database
        await updateDoc(doc(window.db, 'payments', paymentId), {
            amount: amount,
            fee_name: feeName,
            reference_number: reference,
            payment_date: paymentDate,
            updated_at: serverTimestamp()
        });
        
        // Update bill status if payment covers the bill
        const studentBills = billsData.filter(bill => bill.student_id === studentId && bill.status !== 'unpaid');
        let remainingAmount = amount;
        
        for (const bill of studentBills) {
            if (remainingAmount >= bill.total_amount) {
                await updateDoc(doc(window.db, 'bills', bill.id), {
                    status: 'paid',
                    paid_date: serverTimestamp()
                });
                remainingAmount -= bill.total_amount;
            } else if (remainingAmount > 0) {
                // Partial payment - mark as partially paid
                await updateDoc(doc(window.db, 'bills', bill.id), {
                    status: 'partial',
                    partial_amount: remainingAmount,
                    last_payment_date: serverTimestamp()
                });
                remainingAmount = 0;
            }
            
            if (remainingAmount <= 0) break;
        }
        
        // Reset form and handlers
        resetPaymentForm();
        
        showNotification('Payment updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating payment:', error);
        showNotification('Error updating payment. Please try again.', 'error');
    }
}

async function deletePayment(paymentId) {
    const payment = paymentsData.find(p => p.id === paymentId);
    if (!payment) {
        showNotification('Payment not found.', 'error');
        return;
    }
    
    const confirmMessage = `Are you sure you want to delete this payment of ₹${payment.amount.toLocaleString()} for ${payment.student_name}?
    
    This action cannot be undone and will permanently remove this payment record.

    Type "DELETE" to confirm:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE') {
        showNotification('Payment deletion cancelled.', 'info');
        return;
    }
    
    try {
        // Delete the payment
        await deleteDoc(doc(window.db, 'payments', paymentId));
        
        // Update associated bill status if needed
        const studentBills = billsData.filter(bill => bill.student_id === payment.student_id);
        for (const bill of studentBills) {
            // Recalculate bill status based on remaining payments
            const studentPayments = paymentsData.filter(p => p.student_id === payment.student_id && p.id !== paymentId);
            const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
            
            let newStatus = 'unpaid';
            if (totalPaid >= bill.total_amount) {
                newStatus = 'paid';
            } else if (totalPaid > 0) {
                newStatus = 'partial';
            }
            
            await updateDoc(doc(window.db, 'bills', bill.id), {
                status: newStatus
            });
        }
        
        showNotification(`Payment of ₹${payment.amount.toLocaleString()} deleted successfully!`, 'success');
        
    } catch (error) {
        console.error('Error deleting payment:', error);
        showNotification('Error deleting payment. Please try again.', 'error');
    }
}

function resetPaymentForm() {
    // Hide the add payment form
    hideAddPaymentForm();
    
    // Re-enable student selection
    document.getElementById('paymentStudentId').disabled = false;
    
    // Remove the edit payment ID field
    const editPaymentIdInput = document.getElementById('editPaymentId');
    if (editPaymentIdInput) {
        editPaymentIdInput.remove();
    }
    
    // Reset the submit button text
    const submitButton = document.querySelector('#paymentForm button[type="submit"]');
    if (submitButton) {
        submitButton.innerHTML = '<i data-lucide="plus" class="h-4 w-4 mr-1 inline"></i>Add Payment';
        lucide.createIcons();
    }
    
    // Reset the form submit handler
    document.getElementById('paymentForm').removeEventListener('submit', handleEditPayment);
    document.getElementById('paymentForm').addEventListener('submit', handleAddPayment);
    
    // Reset the form
    document.getElementById('paymentForm').reset();
}

// ==================== DASHBOARD STATISTICS ====================

function updateDashboardStats() {
    // Total students
    const totalStudentsEl = document.getElementById('totalStudents');
    if (totalStudentsEl) {
        totalStudentsEl.textContent = studentsData.length;
    }
    
    // Total fees collected
    const totalCollectedEl = document.getElementById('totalCollected');
    if (totalCollectedEl) {
        const paidBills = billsData.filter(bill => bill.status === 'paid');
        const totalCollected = paidBills.reduce((sum, bill) => sum + bill.total_amount, 0);
        totalCollectedEl.textContent = `₹${totalCollected.toLocaleString()}`;
    }
    
    // Pending bills
    const pendingBillsEl = document.getElementById('pendingBills');
    if (pendingBillsEl) {
        const unpaidBills = billsData.filter(bill => bill.status === 'unpaid');
        pendingBillsEl.textContent = unpaidBills.length;
    }
    
    // Update class statistics grid
    renderClassStatsGrid();
}

// ==================== UTILITY FUNCTIONS ====================

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}" class="h-5 w-5 mr-2"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    lucide.createIcons();
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ==================== ENHANCED SEARCH AND FILTERING ====================

function initializeSearchAndFilters() {
    // Student search and filters
    const searchInput = document.getElementById('searchStudents');
    const classFilter = document.getElementById('filterByClass');
    const sortSelect = document.getElementById('sortStudents');
    const clearFiltersBtn = document.getElementById('clearFilters');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleStudentSearch);
    }
    if (classFilter) {
        classFilter.addEventListener('change', handleClassFilter);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', handleStudentSort);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearStudentFilters);
    }
    
    // Table header sorting
    const sortByName = document.getElementById('sortByName');
    const sortByClass = document.getElementById('sortByClass');
    const sortByRoll = document.getElementById('sortByRoll');
    
    if (sortByName) {
        sortByName.addEventListener('click', () => handleTableSort('name'));
    }
    if (sortByClass) {
        sortByClass.addEventListener('click', () => handleTableSort('class'));
    }
    if (sortByRoll) {
        sortByRoll.addEventListener('click', () => handleTableSort('roll'));
    }
    
    // Fee filters
    const feeClassFilter = document.getElementById('filterFeesByClass');
    const feeTypeFilter = document.getElementById('filterFeesByType');
    const clearFeeFiltersBtn = document.getElementById('clearFeeFilters');
    
    if (feeClassFilter) {
        feeClassFilter.addEventListener('change', handleFeeClassFilter);
    }
    if (feeTypeFilter) {
        feeTypeFilter.addEventListener('change', handleFeeTypeFilter);
    }
    if (clearFeeFiltersBtn) {
        clearFeeFiltersBtn.addEventListener('click', clearFeeFilters);
    }
}

function handleStudentSearch() {
    currentStudentFilters.search = document.getElementById('searchStudents').value.toLowerCase();
    applyStudentFilters();
}

function handleClassFilter() {
    currentStudentFilters.class = document.getElementById('filterByClass').value;
    applyStudentFilters();
    updateClassFilterInfo();
}

function handleStudentSort() {
    currentStudentFilters.sort = document.getElementById('sortStudents').value;
    applyStudentFilters();
}

function handleTableSort(sortBy) {
    currentStudentFilters.sort = sortBy;
    document.getElementById('sortStudents').value = sortBy;
    applyStudentFilters();
}

function clearStudentFilters() {
    currentStudentFilters = { search: '', class: '', sort: 'name' };
    document.getElementById('searchStudents').value = '';
    document.getElementById('filterByClass').value = '';
    document.getElementById('sortStudents').value = 'name';
    applyStudentFilters();
    updateClassFilterInfo();
}

function applyStudentFilters() {
    filteredStudentsData = [...studentsData];
    
    // Apply search filter
    if (currentStudentFilters.search) {
        filteredStudentsData = filteredStudentsData.filter(student =>
            student.name.toLowerCase().includes(currentStudentFilters.search) ||
            student.roll_number.toString().includes(currentStudentFilters.search)
        );
    }
    
    // Apply class filter
    if (currentStudentFilters.class) {
        filteredStudentsData = filteredStudentsData.filter(student =>
            student.class === currentStudentFilters.class
        );
    }
    
    // Apply sorting
    filteredStudentsData.sort((a, b) => {
        switch (currentStudentFilters.sort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'class':
                return parseInt(a.class) - parseInt(b.class);
            case 'roll':
                return parseInt(a.roll_number) - parseInt(b.roll_number);
            default:
                return 0;
        }
    });
    
    renderFilteredStudentsTable();
    updateFilteredStudentCount();
}

function renderFilteredStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    filteredStudentsData.forEach(student => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Class ${student.class}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.roll_number}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="deleteStudent('${student.id}')"
                        class="text-red-600 hover:text-red-900 ml-4">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

function updateFilteredStudentCount() {
    const countEl = document.getElementById('filteredStudentCount');
    if (countEl) {
        countEl.textContent = filteredStudentsData.length;
    }
}

function updateClassFilterInfo() {
    const infoEl = document.getElementById('classFilterInfo');
    if (infoEl && currentStudentFilters.class) {
        infoEl.textContent = `(Class ${currentStudentFilters.class})`;
    } else if (infoEl) {
        infoEl.textContent = '';
    }
}

function handleFeeClassFilter() {
    currentFeeFilters.class = document.getElementById('filterFeesByClass').value;
    renderFeesTable();
}

function handleFeeTypeFilter() {
    currentFeeFilters.type = document.getElementById('filterFeesByType').value;
    renderFeesTable();
}

function clearFeeFilters() {
    currentFeeFilters = { class: '', type: '' };
    document.getElementById('filterFeesByClass').value = '';
    document.getElementById('filterFeesByType').value = '';
    renderFeesTable();
}

function renderClassStatsGrid() {
    const grid = document.getElementById('classStatsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Generate stats for classes 1-12
    for (let classNum = 1; classNum <= 12; classNum++) {
        const studentsInClass = studentsData.filter(student => student.class == classNum).length;
        
        const card = document.createElement('div');
        card.className = `bg-white rounded-lg border p-4 text-center hover:shadow-md transition-shadow cursor-pointer ${
            studentsInClass > 0 ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200'
        }`;
        
        card.innerHTML = `
            <div class="text-lg font-semibold text-gray-900">Class ${classNum}</div>
            <div class="text-2xl font-bold ${studentsInClass > 0 ? 'text-blue-600' : 'text-gray-400'}">${studentsInClass}</div>
            <div class="text-xs text-gray-500">${studentsInClass === 1 ? 'student' : 'students'}</div>
        `;
        
        // Add click handler to filter by class
        card.addEventListener('click', () => {
            // Switch to students tab
            document.getElementById('studentsTab').click();
            
            // Set filter
            setTimeout(() => {
                document.getElementById('filterByClass').value = classNum.toString();
                handleClassFilter();
            }, 100);
        });
        
        grid.appendChild(card);
    }
}

// Enhanced dashboard stats with class breakdown
const originalUpdateDashboardStats = updateDashboardStats;

function updateEnhancedDashboardStats() {
    // Call original function
    originalUpdateDashboardStats();
    
    // Update class statistics grid
    renderClassStatsGrid();
}

// Make functions available globally
window.deleteStudent = deleteStudent;
window.deleteFee = deleteFee;
window.toggleBillStatus = toggleBillStatus;
window.deleteBill = deleteBill;
window.deletePayment = deletePayment;
window.editPayment = editPayment;
window.showReceipt = showReceipt;
window.showPaymentHistory = showPaymentHistory;
window.showAddPaymentForStudent = showAddPaymentForStudent;

// Add event listeners for payment history modal
document.addEventListener('DOMContentLoaded', function() {
    // Close payment history modal
    const closePaymentHistoryModal = document.getElementById('closePaymentHistoryModal');
    if (closePaymentHistoryModal) {
        closePaymentHistoryModal.addEventListener('click', function() {
            document.getElementById('paymentHistoryModal').classList.add('hidden');
        });
    }
    
    // Close export modal
    const closeExportModal = document.getElementById('closeExportModal');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    if (closeExportModal) {
        closeExportModal.addEventListener('click', function() {
            document.getElementById('exportModal').classList.add('hidden');
        });
    }
    if (cancelExportBtn) {
        cancelExportBtn.addEventListener('click', function() {
            document.getElementById('exportModal').classList.add('hidden');
        });
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        // Close payment history modal
        const paymentHistoryModal = document.getElementById('paymentHistoryModal');
        if (paymentHistoryModal && e.target === paymentHistoryModal) {
            paymentHistoryModal.classList.add('hidden');
        }
        
        // Close export modal
        const exportModal = document.getElementById('exportModal');
        if (exportModal && e.target === exportModal) {
            exportModal.classList.add('hidden');
        }
    });
});

// ==================== STUDENT EDITING FUNCTIONALITY ====================

function startEditing(cell) {
    if (editingStudentId) {
        // Cancel any existing edit
        cancelEditing();
    }
    
    const studentId = cell.dataset.studentId;
    const field = cell.dataset.field;
    const currentValue = cell.dataset.value;
    
    editingStudentId = studentId;
    
    let inputElement;
    if (field === 'class') {
        // Create select dropdown for class
        inputElement = document.createElement('select');
        inputElement.className = 'border border-blue-500 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500';
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            option.selected = (i == currentValue);
            inputElement.appendChild(option);
        }
    } else if (field === 'roll_number') {
        // Create number input for roll number
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        inputElement.value = currentValue;
        inputElement.min = '1';
        inputElement.className = 'border border-blue-500 rounded px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500';
    } else {
        // Create text input for name
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = currentValue;
        inputElement.className = 'border border-blue-500 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
    }
    
    // Create save and cancel buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex space-x-2 mt-2';
    
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = '<i data-lucide="check" class="h-3 w-3"></i>';
    saveBtn.className = 'bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs';
    saveBtn.onclick = () => saveEdit(studentId, field, inputElement.value);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '<i data-lucide="x" class="h-3 w-3"></i>';
    cancelBtn.className = 'bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs';
    cancelBtn.onclick = () => cancelEditing();
    
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    
    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(inputElement);
    cell.appendChild(buttonContainer);
    
    inputElement.focus();
    inputElement.select();
    
    // Handle Enter key to save
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveEdit(studentId, field, inputElement.value);
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    });
    
    // Reinitialize icons
    lucide.createIcons();
}

async function saveEdit(studentId, field, newValue) {
    if (!newValue || newValue.trim() === '') {
        showNotification('Value cannot be empty', 'error');
        cancelEditing();
        return;
    }
    
    // Validate class range
    if (field === 'class') {
        const classNum = parseInt(newValue);
        if (classNum < 1 || classNum > 12) {
            showNotification('Class must be between 1 and 12', 'error');
            cancelEditing();
            return;
        }
    }
    
    // Validate roll number
    if (field === 'roll_number') {
        const rollNum = parseInt(newValue);
        if (rollNum < 1) {
            showNotification('Roll number must be greater than 0', 'error');
            cancelEditing();
            return;
        }
        
        // Check for duplicate roll number in same class
        const student = studentsData.find(s => s.id === studentId);
        if (student) {
            const duplicate = studentsData.find(s =>
                s.id !== studentId &&
                s.class === student.class &&
                s.roll_number == rollNum
            );
            if (duplicate) {
                showNotification(`Roll number ${rollNum} already exists in Class ${student.class}`, 'error');
                cancelEditing();
                return;
            }
        }
    }
    
    try {
        const updateData = {};
        updateData[field] = field === 'class' || field === 'roll_number' ? parseInt(newValue) : newValue.trim();
        updateData.updated_at = serverTimestamp();
        
        await updateDoc(doc(window.db, 'students', studentId), updateData);
        
        showNotification('Student updated successfully!', 'success');
        editingStudentId = null;
        
    } catch (error) {
        console.error('Error updating student:', error);
        showNotification('Error updating student. Please try again.', 'error');
        cancelEditing();
    }
}

function cancelEditing() {
    editingStudentId = null;
    renderFilteredStudentsTable();
}

// ==================== EXCEL IMPORT FUNCTIONALITY ====================

function showExcelImportModal() {
    document.getElementById('excelImportModal').classList.remove('hidden');
    resetImportModal();
}

function hideExcelImportModal() {
    document.getElementById('excelImportModal').classList.add('hidden');
    resetImportModal();
}

function resetImportModal() {
    document.getElementById('excelFileInput').value = '';
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('importResults').classList.add('hidden');
    document.getElementById('processImportBtn').disabled = true;
    excelImportData = [];
}

function handleExcelFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first worksheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) {
                showNotification('Excel file must have at least a header row and one data row', 'error');
                return;
            }
            
            // Process the data
            processExcelData(jsonData);
            
        } catch (error) {
            console.error('Error reading Excel file:', error);
            showNotification('Error reading Excel file. Please check the file format.', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function processExcelData(jsonData) {
    const headers = jsonData[0].map(h => h ? h.toString().toLowerCase().trim() : '');
    const rows = jsonData.slice(1);
    
    // Find column indices
    const nameIndex = headers.findIndex(h => h.includes('name'));
    const classIndex = headers.findIndex(h => h.includes('class'));
    const rollIndex = headers.findIndex(h => h.includes('roll'));
    
    if (nameIndex === -1 || classIndex === -1 || rollIndex === -1) {
        showNotification('Excel file must have columns for Name, Class, and Roll Number', 'error');
        return;
    }
    
    excelImportData = [];
    const validRows = [];
    const invalidRows = [];
    
    rows.forEach((row, index) => {
        if (!row[nameIndex] || !row[classIndex] || !row[rollIndex]) {
            invalidRows.push(`Row ${index + 2}: Missing required data`);
            return;
        }
        
        const name = row[nameIndex].toString().trim();
        const studentClass = parseInt(row[classIndex]);
        const rollNumber = parseInt(row[rollIndex]);
        
        // Validate data
        if (name.length === 0) {
            invalidRows.push(`Row ${index + 2}: Name cannot be empty`);
            return;
        }
        
        if (isNaN(studentClass) || studentClass < 1 || studentClass > 12) {
            invalidRows.push(`Row ${index + 2}: Class must be between 1 and 12`);
            return;
        }
        
        if (isNaN(rollNumber) || rollNumber < 1) {
            invalidRows.push(`Row ${index + 2}: Roll number must be greater than 0`);
            return;
        }
        
        validRows.push({
            name,
            class: studentClass,
            roll_number: rollNumber,
            rowIndex: index + 2
        });
    });
    
    // Check for duplicates within the Excel file
    const duplicatesInFile = [];
    for (let i = 0; i < validRows.length; i++) {
        for (let j = i + 1; j < validRows.length; j++) {
            if (validRows[i].class === validRows[j].class &&
                validRows[i].roll_number === validRows[j].roll_number) {
                duplicatesInFile.push(`Rows ${validRows[i].rowIndex} and ${validRows[j].rowIndex}: Duplicate class ${validRows[i].class} roll ${validRows[i].roll_number}`);
            }
        }
    }
    
    // Check for duplicates with existing data
    const duplicatesWithDB = [];
    const newStudents = [];
    
    validRows.forEach(student => {
        const existing = studentsData.find(s =>
            s.class == student.class && s.roll_number == student.roll_number
        );
        
        if (existing) {
            duplicatesWithDB.push(`Row ${student.rowIndex}: ${student.name} (Class ${student.class}, Roll ${student.roll_number}) already exists as ${existing.name}`);
        } else {
            newStudents.push(student);
        }
    });
    
    excelImportData = newStudents;
    
    // Show preview
    showImportPreview(newStudents, invalidRows, duplicatesInFile, duplicatesWithDB);
}

function showImportPreview(newStudents, invalidRows, duplicatesInFile, duplicatesWithDB) {
    const preview = document.getElementById('importPreview');
    const content = document.getElementById('previewContent');
    
    let previewHtml = `<strong>Import Summary:</strong><br>`;
    previewHtml += `✅ ${newStudents.length} new students will be imported<br>`;
    
    if (duplicatesWithDB.length > 0) {
        previewHtml += `⚠️ ${duplicatesWithDB.length} duplicates will be skipped<br>`;
    }
    
    if (invalidRows.length > 0) {
        previewHtml += `❌ ${invalidRows.length} rows have errors<br>`;
    }
    
    if (duplicatesInFile.length > 0) {
        previewHtml += `❌ ${duplicatesInFile.length} duplicates within file<br>`;
    }
    
    previewHtml += `<br><strong>New Students:</strong><br>`;
    if (newStudents.length > 0) {
        newStudents.slice(0, 10).forEach(student => {
            previewHtml += `• ${student.name} - Class ${student.class}, Roll ${student.roll_number}<br>`;
        });
        if (newStudents.length > 10) {
            previewHtml += `... and ${newStudents.length - 10} more<br>`;
        }
    }
    
    if (duplicatesWithDB.length > 0) {
        previewHtml += `<br><strong>Skipped (Already Exist):</strong><br>`;
        duplicatesWithDB.slice(0, 5).forEach(dup => {
            previewHtml += `• ${dup}<br>`;
        });
        if (duplicatesWithDB.length > 5) {
            previewHtml += `... and ${duplicatesWithDB.length - 5} more<br>`;
        }
    }
    
    if (invalidRows.length > 0) {
        previewHtml += `<br><strong>Errors:</strong><br>`;
        invalidRows.slice(0, 5).forEach(error => {
            previewHtml += `• ${error}<br>`;
        });
        if (invalidRows.length > 5) {
            previewHtml += `... and ${invalidRows.length - 5} more<br>`;
        }
    }
    
    if (duplicatesInFile.length > 0) {
        previewHtml += `<br><strong>File Duplicates:</strong><br>`;
        duplicatesInFile.slice(0, 5).forEach(dup => {
            previewHtml += `• ${dup}<br>`;
        });
        if (duplicatesInFile.length > 5) {
            previewHtml += `... and ${duplicatesInFile.length - 5} more<br>`;
        }
    }
    
    content.innerHTML = previewHtml;
    preview.classList.remove('hidden');
    
    // Enable import button if there are valid students to import
    document.getElementById('processImportBtn').disabled = newStudents.length === 0 || duplicatesInFile.length > 0;
}

async function handleExcelImport() {
    if (excelImportData.length === 0) {
        showNotification('No valid students to import', 'error');
        return;
    }
    
    const importBtn = document.getElementById('processImportBtn');
    const originalText = importBtn.innerHTML;
    
    try {
        importBtn.disabled = true;
        importBtn.innerHTML = '<i data-lucide="loader" class="h-4 w-4 mr-2 inline animate-spin"></i>Importing...';
        lucide.createIcons();
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const student of excelImportData) {
            try {
                await addDoc(collection(window.db, 'students'), {
                    name: student.name,
                    class: student.class.toString(),
                    roll_number: student.roll_number.toString(),
                    created_at: serverTimestamp()
                });
                successCount++;
            } catch (error) {
                errorCount++;
                errors.push(`${student.name}: ${error.message}`);
                console.error('Error adding student:', student, error);
            }
        }
        
        // Show results
        showImportResults(successCount, errorCount, errors);
        
        if (successCount > 0) {
            showNotification(`Successfully imported ${successCount} students!`, 'success');
        }
        
        if (errorCount > 0) {
            showNotification(`${errorCount} students failed to import. Check results for details.`, 'error');
        }
        
    } catch (error) {
        console.error('Error during import:', error);
        showNotification('Import failed. Please try again.', 'error');
    } finally {
        importBtn.disabled = false;
        importBtn.innerHTML = originalText;
        lucide.createIcons();
    }
}

function showImportResults(successCount, errorCount, errors) {
    const results = document.getElementById('importResults');
    const content = document.getElementById('resultsContent');
    
    let resultsHtml = `<strong>Import Complete:</strong><br>`;
    resultsHtml += `✅ ${successCount} students imported successfully<br>`;
    
    if (errorCount > 0) {
        resultsHtml += `❌ ${errorCount} students failed to import<br><br>`;
        resultsHtml += `<strong>Errors:</strong><br>`;
        errors.forEach(error => {
            resultsHtml += `• ${error}<br>`;
        });
    }
    
    content.innerHTML = resultsHtml;
    results.classList.remove('hidden');
    
    // Hide import button after successful import
    document.getElementById('processImportBtn').style.display = 'none';
}

// Make functions globally available
window.startEditing = startEditing;
window.saveEdit = saveEdit;
window.cancelEditing = cancelEditing;
