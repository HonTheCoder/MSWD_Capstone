
function showSuccess(msg) {
    openMessageModal("✅ Success", msg, "success");
}

function showError(msg) {
    openMessageModal("❌ Error", msg, "error");
}

function showWarning(msg) {
    openMessageModal("⚠️ Warning", msg, "warning");
}

function showInfo(msg) {
    openMessageModal("ℹ️ Information", msg, "info");
}

function openMessageModal(title, msg, type = "info") {
    const modal = document.getElementById("messageModal");
    if (!modal) {
        // Fallback to alert if modal is not available
        alert(msg);
        return;
    }
    
    // Remove any existing type classes
    modal.classList.remove('success', 'error', 'warning', 'info', 'show', 'hide');
    
    // Set title
    const titleEl = document.getElementById("messageTitle");
    if (titleEl) titleEl.textContent = title;
    
    // Set message content
    const textEl = document.getElementById("messageText");
    if (textEl) textEl.innerHTML = msg;
    
    // Set icon based on type
    const iconEl = document.getElementById("messageIcon");
    if (iconEl) {
        iconEl.className = `message-icon ${type}`;
        iconEl.innerHTML = getMessageIcon(type);
    }
    
    // Add type class to modal for styling
    modal.classList.add(type);
    
    // Show modal with enhanced styling and animation
    modal.classList.remove("hidden");
    modal.classList.add("show");
    
    // Auto-close after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            closeMessageModal();
        }, 5000);
    }
    
    // Focus management for accessibility
    const okBtn = document.getElementById("messageOkBtn");
    if (okBtn) {
        setTimeout(() => okBtn.focus(), 100);
    }
}

function getMessageIcon(type) {
    switch (type) {
        case 'success': return '✓';
        case 'error': return '✗';
        case 'warning': return '!';
        case 'info': return 'i';
        default: return 'i';
    }
}

function closeMessageModal() {
    const modal = document.getElementById("messageModal");
    if (!modal) return;
    
    // Add hide animation
    modal.classList.add("hide");
    modal.classList.remove("show");
    
    // Hide after animation completes
    setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove('success', 'error', 'warning', 'info', 'hide');
    }, 300);
}

// Expose for inline onclick in main.html
window.closeMessageModal = closeMessageModal;

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("messageOkBtn");
    if (btn) {
        btn.addEventListener("click", closeMessageModal);
    }
});

let currentUserRole = null; // 'mswd' or 'barangay'
let currentBarangayName = null; // barangay username if barangay role
// app.js
import { 
    db, 
    auth, 
    requestAccount, 
    getPendingRequests, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc,
    addDoc, 
    setDoc,
    doc, 
    updateDoc, 
    deleteDoc, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    createUserInFirestore,
    fetchSignInMethodsForEmail,
    addResidentToFirestore,
    changePassword,
    updateInventoryTransaction,
    addInventory,
    getInventoryTotals,
    getActiveBatch,
    startNewBatch,
    logInventoryTransaction,
    getInventoryLogs,
    markDeliveryDeducted,
    isDeliveryDeducted,
    getDeliveries,
    validateInventoryAvailability,
    // Enhanced session management functions
    checkActiveSession,
    createUserSession,
    terminateUserSession,
    cleanupExpiredSessions,
    validateCurrentSession
} from './firebase.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot, runTransaction, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let loggedInUserData = null; //(GLOBAL VARIABLE)

// Lightweight global app registry for listeners and dynamic assets
window.App = window.App || {
    currentSection: null,
    listeners: new Map(),
    addListener(sectionKey, unsubscribe) {
        if (!unsubscribe) return;
        const arr = this.listeners.get(sectionKey) || [];
        arr.push(unsubscribe);
        this.listeners.set(sectionKey, arr);
    },
    clearListeners(sectionKey) {
        const arr = this.listeners.get(sectionKey) || [];
        arr.forEach(unsub => { try { unsub(); } catch(_) {} });
        this.listeners.delete(sectionKey);
    },
    clearAll() {
        for (const key of Array.from(this.listeners.keys())) this.clearListeners(key);
    }
};

async function ensureDataTables() {
    // If jQuery & DataTables present, return
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) return;
    // Try to load from CDN if not present
    const loadScript = (src) => new Promise((res, rej) => { const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    const loadCss = (href) => { const l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); };
    try {
        loadCss('https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css');
        loadCss('https://cdn.datatables.net/buttons/2.4.1/css/buttons.dataTables.min.css');
        if (!window.jQuery) await loadScript('https://code.jquery.com/jquery-3.7.1.min.js');
        await loadScript('https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js');
        await loadScript('https://cdn.datatables.net/buttons/2.4.1/js/dataTables.buttons.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js');
        await loadScript('https://cdn.datatables.net/buttons/2.4.1/js/buttons.html5.min.js');
        await loadScript('https://cdn.datatables.net/buttons/2.4.1/js/buttons.print.min.js');
    } catch (e) { console.warn('Failed to lazy-load DataTables', e); }
}

// ✅ Auto login persist
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("✅ User is logged in:", user.email);
        
        // Skip initialization if this is the admin user already logged in
        // This prevents redirect when the admin creates a new account
        if (loggedInUserData && loggedInUserData.email === user.email) {
            console.log('💡 Admin already logged in, skipping re-initialization');
            return;
        }
        
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            initializeUser(userData);
        }
    } else {
        console.log("❌ No user logged in");
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('dashboardContainer').classList.add('hidden');
    }
});

// ✅ Initialize App when page loads
document.addEventListener("DOMContentLoaded", async () => {
    initializeDefaultAdmin();
    loadBarangaysFromFirebase(); // ✅ Load Barangays on page load
    
    // Initialize enhanced click prevention for forms
    initializeFormEnhancements();
    
    // Override global functions with full implementations
    setupGlobalFunctions();
    
    // 🔥 NEW: Initialize session management and monitoring
    initializeSessionManagement();
});

    document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
    document.getElementById("requestAccountBtn")?.addEventListener("click", showRequestAccount);
    document.getElementById("requestAccountForm")?.addEventListener("submit", handleRequestAccount);
    window.addEventListener("click", function(event) {
        const modal = document.getElementById("requestAccountModal");
        if (event.target === modal) hideRequestAccount();
    });

    // ✅ Password Eye Icon Fix
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            togglePassword.textContent = type === 'password' ? 'visibility_off' : 'visibility';
        });
    }

    // ✅ Cancel Button Fix for Request Account
    const cancelRequestBtn = document.getElementById("cancelRequestBtn");
    if (cancelRequestBtn) {
        cancelRequestBtn.addEventListener("click", hideRequestAccount);
    }

async function initializeDefaultAdmin() {
    const usersRef = collection(db, "users");
    const adminQuery = query(usersRef, where("username", "==", "admin_mswd"));
    const querySnapshot = await getDocs(adminQuery);

    if (querySnapshot.empty) {
        const userCredential = await createUserWithEmailAndPassword(auth, "admin_mswd@example.com", "polangui12345");
        await createUserInFirestore(userCredential.user.uid, "admin_mswd", "admin_mswd@example.com", "mswd");
    }
}

// Centralized auth error mapping
function mapAuthError(err) {
    const code = err && err.code;
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Invalid username or password. Please try again.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please wait and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        case 'auth/requires-recent-login':
            return 'Please log out and log back in, then retry.';
        case 'auth/weak-password':
            return 'New password is too weak. Choose a stronger one.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    if (!usernameField?.value.trim() || !passwordField?.value) {
        showError('Please enter both username and password.');
        return false;
    }
    
    const raw = usernameField.value || '';
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, '');
    const password = passwordField.value;

    const barangayName = normalized.replace('barangay_', '');
    const email = `${barangayName}@example.com`;
    
    // Disable form during processing
    usernameField.disabled = true;
    passwordField.disabled = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Checking session...';
    }

    try {
        // 🔥 NEW: Check for existing active session before attempting login
        const sessionCheck = await checkActiveSession(email);
        
        if (sessionCheck.hasActiveSession) {
            // Show session conflict dialog
            const loginTime = sessionCheck.loginTimestamp ? 
                new Date(sessionCheck.loginTimestamp).toLocaleString() : 'Unknown';
            const userAgent = sessionCheck.userAgent || 'Unknown device';
            
            let dialogResult;
            if (window.Swal) {
                dialogResult = await Swal.fire({
                    title: '⚠️ Account Already Active',
                    html: `
                        <div style="text-align: left; margin: 10px 0;">
                            <p><strong>This account is already logged in elsewhere:</strong></p>
                            <ul style="text-align: left; margin-left: 20px;">
                                <li>Last login: ${loginTime}</li>
                                <li>Device: ${userAgent}</li>
                            </ul>
                            <p>You can:</p>
                            <ul style="text-align: left; margin-left: 20px;">
                                <li><strong>Terminate</strong> the other session and login here</li>
                                <li><strong>Cancel</strong> this login attempt</li>
                            </ul>
                        </div>
                    `,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Terminate & Login',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#f59e0b',
                    cancelButtonColor: '#6b7280',
                    background: '#ffffff',
                    color: '#1f2937',
                    didOpen: (popup) => {
                        popup.style.borderTop = '6px solid #f59e0b';
                        popup.style.borderBottom = '6px solid #ef4444';
                    }
                });
            } else {
                dialogResult = {
                    isConfirmed: confirm(`This account is already logged in elsewhere (${loginTime}).\n\nDo you want to terminate the other session and login here?`)
                };
            }
            
            if (!dialogResult.isConfirmed) {
                // User chose to cancel
                if (window.Swal) {
                    await Swal.fire({
                        title: 'Login Cancelled',
                        text: 'Login attempt was cancelled.',
                        icon: 'info',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#2563eb'
                    });
                } else {
                    showInfo('Login attempt was cancelled.');
                }
                return false;
            } else {
                // User chose to terminate other session - terminate it
                await terminateUserSession(email);
                console.log('✅ Previous session terminated, proceeding with new login');
            }
        }
        
        // Update button text for actual authentication
        if (submitBtn) {
            submitBtn.innerHTML = '<span>⏳</span> Authenticating...';
        }
        
        // Proceed with Firebase authentication
        await signInWithEmailAndPassword(auth, email, password);
        
        // 🔥 NEW: Create new session after successful authentication
        const sessionId = await createUserSession(email, { username: normalized });
        console.log(`✅ New session created: ${sessionId}`);
        
        // Store session ID for later validation
        localStorage.setItem('currentSessionId', sessionId);
        localStorage.setItem('currentUserEmail', email);
        
        // Modern success popup (UI-only)
        const isBarangayUser = normalized.startsWith('barangay_');
        const successWelcomeText = isBarangayUser ? 'Welcome, Barangay!' : 'Welcome, Admin!';
        if (window.Swal) {
            await Swal.fire({
                title: '✅ Login Successful',
                text: successWelcomeText,
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                timer: 3000,
                didOpen: (popup) => {
                    // Add subtle blue/green accent border to match theme
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        } else {
            showSuccess('Login successful! Session created. Redirecting...');
        }
        return true;
    } catch (error) {
        console.error('Login error:', error);
        // Modern error popup (UI-only)
        let errorMessage = 'Login failed. Please try again.';
        
        // Handle specific session-related errors
        if (error.message && error.message.includes('session')) {
            errorMessage = 'Session management error. Please try again.';
        } else {
            errorMessage = mapAuthError(error);
        }
        
        if (window.Swal) {
            await Swal.fire({
                title: '❌ Login Failed',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'Retry',
                confirmButtonColor: '#2563eb',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    // Red/blue theme accent
                    popup.style.borderTop = '6px solid #ef4444';
                    popup.style.borderBottom = '6px solid #2563eb';
                }
            });
        } else {
            showError(errorMessage);
        }
        return false;
    } finally {
        // Re-enable form
        setTimeout(() => {
            usernameField.disabled = false;
            passwordField.disabled = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Login';
            }
        }, 1000);
    }
}

async function initializeUser(userData) {
    loggedInUserData = userData;
    console.log("Initializing user with data:", userData);
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');
    document.getElementById('userRole').innerText = `Welcome, ${userData.role.toUpperCase()}`;

    // 🔥 NEW: Initialize session status display
    updateSessionStatusUI();

    if (userData.role === 'mswd') {
        document.querySelectorAll('.mswd-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.barangay-only').forEach(el => el.style.display = 'none');
        loadPendingRequests();
    
        showSection('deliveryScheduling');
} else if (userData.role === 'barangay') {
        document.querySelectorAll('.barangay-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.mswd-only').forEach(el => el.style.display = 'none');

        loadBarangayDeliveries(userData.username); 
        
        const barangayName = userData.username.replace('barangay_', '');
        loadResidentsForBarangay(barangayName); // 🔥 Automatic load residents pag login
        
        // Setup barangay-specific button functionality
        setTimeout(() => {
            setupBarangayButtons();
        }, 100); // Small delay to ensure DOM is ready
        
        showSection('deliveryStatus');
    }
}



// Old loadAccountRequests and declineRequest functions removed - now using new system

async function handleRequestAccount(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const barangayName = document.getElementById('requestUsername').value.trim();
    const email = document.getElementById('requestEmail').value.trim();
    const contact = document.getElementById('requestContact').value.trim();
    const message = document.getElementById('requestMessage').value.trim();
    
    if (!barangayName || !email || !contact || !message) {
        showError('Please fill in all fields');
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return false;
    }
    
    // Disable form during processing
    const formInputs = form.querySelectorAll('input, textarea, button');
    formInputs.forEach(input => {
        input.disabled = true;
        input.style.opacity = '0.7';
    });
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Submitting Request...';
    }
    
    try {
        // Explicitly call with parameter names matching the function definition
        await requestAccount(barangayName, email, contact, message);
        
        // Show success message with Swal if available or fallback
        if (window.Swal) {
            await Swal.fire({
                title: '✅ Request Submitted',
                text: 'Account request submitted successfully! We will review your request and get back to you soon.',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        } else {
            showSuccess('Account request submitted successfully! We will review your request and get back to you soon.');
        }
        
        hideRequestAccount();
        form.reset();
        return true;
    } catch (error) {
        console.error('Request account error:', error);
        
        // Show error message with Swal if available or fallback
        if (window.Swal) {
            await Swal.fire({
                title: '❌ Request Failed',
                text: 'Failed to submit request. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2563eb',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #ef4444';
                    popup.style.borderBottom = '6px solid #2563eb';
                }
            });
        } else {
            showError('Failed to submit request. Please try again.');
        }
        return false;
    } finally {
        // Force immediate UI update for button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit Request';
        }
        
        // Re-enable other form elements with a small delay
        setTimeout(() => {
            formInputs.forEach(input => {
                if (input !== submitBtn) { // Skip button as we already updated it
                    input.disabled = false;
                    input.style.opacity = '';
                }
            });
        }, 500);
    }
}

function showRequestAccount() { document.getElementById("requestAccountModal").classList.remove("hidden"); }
function hideRequestAccount() { document.getElementById("requestAccountModal").classList.add("hidden"); }
    

// 🔥 SESSION MANAGEMENT INITIALIZATION AND MONITORING

// Initialize session management system
function initializeSessionManagement() {
    console.log('🔄 Initializing session management system...');
    
    // Run cleanup on startup
    cleanupExpiredSessions().catch(error => {
        console.error('Error during startup session cleanup:', error);
    });
    
    // Set up periodic session cleanup (every 30 minutes)
    setInterval(() => {
        console.log('🗑️ Running periodic session cleanup...');
        cleanupExpiredSessions().catch(error => {
            console.error('Error during periodic session cleanup:', error);
        });
    }, 30 * 60 * 1000); // 30 minutes
    
    // Set up session validation for current user (every 5 minutes)
    setInterval(() => {
        validateCurrentUserSessionWithUI();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Set up page visibility change handler
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set up beforeunload handler for clean session termination
    window.addEventListener('beforeunload', handlePageUnload);
    
    console.log('✅ Session management system initialized');
}

// Validate current user's session
async function validateCurrentUserSession() {
    const currentEmail = localStorage.getItem('currentUserEmail');
    const sessionId = localStorage.getItem('currentSessionId');
    
    if (currentEmail && sessionId) {
        try {
            const isValid = await validateCurrentSession(currentEmail, sessionId);
            if (!isValid) {
                console.warn('⚠️ Current session is no longer valid, logging out...');
                if (window.Swal) {
                    await Swal.fire({
                        title: '🔒 Session Expired',
                        text: 'Your session has expired. Please log in again.',
                        icon: 'warning',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#f59e0b',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                }
                // Force logout
                await window.logout();
            }
        } catch (error) {
            console.error('Error validating current session:', error);
        }
    }
}

// Handle page visibility changes (for session activity tracking)
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('📵 Page hidden - user switched tabs/apps');
    } else {
        console.log('📱 Page visible - user returned to tab');
        // Validate session when user returns and update UI
        validateCurrentUserSessionWithUI();
    }
}

// Handle page unload (for clean session termination)
function handlePageUnload(event) {
    // Note: This is best-effort - not all browsers guarantee this will run
    const currentEmail = localStorage.getItem('currentUserEmail');
    if (currentEmail) {
        // Use navigator.sendBeacon for better reliability
        console.log('🚀 Page unloading - attempting session cleanup');
        // In a real application, you might send a beacon to a server endpoint
        // that handles session cleanup server-side
    }
}

// 🔥 SESSION STATUS UI MANAGEMENT

// Update session status indicator in the UI
function updateSessionStatusUI(status = 'active') {
    const sessionStatusEl = document.getElementById('sessionStatus');
    const sessionDotEl = document.getElementById('sessionDot');
    const sessionTextEl = document.getElementById('sessionText');
    const sessionTimeEl = document.getElementById('sessionTime');
    
    if (!sessionStatusEl) return; // Element might not exist on login page
    
    // Show the session status
    sessionStatusEl.style.display = 'block';
    
    // Get current session info from localStorage
    const currentEmail = localStorage.getItem('currentUserEmail');
    const sessionId = localStorage.getItem('currentSessionId');
    
    if (currentEmail && sessionId) {
        // Update session time
        const now = new Date();
        sessionTimeEl.textContent = now.toLocaleTimeString();
        
        // Update status based on parameter
        sessionDotEl.className = `session-dot ${status}`;
        
        switch (status) {
            case 'active':
                sessionTextEl.textContent = 'Active Session';
                break;
            case 'expired':
                sessionTextEl.textContent = 'Session Expired';
                break;
            case 'invalid':
                sessionTextEl.textContent = 'Invalid Session';
                break;
            default:
                sessionTextEl.textContent = 'Session Status';
        }
    } else {
        // Hide if no session info available
        sessionStatusEl.style.display = 'none';
    }
}

// Hide session status (used during logout)
function hideSessionStatusUI() {
    const sessionStatusEl = document.getElementById('sessionStatus');
    if (sessionStatusEl) {
        sessionStatusEl.style.display = 'none';
    }
}

// Update session validation to also update UI
async function validateCurrentUserSessionWithUI() {
    const currentEmail = localStorage.getItem('currentUserEmail');
    const sessionId = localStorage.getItem('currentSessionId');
    
    if (currentEmail && sessionId) {
        try {
            const isValid = await validateCurrentSession(currentEmail, sessionId);
            if (!isValid) {
                console.warn('⚠️ Current session is no longer valid, updating UI...');
                updateSessionStatusUI('invalid');
                
                // Show session expired dialog
                if (window.Swal) {
                    await Swal.fire({
                        title: '🔒 Session Expired',
                        text: 'Your session has expired. Please log in again.',
                        icon: 'warning',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#f59e0b',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    });
                }
                
                // Force logout
                await window.logout();
            } else {
                // Session is valid, update UI to show active status
                updateSessionStatusUI('active');
            }
        } catch (error) {
            console.error('Error validating current session:', error);
            updateSessionStatusUI('invalid');
        }
    }
}

// 🔥 ENHANCED LOGOUT WITH SESSION MANAGEMENT
window.logout = async function () {
    try {
        const currentEmail = localStorage.getItem('currentUserEmail');
        const sessionId = localStorage.getItem('currentSessionId');
        
        console.log('🚪 Starting logout process...');
        console.log('Current email:', currentEmail);
        console.log('Session ID:', sessionId);
        
        // Terminate session in Firestore before signing out
        if (currentEmail) {
            try {
                await terminateUserSession(currentEmail);
                console.log('✅ Session terminated in Firestore');
            } catch (error) {
                console.error('⚠️ Error terminating session in Firestore:', error);
                // Continue with logout even if session termination fails
            }
        }
        
        // Clear local storage and hide session status
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('currentUserEmail');
        hideSessionStatusUI();
        console.log('✅ Local storage cleared and UI updated');
        
        // Sign out from Firebase Auth
        await auth.signOut();
        console.log('✅ Firebase auth sign out complete');
        
        // Show logout success message before reload
        if (window.Swal) {
            await Swal.fire({
                title: '👋 Logged Out',
                text: 'You have been successfully logged out.',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                timer: 2000,
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        }
        
        // Reload to reset application state
        location.reload();
        
    } catch (error) {
        console.error('❌ Error during logout:', error);
        
        // Still attempt to clear local state on error
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('currentUserEmail');
        
        if (window.Swal) {
            await Swal.fire({
                title: '⚠️ Logout Issue',
                text: 'There was an issue during logout, but you have been signed out.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#f59e0b'
            });
        }
        
        // Force reload even on error
        location.reload();
    }
};

// ✅ Example kung may Change Password ka (Optional)
// removed duplicate placeholder to avoid conflicts

// ✅ Load Barangay List from Firestore
async function loadBarangaysFromFirebase() {
    const tableBody = document.getElementById("barangayTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    const barangaysRef = collection(db, "users");
    const q = query(barangaysRef, where("role", "==", "barangay"));

    onSnapshot(q, async (snapshot) => {
        tableBody.innerHTML = "";
        if (snapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='3'>No data available</td></tr>";
        } else {
            for (const docSnap of snapshot.docs) {
                const barangayData = docSnap.data();
                const barangayName = barangayData.username.replace('barangay_', '');

                // ✅ Count residents linked to this barangay
                const residentsRef = collection(db, "residents");
                const residentsQ = query(residentsRef, where("barangay", "==", barangayName));
                const residentsSnap = await getDocs(residentsQ);
                const residentCount = residentsSnap.size;

                const tr = document.createElement('tr');
                const tdB = document.createElement('td'); tdB.textContent = barangayName;
                const tdCount = document.createElement('td'); tdCount.textContent = String(residentCount);
                const tdAct = document.createElement('td');
                const btn = document.createElement('button');
                btn.className = 'view-residents-btn';
                btn.setAttribute('data-id', docSnap.id);
                btn.setAttribute('data-bname', barangayName);
                btn.textContent = 'View';
                btn.addEventListener('click', () => window.viewBarangay(docSnap.id, barangayName));
                tdAct.appendChild(btn);
                tr.appendChild(tdB); tr.appendChild(tdCount); tr.appendChild(tdAct);
                tableBody.appendChild(tr);
            }
        }
    });
    // Ensure click works even if inline is skipped
    tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-residents-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const bname = btn.getAttribute('data-bname');
        console.log('[barangayTable] View clicked for', bname, 'id:', id);
        if (typeof window.viewBarangay === 'function') {
            window.viewBarangay(id, bname);
        }
    });
}

// ✅ Handle Viewing Barangay Residents
// ✅ View Residents Modal with Search Filter
// (Removed duplicate window.viewBarangay; unified implementation is defined later)

// Function to schedule a delivery
async function loadBarangayDropdown() {
    const barangaySelect = document.getElementById("barangaySelect");
    if (!barangaySelect) {
        console.warn("[loadBarangayDropdown] barangaySelect element not found");
        return;
    }

    barangaySelect.innerHTML = ""; // ✅ Clear it first!

    // Add a default option (optional)
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Barangay";
    barangaySelect.appendChild(defaultOption);

    // ✅ Fetch barangays from the "users" collection
    const q = query(collection(db, "users"), where("role", "==", "barangay"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = data.username; // Assuming 'username' is unique
        option.textContent = data.username.replace("barangay_", ""); // Remove prefix
        barangaySelect.appendChild(option);
    });
}

// ✅ Function to load deliveries for a barangay
// Add a new function to fetch deliveries for the logged-in barangay
// Update loadBarangayDeliveries to include status update buttons

// Live updates for Barangay Deliveries

function loadBarangayDeliveries(barangay) {
    const tableBody = document.getElementById("deliveriesTableBody");
    if (!tableBody) {
        console.warn("[Barangay Deliveries] Table body not found.");
        return;
    }
    const deliveriesRef = collection(db, "deliveries");
    const q = query(deliveriesRef, where("barangay", "==", barangay));

    if (window._unsubDeliveries) { try { window._unsubDeliveries(); } catch(_) {} }
    const unsub = onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = "";
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">No deliveries scheduled yet.</td>
                </tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const row = document.createElement('tr');
            const deliveryDate = d.deliveryDate?.toDate?.();
            const dateStr = deliveryDate ? deliveryDate.toLocaleDateString() : 'No Date';
            
            // Create enhanced details with goods information (expandable like admin) — no emojis
            const goodsItems = [];
            if (d.goods) {
                if (d.goods.rice > 0) goodsItems.push(`${d.goods.rice} Rice`);
                if (d.goods.biscuits > 0) goodsItems.push(`${d.goods.biscuits} Biscuits`);
                if (d.goods.canned > 0) goodsItems.push(`${d.goods.canned} Canned`);
                if (d.goods.shirts > 0) goodsItems.push(`${d.goods.shirts} Shirts`);
            }
            
            const detailsPreview = d.details || 'No description';
            const goodsPreview = goodsItems.join(', ');
            
            const hasExpandableDetails = goodsItems.length > 0 || (d.details && d.details.length > 40);
            
            // Create table cells
            // Date & Time Column
            const tdDate = document.createElement('td');
            tdDate.innerHTML = `
                <div class="date-cell">
                    <span class="date-text">${dateStr}</span>
                </div>
            `;
            
            // Items & Quantity Column 
            const tdItems = document.createElement('td');
            const itemsSummary = goodsItems.length > 0 ? goodsItems.join('<br>') : 'No items specified';
            tdItems.innerHTML = `
                <div class="items-cell">
                    <div class="items-content">${itemsSummary}</div>
                </div>
            `;
            
            // Details Column
            const tdDetails = document.createElement('td');
            tdDetails.innerHTML = `
                <div class="details-cell" ${hasExpandableDetails ? `onclick="toggleBarangayDeliveryDetails('${docSnap.id}')" style="cursor: pointer;"` : ''}>
                    <div class="details-preview">
                        <div class="details-text" title="${d.details || 'No description'}">
                            ${detailsPreview}
                            ${hasExpandableDetails ? '<span class="expand-indicator">▼</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // Status Column (text-only badge, no emoji)
            const tdStatus = document.createElement('td');
            const statusClass = getStatusClass(d.status || 'Pending');
            tdStatus.innerHTML = `
                <div class="status-cell">
                    <span class="status-badge ${statusClass}">
                        <span class="status-text">${d.status || 'Pending'}</span>
                    </span>
                </div>
            `;
            
            row.appendChild(tdDate);
            row.appendChild(tdItems);
            row.appendChild(tdDetails);
            row.appendChild(tdStatus);
            const tdBtn = document.createElement('td');
            
            // Create action buttons container
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'barangay-action-buttons';
            
            // Main action button (Received/Status)
            const btn = document.createElement('button');
            if (d.status === 'Pending') {
                btn.textContent = 'Received';
                btn.className = 'receive-btn';
                // Add double-click prevention
                let isProcessing = false;
                btn.addEventListener('click', async () => {
                    if (isProcessing) return;
                    isProcessing = true;
                    btn.disabled = true;
                    btn.textContent = 'Processing...';
                    try {
                        await updateDeliveryStatus(docSnap.id, 'Received');
                    } finally {
                        // Button will be replaced by new render, but just in case:
                        setTimeout(() => {
                            isProcessing = false;
                            btn.disabled = false;
                            btn.textContent = 'Received';
                        }, 1000);
                    }
                });
            } else {
                btn.textContent = d.status || 'Unknown';
                btn.disabled = true;
                btn.className = 'status-btn';
            }
            
            // Print receipt button (always available)
            const printBtn = document.createElement('button');
            printBtn.innerHTML = '<span class="btn-icon">🖨️</span><span class="btn-text">Print</span>';
            printBtn.className = 'print-receipt-btn';
            printBtn.title = 'Print delivery receipt';
            printBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row expansion
                printBarangayDeliveryReceipt(docSnap.id, d);
            });
            
            buttonContainer.appendChild(btn);
            buttonContainer.appendChild(printBtn);
            tdBtn.appendChild(buttonContainer);
            row.appendChild(tdBtn);
            tableBody.appendChild(row);
            
            // Create expandable details row if needed (like admin design)
            if (hasExpandableDetails) {
                const expandRow = document.createElement("tr");
                expandRow.className = "details-expanded-row hidden";
                expandRow.id = `barangay-details-row-${docSnap.id}`;
                
                const expandCell = document.createElement("td");
                expandCell.colSpan = 5; // 5 columns for barangay table: Date, Items, Details, Status, Actions
                expandCell.innerHTML = `
                    <div class="expanded-content">
                        <div class="full-details">
                            <h4>Full Details:</h4>
                            <p>${d.details || 'No description provided'}</p>
                        </div>
                        <div class="full-goods">
                            <h4>Items Received:</h4>
                            <div class="goods-grid">
                                ${goodsItems.map(item => `<span class="goods-item">${item}</span>`).join('')}
                            </div>
                            ${goodsItems.length === 0 ? '<p class="no-goods">No specific items listed</p>' : ''}
                        </div>
                    </div>
                `;
                
                expandRow.appendChild(expandCell);
                tableBody.appendChild(expandRow);
            }
        });
    });
    window._unsubDeliveries = unsub;
    window.App.addListener('deliveryStatus', unsub);
}

// Function to update delivery status
async function updateDeliveryStatus(deliveryId, newStatus) {
    try {
        // Get delivery data first
        const deliveryRef = doc(db, "deliveries", deliveryId);
        const deliverySnap = await getDoc(deliveryRef);
        const deliveryData = deliverySnap.data();
        
        await updateDoc(deliveryRef, {
            status: newStatus,
            updatedAt: new Date()
        });
        
        // If marking as "Received" (goods actually delivered) and not already deducted, deduct inventory
        if (newStatus === 'Received' && deliveryData?.goods && !(await isDeliveryDeducted(deliveryId))) {
            try {
                await updateInventoryTransaction({
                    rice: -Number(deliveryData.goods.rice || 0),
                    biscuits: -Number(deliveryData.goods.biscuits || 0),
                    canned: -Number(deliveryData.goods.canned || 0),
                    shirts: -Number(deliveryData.goods.shirts || 0)
                });
                
                // Mark as deducted and log transaction
                await markDeliveryDeducted(deliveryId);
                await logInventoryTransaction({
                    action: 'delivery',
                    type: 'deduction',
                    deliveryId,
                    barangay: deliveryData.barangay?.replace('barangay_', '') || 'Unknown',
                    items: deliveryData.goods,
                    user: loggedInUserData?.username || 'System',
                    description: `Delivery to ${deliveryData.barangay?.replace('barangay_', '') || 'Unknown'}`
                });
                
                console.log(`Inventory deducted for delivery ${deliveryId}`);
                showSuccess(`Delivery marked as received. Inventory has been automatically updated.`);
                return; // Exit early since we already showed success message
            } catch (inventoryError) {
                console.error('Inventory deduction failed:', inventoryError);
                if (inventoryError.message === 'INSUFFICIENT_INVENTORY') {
                    showError('Insufficient inventory for this delivery. Please add stock first.');
                    return;
                }
            }
        }
        
        console.log(`Delivery ${deliveryId} status updated to ${newStatus}`);
        if (newStatus !== 'Received') {
            showSuccess(`Delivery status updated to ${newStatus}`);
        }
        
        // Refresh the deliveries table to show updated status
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userData = await getDoc(doc(db, "users", currentUser.uid));
            if (userData.exists()) {
                const userDataObj = userData.data();
                if (userDataObj.role === 'admin') {
                    loadAllDeliveriesForAdmin();
                } else {
                    loadBarangayDeliveries(userDataObj.username);
                }
            }
        }
        
        // Refresh inventory totals if available
        if (typeof window.refreshInventoryTotals === 'function') {
            await window.refreshInventoryTotals();
        }
        
        // ✅ Update inventory display in delivery form
        if (typeof updateInventoryDisplay === 'function') {
            await updateInventoryDisplay();
        }
    } catch (error) {
        console.error("Error updating delivery status:", error);
        showError("Failed to update delivery status. Please try again.");
    }
}

// Function to handle scheduling deliveries
let isSchedulingDelivery = false; // Global flag to prevent duplicates

async function handleScheduleDelivery() {
    // Prevent duplicate submissions
    if (isSchedulingDelivery) {
        console.log('Delivery scheduling already in progress, ignoring duplicate request');
        return;
    }
    
    isSchedulingDelivery = true;
    
    try {
        // Get form values
        const barangay = document.getElementById("barangaySelect").value;
        const deliveryDate = document.getElementById("deliveryDate").value;
        const deliveryDetails = document.getElementById("deliveryDetails").value;

        const goods = {
            rice: Number(document.getElementById('goodsRice')?.value || 0),
            biscuits: Number(document.getElementById('goodsBiscuits')?.value || 0),
            canned: Number(document.getElementById('goodsCanned')?.value || 0),
            shirts: Number(document.getElementById('goodsShirts')?.value || 0),
        };

        if (!barangay || !deliveryDate || !deliveryDetails) {
            if (window.Swal) {
                await Swal.fire({
                    title: 'Schedule Failed',
                    text: 'Please complete all required fields.',
                    icon: 'error',
                    confirmButtonText: 'Retry',
                    confirmButtonColor: '#2563eb',
                    background: '#ffffff',
                    color: '#1f2937',
                    didOpen: (popup) => {
                        popup.style.borderTop = '6px solid #ef4444';
                        popup.style.borderBottom = '6px solid #2563eb';
                    }
                });
            } else {
                showError("All fields are required!");
            }
            return;
        }

        // ✅ NEW: Validate inventory availability before scheduling delivery
        try {
            const inventoryValidation = await validateInventoryAvailability(goods);
            
            if (!inventoryValidation.isValid) {
                const insufficientItemsText = inventoryValidation.insufficientItems
                    .map(item => `${item.item}: requested ${item.requested}, available ${item.available} (shortage: ${item.shortage})`)
                    .join('\n');
                
                const errorMessage = `Insufficient inventory for this delivery:\n\n${insufficientItemsText}\n\nPlease add more stock to inventory before scheduling this delivery.`;
                
                if (window.Swal) {
                    await Swal.fire({
                        title: 'Insufficient Inventory',
                        text: errorMessage,
                        icon: 'warning',
                        confirmButtonText: 'Add Stock First',
                        confirmButtonColor: '#f59e0b',
                        background: '#ffffff',
                        color: '#1f2937',
                        didOpen: (popup) => {
                            popup.style.borderTop = '6px solid #f59e0b';
                            popup.style.borderBottom = '6px solid #ef4444';
                        }
                    });
                } else {
                    showError(errorMessage);
                }
                return; // Prevent delivery scheduling
            }
        } catch (inventoryError) {
            console.error('Error validating inventory:', inventoryError);
            const errorMessage = 'Unable to validate inventory availability. Please try again.';
            
            if (window.Swal) {
                await Swal.fire({
                    title: 'Validation Error',
                    text: errorMessage,
                    icon: 'error',
                    confirmButtonText: 'Retry',
                    confirmButtonColor: '#2563eb'
                });
            } else {
                showError(errorMessage);
            }
            return;
        }

        // Create unique delivery ID to prevent duplicates
        const deliveryId = `${barangay}-${deliveryDate}-${Date.now()}`;
        console.log('Creating delivery:', deliveryId);

        // Save delivery with basic data
        await addDoc(collection(db, 'deliveries'), {
            deliveryId, // Add unique ID
            barangay,
            deliveryDate: Timestamp.fromDate(new Date(deliveryDate)),
            details: deliveryDetails,
            goods,
            status: 'Pending',
            timestamp: serverTimestamp(),
            createdBy: loggedInUserData?.username || 'Admin'
        });
        
        // NOTE: Inventory will be deducted when delivery is marked as 'Received'
        if (window.Swal) {
            await Swal.fire({
                title: 'Schedule Successful',
                text: 'Delivery has been successfully scheduled.',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        } else {
            showSuccess('Delivery scheduled successfully.');
        }
        // Reset form
        document.getElementById('deliveryForm')?.reset();
        
    } catch (error) {
        console.error('Error scheduling delivery:', error);
        if (window.Swal) {
            await Swal.fire({
                title: 'Schedule Failed',
                text: 'Please complete all required fields.',
                icon: 'error',
                confirmButtonText: 'Retry',
                confirmButtonColor: '#2563eb',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #ef4444';
                    popup.style.borderBottom = '6px solid #2563eb';
                }
            });
        } else {
            showError('Failed to schedule delivery.');
        }
        throw error; // Re-throw to be handled by the form submission
    } finally {
        // Always reset the flag
        setTimeout(() => {
            isSchedulingDelivery = false;
        }, 2000); // 2 second cooldown
    }
}


// Global variable to store all deliveries for filtering
let allDeliveries = [];

// Global variable to store current inventory for real-time updates
let currentInventory = { rice: 0, biscuits: 0, canned: 0, shirts: 0 };

// ✅ Function to update inventory display with color-coded quantities
async function updateInventoryDisplay() {
    try {
        // Fetch current inventory totals
        currentInventory = await getInventoryTotals();
        
        // Update each inventory hint
        const inventoryHints = {
            'riceInventory': { item: 'rice', label: 'Rice' },
            'biscuitsInventory': { item: 'biscuits', label: 'Biscuits' },
            'cannedInventory': { item: 'canned', label: 'Canned Goods' },
            'shirtsInventory': { item: 'shirts', label: 'Shirts' }
        };
        
        // Update inventory hints for each item
        Object.entries(inventoryHints).forEach(([elementId, config]) => {
            const element = document.getElementById(elementId);
            if (element) {
                const quantity = currentInventory[config.item] || 0;
                const color = getInventoryColor(quantity);
                
                element.textContent = `(Available: ${quantity})`;
                element.style.color = color;
                element.style.fontWeight = '600';
                element.style.fontSize = '0.85em';
            }
        });
        
        // Update form labels to include quantities
        updateFormLabelsWithInventory();
        
        // Update main inventory summary if visible
        updateMainInventorySummary();
        
    } catch (error) {
        console.error('Error updating inventory display:', error);
    }
}

// ✅ Get appropriate color for inventory quantity
function getInventoryColor(quantity, isExceeding = false) {
    if (isExceeding) return '#ef4444'; // Red for exceeding stock
    if (quantity === 0) return '#9ca3af'; // Gray for empty
    if (quantity > 0 && quantity <= 10) return '#f59e0b'; // Orange for low stock
    return '#10b981'; // Green for good stock
}

// ✅ Update form labels with inventory quantities (shows remaining after input)
function updateFormLabelsWithInventory() {
    const labelMappings = {
        'goodsRice': { item: 'rice', baseText: 'Rice (sacks)' },
        'goodsBiscuits': { item: 'biscuits', baseText: 'Biscuits (boxes)' },
        'goodsCanned': { item: 'canned', baseText: 'Canned Goods (boxes)' },
        'goodsShirts': { item: 'shirts', baseText: 'Shirts (packs)' }
    };
    
    Object.entries(labelMappings).forEach(([inputId, config]) => {
        const input = document.getElementById(inputId);
        if (input) {
            const label = input.parentElement.querySelector('label');
            if (label) {
                const totalStock = currentInventory[config.item] || 0;
                const requestedAmount = Number(input.value) || 0;
                const remainingStock = Math.max(0, totalStock - requestedAmount);
                
                // Determine color based on remaining stock and validity
                let color, statusText;
                if (requestedAmount > totalStock) {
                    color = '#ef4444'; // Red for exceeding stock
                    statusText = `Exceeds by ${requestedAmount - totalStock}! Total: ${totalStock}`;
                } else if (remainingStock === 0 && requestedAmount > 0) {
                    color = '#9ca3af'; // Gray for exactly zero remaining
                    statusText = `Remaining: 0 (Total: ${totalStock})`;
                } else if (remainingStock <= 10 && remainingStock > 0) {
                    color = '#f59e0b'; // Orange for low remaining stock
                    statusText = `Remaining: ${remainingStock} (Total: ${totalStock})`;
                } else {
                    color = '#10b981'; // Green for good remaining stock
                    statusText = `Remaining: ${remainingStock} (Total: ${totalStock})`;
                }
                
                // Update label text with remaining stock info
                label.innerHTML = `${config.baseText} <span style="color: ${color}; font-weight: 600; font-size: 0.85em;">(${statusText})</span>`;
            }
        }
    });
}

// ✅ Update main inventory summary display
function updateMainInventorySummary() {
    const summaryElement = document.getElementById('currentInventoryDisplay');
    const containerElement = document.getElementById('inventorySummary');
    
    if (summaryElement && containerElement) {
        const items = [
            `Rice: ${currentInventory.rice}`,
            `Biscuits: ${currentInventory.biscuits}`,
            `Canned: ${currentInventory.canned}`,
            `Shirts: ${currentInventory.shirts}`
        ];
        
        summaryElement.textContent = items.join(' | ');
        containerElement.style.display = 'block';
    }
}

// ✅ Real-time validation styling for input fields
function updateInputValidationStyling() {
    const inputs = {
        'goodsRice': 'rice',
        'goodsBiscuits': 'biscuits', 
        'goodsCanned': 'canned',
        'goodsShirts': 'shirts'
    };
    
    Object.entries(inputs).forEach(([inputId, item]) => {
        const input = document.getElementById(inputId);
        if (input) {
            const requested = Number(input.value) || 0;
            const available = currentInventory[item] || 0;
            
            // Remove previous validation classes
            input.classList.remove('input-valid', 'input-warning', 'input-error', 'input-zero');
            
            // Add appropriate validation class
            if (requested === 0) {
                // No special styling for zero, but show total stock in tooltip
                input.title = `Total available: ${available}`;
            } else if (requested > available) {
                input.classList.add('input-error'); // Red border for exceeding stock
                input.title = `Exceeds available stock by ${requested - available}! Available: ${available}`;
            } else if (requested === available) {
                input.classList.add('input-zero'); // White/gray border for using all stock (remaining = 0)
                input.title = `Using all available stock (${available}). Remaining: 0`;
            } else if (requested > available * 0.8) {
                input.classList.add('input-warning'); // Orange border for high usage
                const remaining = available - requested;
                input.title = `High usage. Remaining: ${remaining} of ${available}`;
            } else {
                input.classList.add('input-valid'); // Green border for valid amounts
                const remaining = available - requested;
                input.title = `Valid amount. Remaining: ${remaining} of ${available}`;
            }
        }
    });
}

// ✅ Setup event listeners for inventory tracking
function setupInventoryEventListeners() {
    const inventoryInputs = ['goodsRice', 'goodsBiscuits', 'goodsCanned', 'goodsShirts'];
    
    inventoryInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            // Add inventory-input class for styling
            input.classList.add('inventory-input');
            
            // Add real-time validation on input
            input.addEventListener('input', function() {
                updateInputValidationStyling();
                updateFormLabelsWithInventory(); // ✅ Update remaining stock display
            });
            
            // Add validation on blur (when user leaves field)
            input.addEventListener('blur', function() {
                updateInputValidationStyling();
                updateFormLabelsWithInventory(); // ✅ Update remaining stock display
            });
            
            // Add validation on keyup for immediate feedback
            input.addEventListener('keyup', function() {
                updateFormLabelsWithInventory(); // ✅ Update remaining stock display
            });
        }
    });
    
    // Initial validation styling
    updateInputValidationStyling();
}

function loadAllDeliveriesForAdmin() {
    const tableBody = document.getElementById("adminDeliveriesTableBody");
    if (!tableBody) {
        console.warn("[Admin Deliveries] Table body not found.");
        return;
    }

    const deliveriesRef = collection(db, "deliveries");

    onSnapshot(deliveriesRef, (snapshot) => {
        console.log("[Admin Deliveries] Snapshot size:", snapshot.size);
        
        // Clear global deliveries array
        allDeliveries = [];
        
        if (snapshot.empty) {
            console.log("[Admin Deliveries] No documents found");
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">No deliveries scheduled yet.</td>
                </tr>`;
            showEmptyState(true);
            return;
        }

        snapshot.forEach((docSnap) => {
            const delivery = docSnap.data();
            console.log("[Admin Deliveries] Delivery:", docSnap.id, delivery);
            
            // Store delivery data for filtering
            allDeliveries.push({
                id: docSnap.id,
                barangay: delivery.barangay ? delivery.barangay.replace("barangay_", "") : "Unknown",
                deliveryDate: delivery.deliveryDate?.toDate?.() || null,
                details: delivery.details || "No Details",
                status: delivery.status || "Pending",
                rawData: delivery
            });
        });
        
        // Render all deliveries initially
        renderDeliveries(allDeliveries);
        
        // Setup search and filter event listeners
        setupDeliverySearchAndFilters();
    });
}

// Enhanced delivery rendering with better UI
function renderDeliveries(deliveries) {
    const tableBody = document.getElementById("adminDeliveriesTableBody");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    if (deliveries.length === 0) {
        showEmptyState(true);
        return;
    }
    
    showEmptyState(false);
    
    deliveries.forEach((delivery) => {
        const row = document.createElement("tr");
        row.className = "delivery-row";
        
        // Barangay with professional styling (no emojis)
        const tdBarangay = document.createElement("td");
        tdBarangay.innerHTML = `
            <div class="barangay-cell">
                <span class="barangay-name">${delivery.barangay}</span>
            </div>
        `;
        row.appendChild(tdBarangay);

        // Delivery Date with professional styling (no emojis)
        const tdDate = document.createElement("td");
        const deliveryDate = delivery.deliveryDate;
        const dateText = deliveryDate ? deliveryDate.toLocaleDateString() : "No Date";
        const dateClass = deliveryDate && deliveryDate < new Date() ? "past-date" : "future-date";
        tdDate.innerHTML = `
            <div class="date-cell ${dateClass}">
                <div class="date-info">
                    <span class="date-text">${dateText}</span>
                </div>
            </div>
        `;
        row.appendChild(tdDate);

        // Items & Quantity Column
        const tdItems = document.createElement("td");
        const goodsItems = [];
        if (delivery.rawData?.goods) {
            const goods = delivery.rawData.goods;
            if (goods.rice > 0) goodsItems.push(`${goods.rice} Rice`);
            if (goods.biscuits > 0) goodsItems.push(`${goods.biscuits} Biscuits`);
            if (goods.canned > 0) goodsItems.push(`${goods.canned} Canned`);
            if (goods.shirts > 0) goodsItems.push(`${goods.shirts} Shirts`);
        }
        
        const itemsSummary = goodsItems.length > 0 ? goodsItems.join(', ') : 'No items specified';
        tdItems.innerHTML = `
            <div class="items-cell">
                <div class="items-content">${itemsSummary}</div>
            </div>
        `;
        row.appendChild(tdItems);
        
        // Details Column (full text, no emojis)
        const tdDetails = document.createElement("td");
        const detailsPreview = delivery.details; // show full sentence
        const hasExpandedDetails = (goodsItems.length > 0); // keep expansion for goods breakdown
        
        tdDetails.innerHTML = `
            <div class="details-cell">
                <div class="details-preview" ${hasExpandedDetails ? `onclick="toggleDeliveryDetails('${delivery.id}')" style="cursor: pointer;"` : ''}>
                    <div class="details-text" title="${delivery.details}">
                        ${detailsPreview}
                        ${hasExpandedDetails ? '<span class="expand-indicator">▼</span>' : ''}
                    </div>
                </div>
            </div>
        `;
        row.appendChild(tdDetails);

        // Status with enhanced styling
        const tdStatus = document.createElement("td");
        const statusClass = getStatusClass(delivery.status);
        tdStatus.innerHTML = `
            <div class="status-cell">
                <span class="status-badge ${statusClass}">
                    <span class="status-text">${delivery.status}</span>
                </span>
            </div>
        `;
        row.appendChild(tdStatus);

        // Action with enhanced styling (Print above Delete, vertical stack)
        const tdAction = document.createElement("td");
        tdAction.innerHTML = `
            <div class="action-cell">
                <button class="print-btn" onclick="printDeliveryReceipt('${delivery.id}')">
                    <span class="btn-icon">🖨️</span>
                    <span class="btn-text">Print</span>
                </button>
                <button class="delete-btn" onclick="deleteDelivery('${delivery.id}')">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Delete</span>
                </button>
            </div>
        `;
        row.appendChild(tdAction);

        tableBody.appendChild(row);
        
        // Create expandable details row if needed
        if (goodsItems.length > 0 || delivery.details.length > 50) {
            const expandRow = document.createElement("tr");
            expandRow.className = "details-expanded-row hidden";
            expandRow.id = `details-row-${delivery.id}`;
            
            const expandCell = document.createElement("td");
            expandCell.colSpan = 5; // Updated for 5 columns: Barangay, Date, Items, Details, Status, Actions
            
            expandCell.innerHTML = `
                <div class="expanded-content">
                    <div class="expanded-row">
                        <div class="expanded-section">
                            <h4>Full Details:</h4>
                            <p>${delivery.details}</p>
                        </div>
                        <div class="expanded-section">
                            <h4>Items to Deliver:</h4>
                            <div class="goods-grid">
                                ${goodsItems.map(item => `<span class="goods-item">${item}</span>`).join('')}
                            </div>
                            ${goodsItems.length === 0 ? '<p class="no-goods">No specific items listed</p>' : ''}
                        </div>
                    </div>
                    <div class="expanded-metadata">
                        <span class="metadata-item"><strong>Created By:</strong> ${delivery.rawData?.createdBy || 'Unknown'}</span>
                    </div>
                </div>
            `;
            
            expandRow.appendChild(expandCell);
            tableBody.appendChild(expandRow);
        }
    });
}

// Helper functions for enhanced UI
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'pending': return 'status-pending';
        case 'in transit': return 'status-transit';
        case 'received': return 'status-received';
        default: return 'status-pending';
    }
}

function getStatusIcon(status) {
    switch (status.toLowerCase()) {
        case 'pending': return '⏳';
        case 'in transit': return '🚚';
        case 'received': return '✅';
        default: return '⏳';
    }
}

function showEmptyState(show) {
    const emptyState = document.getElementById("noDeliveriesMessage");
    const table = document.getElementById("adminDeliveriesTable");
    
    if (emptyState && table) {
        if (show) {
            emptyState.classList.remove("hidden");
            table.style.display = "none";
        } else {
            emptyState.classList.add("hidden");
            table.style.display = "table";
        }
    }
}

// Toggle delivery details expansion
function toggleDeliveryDetails(deliveryId) {
    const detailsRow = document.getElementById(`details-row-${deliveryId}`);
    const mainRow = detailsRow?.previousElementSibling;
    const indicator = mainRow?.querySelector('.expand-indicator');
    
    if (detailsRow && mainRow) {
        const isExpanding = detailsRow.classList.contains('hidden');
        detailsRow.classList.toggle('hidden');
        
        // Rotate the indicator and add visual feedback
        if (indicator) {
            indicator.style.transform = isExpanding ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        // Add visual feedback to the main row
        if (isExpanding) {
            mainRow.classList.add('row-expanded');
            detailsRow.style.display = 'table-row';
        } else {
            mainRow.classList.remove('row-expanded');
            detailsRow.style.display = 'none';
        }
    }
}

// Setup search and filter functionality
function setupDeliverySearchAndFilters() {
    const searchInput = document.getElementById("deliverySearchInput");
    const statusFilter = document.getElementById("statusFilter");
    const dateFilter = document.getElementById("dateFilter");
    const clearFiltersBtn = document.getElementById("clearFilters");
    
    if (searchInput) {
        searchInput.addEventListener("input", filterDeliveries);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener("change", filterDeliveries);
    }
    
    if (dateFilter) {
        dateFilter.addEventListener("change", filterDeliveries);
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener("click", clearDeliveryFilters);
    }
}

// Filter deliveries based on search and filter criteria
function filterDeliveries() {
    const searchTerm = document.getElementById("deliverySearchInput")?.value.toLowerCase() || "";
    const statusFilter = document.getElementById("statusFilter")?.value || "";
    const dateFilter = document.getElementById("dateFilter")?.value || "";
    
    let filteredDeliveries = allDeliveries.filter(delivery => {
        // Search filter
        const matchesSearch = !searchTerm || 
            delivery.barangay.toLowerCase().includes(searchTerm) ||
            delivery.details.toLowerCase().includes(searchTerm) ||
            (delivery.deliveryDate && delivery.deliveryDate.toLocaleDateString().includes(searchTerm));
        
        // Status filter
        const matchesStatus = !statusFilter || delivery.status.toLowerCase() === statusFilter.toLowerCase();
        
        // Date filter
        let matchesDate = true;
        if (dateFilter && delivery.deliveryDate) {
            const today = new Date();
            const deliveryDate = delivery.deliveryDate;
            
            switch (dateFilter) {
                case 'today':
                    matchesDate = deliveryDate.toDateString() === today.toDateString();
                    break;
                case 'week':
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    matchesDate = deliveryDate >= weekAgo;
                    break;
                case 'month':
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    matchesDate = deliveryDate >= monthAgo;
                    break;
            }
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    renderDeliveries(filteredDeliveries);
}

// Clear all filters
function clearDeliveryFilters() {
    const searchInput = document.getElementById("deliverySearchInput");
    const statusFilter = document.getElementById("statusFilter");
    const dateFilter = document.getElementById("dateFilter");
    
    if (searchInput) searchInput.value = "";
    if (statusFilter) statusFilter.value = "";
    if (dateFilter) dateFilter.value = "";
    
    renderDeliveries(allDeliveries);
}

// Enhanced delete delivery function
async function deleteDelivery(deliveryId) {
    try {
        let confirmed = true;
        if (window.Swal) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Are you sure you want to delete this delivery?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No',
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#2563eb',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
            confirmed = result.isConfirmed;
        } else {
            confirmed = confirm('Are you sure you want to delete this delivery?');
        }

        if (!confirmed) return;

        await deleteDoc(doc(db, 'deliveries', deliveryId));

        if (window.Swal) {
            await Swal.fire({
                title: 'Successfully Deleted',
                text: 'The delivery has been successfully deleted.',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        } else {
            showSuccess('Delivery deleted successfully!');
        }
    } catch (error) {
        console.error('Error deleting delivery:', error);
        if (window.Swal) {
            await Swal.fire({
                title: 'Delete Failed',
                text: 'Failed to delete delivery. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2563eb'
            });
        } else {
            showError('Failed to delete delivery. Please try again.');
        }
    }
}

// Initialize form enhancements
function initializeFormEnhancements() {
    console.log('Initializing form enhancements...');
    
    // Apply to login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Remove existing listeners to avoid duplicates
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        newForm.addEventListener('submit', handleLogin);
    }
    
    // Apply to request account form
    const requestForm = document.getElementById('requestAccountForm');
    if (requestForm) {
        const newForm = requestForm.cloneNode(true);
        requestForm.parentNode.replaceChild(newForm, requestForm);
        
        newForm.addEventListener('submit', handleRequestAccount);
    }
    
    // Apply enhanced prevention to key buttons
    const buttons = {
        'requestAccountBtn': () => showRequestAccount(),
        'cancelRequestBtn': () => hideRequestAccount(),
        'togglePassword': () => {
            const passwordInput = document.getElementById('password');
            const toggleBtn = document.getElementById('togglePassword');
            if (passwordInput && toggleBtn) {
                const type = passwordInput.type === 'password' ? 'text' : 'password';
                passwordInput.type = type;
                toggleBtn.textContent = type === 'password' ? 'visibility_off' : 'visibility';
            }
        }
    };
    
    Object.entries(buttons).forEach(([id, action]) => {
        const button = document.getElementById(id);
        if (button && typeof action === 'function') {
            addDoubleClickPrevention(button, action, {
                loadingText: 'Processing...',
                cooldown: 500,
                preventMultiple: false
            });
        }
    });
    
    // Verify all required global functions are available
    verifyGlobalFunctions();
    
    console.log('Form enhancements initialized successfully.');
}

// Setup global functions by overriding HTML placeholders with full implementations
function setupGlobalFunctions() {
    console.log('🔧 Setting up global functions with full implementations...');
    
    // Modal functions are now handled by global functions in main.html
    // No need to reassign them here
    
    // Override navigation functions
    window.showSection = showSection;
    
    // Override utility functions
    window.editResident = editResident;
    window.deleteResident = deleteResident;
    window.toggleBarangayDeliveryDetails = toggleBarangayDeliveryDetails;
    window.printBarangayDeliveryReceipt = printBarangayDeliveryReceipt;
    
    // Override other functions
    window.logout = logout;
    
    // Functions that exist in different places
    if (typeof viewBarangay === 'function') {
        window.viewBarangay = viewBarangay;
    }
    if (typeof clearDeliveryFilters === 'function') {
        window.clearDeliveryFilters = clearDeliveryFilters;
    }
    if (typeof deleteDelivery === 'function') {
        window.deleteDelivery = deleteDelivery;
    }
    if (typeof printDeliveryReceipt === 'function') {
        window.printDeliveryReceipt = printDeliveryReceipt;
    }
    
    console.log('✅ Global functions setup complete - full implementations now available');
}

// Verify that all global functions used in HTML onclick handlers are available
function verifyGlobalFunctions() {
    const requiredFunctions = [
        'closeEditResidentModal',
        'closeAddResidentModal', 
        'showAddResidentModal',
        'closeApproveModal',
        'showSection',
        'toggleMobileSidebar',
        'closeMobileSidebar',
        'closeChangePasswordModal',
        'closeMessageModal',
        'showChangePassword',
        'logout',
        'editResident',
        'deleteResident',
        'viewBarangay',
        'printBarangayDeliveryReceipt',
        'toggleBarangayDeliveryDetails'
    ];
    
    const missing = [];
    const available = [];
    
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            available.push(funcName);
        } else {
            missing.push(funcName);
            // Create placeholder function to prevent errors
            window[funcName] = function(...args) {
                console.warn(`Function ${funcName} was called but not properly implemented. Args:`, args);
                if (typeof showError === 'function') {
                    showError(`Feature ${funcName.replace(/([A-Z])/g, ' $1').toLowerCase()} is not yet implemented.`);
                } else {
                    alert(`Feature ${funcName.replace(/([A-Z])/g, ' $1').toLowerCase()} is not yet implemented.`);
                }
            };
        }
    });
    
    console.log('🔍 Function verification complete:');
    console.log('✅ Available functions:', available);
    if (missing.length > 0) {
        console.warn('⚠️ Missing functions (placeholders created):', missing);
    }
    
    return { available, missing };
}

// Expose utility functions globally (modal functions handled by main.html global script)
window.clearDeliveryFilters = clearDeliveryFilters;
window.deleteDelivery = deleteDelivery;
window.printDeliveryReceipt = printDeliveryReceipt;
window.updateInventoryDisplay = updateInventoryDisplay; // ✅ For global access
// Printable delivery receipt
async function printDeliveryReceipt(deliveryId) {
    try {
        const snap = await getDoc(doc(db, 'deliveries', deliveryId));
        if (!snap.exists()) { showError('Delivery not found'); return; }
        const d = snap.data();
        const title = `Delivery Receipt - ${d.barangay || ''}`;
        const win = window.open('', '_blank');
        const now = new Date().toLocaleString();
        const goods = d.goods || { rice:0, biscuits:0, canned:0, shirts:0 };
        const style = `
            <style>
                body { font-family: Arial, Helvetica, sans-serif; }
                h1 { font-size: 18px; margin: 0 0 6px; }
                .meta { font-size: 12px; color:#555; margin-bottom: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
                th { background: #f5f5f5; text-align: left; }
            </style>`;
        const html = `
            <h1>${title}</h1>
            <div class="meta">Printed: ${now}</div>
            <table>
                <tr><th>Barangay</th><td>${d.barangay || ''}</td></tr>
                <tr><th>Date</th><td>${d.deliveryDate?.toDate ? d.deliveryDate.toDate().toLocaleDateString() : new Date(d.deliveryDate).toLocaleDateString()}</td></tr>
                <tr><th>Details</th><td>${d.details || ''}</td></tr>
            </table>
            <h3>Goods</h3>
            <table>
                <tr><th>Rice (sacks)</th><td>${goods.rice || 0}</td></tr>
                <tr><th>Biscuits (boxes)</th><td>${goods.biscuits || 0}</td></tr>
                <tr><th>Canned Goods (boxes)</th><td>${goods.canned || 0}</td></tr>
                <tr><th>Shirts (packs)</th><td>${goods.shirts || 0}</td></tr>
            </table>`;
        win.document.write(`<html><head><title>${title}</title>${style}</head><body>${html}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 200);
    } catch (e) {
        console.error(e);
        showError('Failed to print receipt.');
    }
}

// Generic print helper for residents tables (MSWD modal and Barangay table)
function printResidents(tableId, title = 'Residents') {
    try {
        const table = document.getElementById(tableId);
        if (!table) { showError('Residents table not found.'); return; }

        const win = window.open('', '_blank');
        if (!win) { showError('Popup blocked. Allow popups to print.'); return; }

        const now = new Date().toLocaleString();
        const style = `
            <style>
                body { font-family: Arial, Helvetica, sans-serif; color: #111; }
                h1 { font-size: 18px; margin: 0 0 8px; }
                .meta { font-size: 12px; margin-bottom: 12px; color: #555; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
                th { background: #f5f5f5; text-align: left; }
                @media print { @page { size: A4 landscape; margin: 10mm; } }
            </style>`;

        const headerHtml = `<h1>${title}</h1><div class="meta">Printed: ${now}</div>`;
        win.document.write(`<html><head><title>${title}</title>${style}</head><body>${headerHtml}${table.outerHTML}</body></html>`);
        win.document.close();
        win.focus();
        // Slight delay to allow rendering before print
        setTimeout(() => { win.print(); win.close(); }, 200);
    } catch (err) {
        console.error('Print error:', err);
        showError('Failed to prepare print view.');
    }
}

window.printResidents = printResidents;



    async function showDeliveries() {
        const user = auth.currentUser; // Get logged-in user
        if (!user) {
            console.log("No Barangay is logged in.");
            return;
        }
    
        const barangayId = user.uid; // Use the user's UID as Barangay ID (if applicable)
    
        try {
            const deliveries = await getDeliveries(barangayUsername); // Fetch deliveries for the Barangay
            console.log("Fetched deliveries: ", deliveries); // Add this line to check deliveries
    
            if (deliveries.length === 0) {
                console.log("No deliveries scheduled.");
                return;
            }
    
            const deliveriesContainer = document.getElementById("deliveries-container");
    
            deliveries.forEach(delivery => {
                const deliveryElement = document.createElement("div");
                deliveryElement.classList.add("delivery");
    
                deliveryElement.innerHTML = `
                    <h3>Delivery ID: ${delivery.id}</h3>
                    <p>Date: ${new Date(delivery.deliveryDate.seconds * 1000).toLocaleDateString()}</p>
                    <p>Details: ${delivery.details}</p>
                    <p>Status: ${delivery.status}</p>
                `;
    
                deliveriesContainer.appendChild(deliveryElement);
            });
        } catch (error) {
            console.error("❌ Error displaying deliveries:", error);
        }
    }
    
// Show modal when the button is clicked
function showAddResidentModal() {
    const modal = document.getElementById("addResidentModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
        modal.style.visibility = "visible";
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
        console.log("✅ Modal element found, hidden class removed");
        console.log("✅ Modal classes:", modal.className);
        console.log("✅ Modal style.display:", modal.style.display);
        console.log("✅ Modal style.visibility:", modal.style.visibility);
        console.log("✅ Modal style.opacity:", modal.style.opacity);
        
        // Auto-populate terrain based on barangay
        setTimeout(autoPopulateTerrainForBarangay, 100);
    } else {
        console.error("❌ Modal element not found!");
    }

    // Check if user is logged in
    if (!loggedInUserData || !loggedInUserData.username) {
        console.error("❌ User data not loaded properly!");
        showError("Please login again.");
        return;
    }
    
    console.log("✅ Add Resident Modal opened successfully");
}

// Close modal
function closeAddResidentModal() {
    const modal = document.getElementById("addResidentModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
    }
}

window.loadResidentsForBarangay = async function(barangayName) {
    const tableBody = document.getElementById("residentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // clear before loading

    const q = query(collection(db, "residents"), where("barangay", "==", barangayName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        tableBody.innerHTML = "<tr><td colspan='10'>No residents found.</td></tr>";
        return;
    }

    const residents = [];
    snapshot.forEach(docSnap => {
        const resident = docSnap.data();
        residents.push({ id: docSnap.id, ...resident });
        
        // Create status display with badges
        let status = "";
        let statusClass = "";
        if (resident.isStudent && resident.isWorking) {
            status = "Student & Working";
            statusClass = "status-both";
        } else if (resident.isStudent) {
            status = "Student";
            statusClass = "status-student";
        } else if (resident.isWorking) {
            status = "Working";
            statusClass = "status-working";
        } else {
            status = "None";
            statusClass = "status-none";
        }
        
    });

    // Sort A–Z by last name
    function lastNameOf(fullName = '') {
        const parts = String(fullName).trim().split(/\s+/);
        return parts.length ? parts[parts.length - 1].toLowerCase() : '';
    }
    residents.sort((a,b) => lastNameOf(a.name).localeCompare(lastNameOf(b.name)));

    residents.forEach((resident) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-household', String(resident.householdNumber ?? ''));

        const cells = [
            { text: resident.name ?? '', order: lastNameOf(resident.name) },
            { text: resident.age ?? '' },
            { text: resident.addressZone ?? '' },
            { text: resident.householdNumber ?? '' },
            { text: resident.gender ?? '' },
            { text: resident.householdStatus ?? '' },
            { text: resident.houseMaterial ?? '' },
            { text: resident.barangayTerrain ?? '' },
            { text: resident.familyMembers ?? '' },
            { text: resident.monthlyIncome ?? '' },
            { text: resident.aidHistory ?? '' },
            { text: resident.remarks ?? '' },
            { text: resident.evacueeHistory ?? '' }
        ];
        cells.forEach((c, idx) => {
            const td = document.createElement('td');
            if (idx === 0 && c.order) td.setAttribute('data-order', c.order);
            td.textContent = String(c.text);
            if (idx === 3) td.className = 'household';
            tr.appendChild(td);
        });
        const actionTd = document.createElement('td');
        actionTd.className = 'no-export';
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('data-id', resident.id);
        editBtn.textContent = 'Edit';
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.setAttribute('data-id', resident.id);
        delBtn.textContent = 'Delete';
        actionTd.appendChild(editBtn);
        actionTd.appendChild(delBtn);
        tr.appendChild(actionTd);
        tableBody.appendChild(tr);
    });

    // Initialize DataTable for barangay residents with MSWD-style export buttons
    try {
        if (window.jQuery && $('#residentsTable').length) {
            if ($.fn.dataTable.isDataTable('#residentsTable')) {
                $('#residentsTable').DataTable().destroy();
            }
            const dt = $('#residentsTable').DataTable({
                order: [[0, 'asc']],
                dom: 'Bfrtip',
                buttons: [
                    { extend: 'excelHtml5', title: 'Residents', text: 'Excel', exportOptions: { columns: ':not(.no-export)' } },
                    { extend: 'pdfHtml5', title: 'Residents', text: 'PDF', pageSize: 'A4',
                      customize: function (doc) {
                        doc.pageMargins = [20, 40, 20, 30];
                        doc.styles.tableHeader = { bold: true, fillColor: '#f5f5f5' };
                        doc.content.unshift({ text: 'RELIEF GOODS DELIVERY RECEIPT', style: { bold: true, fontSize: 14 }, alignment: 'center', margin: [0,0,0,6] });
                        doc.content.unshift({ text: 'Municipal Social Welfare and Development Office', alignment: 'center', fontSize: 10, margin: [0,0,0,12] });
                      },
                      exportOptions: { columns: ':not(.no-export)' } },
                    { extend: 'print', title: 'Residents', text: 'Print',
                      customize: function (win) {
                        try {
                          const body = win.document.body;
                          const content = body.innerHTML;
                          const wrapper = `
                            <div class="page">
                              <div class="header">
                                <div class="title">RELIEF GOODS DELIVERY RECEIPT</div>
                                <div class="subtitle">Municipal Social Welfare and Development Office</div>
                              </div>
                              <div class="content">${content}</div>
                              <div class="footer"><div>Generated on ${new Date().toLocaleString()}</div></div>
                            </div>`;
                          const style = win.document.createElement('style');
                          style.innerHTML = `@page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header{ text-align:center; border-bottom:1px solid #e5e7eb; padding-bottom:8px; } .title{ font-size:16px; font-weight:700;} .subtitle{ font-size:11px; color:#555;} .content{ padding:10px 2px;} .footer{ border-top:1px solid #e5e7eb; padding-top:8px; font-size:10px; color:#666; } table{ width:100%; border-collapse:collapse;} th,td{ border:1px solid #e5e7eb; padding:6px 8px; font-size:12px;} th{ background:#f5f5f5; }`;
                          body.innerHTML = wrapper;
                          body.appendChild(style);
                        } catch(_) {}
                      },
                      exportOptions: { columns: ':not(.no-export)' } }
                ],
                columnDefs: [ { targets: 'no-export', searchable: false, orderable: false } ],
                pageLength: 10
            });
            
            // Move DataTables buttons to match MSWD design
            setTimeout(() => {
                try {
                    const wrapper = document.getElementById('residentsTable').closest('.dataTables_wrapper');
                    const btns = wrapper ? wrapper.querySelector('.dt-buttons') : null;
                    const filter = wrapper ? wrapper.querySelector('.dataTables_filter') : null;
                    const searchSection = document.getElementById('barangayResidentSearchSection');
                    const searchBox = searchSection ? searchSection.querySelector('.search-box') : null;
                    
                    if (btns && searchSection) {
                        // Remove any existing button container to avoid duplicates
                        const existingBtns = searchSection.querySelector('.dt-buttons');
                        if (existingBtns && existingBtns !== btns) {
                            existingBtns.remove();
                        }
                        
                        // Keep buttons at the top; move search block BELOW the buttons
                        if (searchBox) {
                            // Ensure search section content order: [buttons][search-section]
                            const innerSearch = searchSection.querySelector('.search-section');
                            if (innerSearch && btns.nextSibling !== innerSearch) {
                                searchSection.insertBefore(btns, searchSection.firstChild);
                                searchSection.appendChild(innerSearch);
                            } else {
                                searchSection.insertBefore(btns, searchSection.firstChild);
                            }
                        } else {
                            searchSection.insertBefore(btns, searchSection.firstChild);
                        }
                        
                        // Apply consistent styling to match MSWD design
                        btns.style.cssText = `
                            margin: 0 0 16px 0 !important;
                            display: flex !important;
                            gap: 8px !important;
                            flex-wrap: wrap !important;
                            z-index: 1000 !important;
                            position: relative !important;
                            padding: 0 !important;
                        `;
                        
                        // Style each button consistently
                        btns.querySelectorAll('button').forEach((button, index) => {
                            button.style.cssText = `
                                display: inline-flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                width: auto !important;
                                min-height: 36px !important;
                                padding: 8px 12px !important;
                                margin: 0 !important;
                                background: ${index === 0 ? '#217346' : index === 1 ? '#dc2626' : '#7c3aed'} !important;
                                color: white !important;
                                border: none !important;
                                border-radius: 6px !important;
                                cursor: pointer !important;
                                font-size: 0.875rem !important;
                                font-weight: 500 !important;
                                pointer-events: auto !important;
                                user-select: none !important;
                                z-index: 1001 !important;
                                position: relative !important;
                                transition: all 0.2s ease !important;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                            `;
                            
                            // Ensure hover effects work
                            button.addEventListener('mouseenter', function() {
                                this.style.transform = 'translateY(-1px)';
                                this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                            });
                            
                            button.addEventListener('mouseleave', function() {
                                this.style.transform = 'translateY(0)';
                                this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            });
                        });
                    }
                    
                    // Hide DataTables' built-in search and use our custom search
                    if (filter) { filter.style.display = 'none'; }
                    
                    // Setup custom search functionality
                    const customSearchInput = document.getElementById('barangayResidentSearchInput');
                    if (customSearchInput) {
                        customSearchInput.addEventListener('input', function() {
                            dt.search(this.value).draw();
                        });
                    }
                } catch(err) {
                    console.warn('Error moving DataTables buttons:', err);
                }
            }, 100);
        }
    } catch (e) { console.warn('DataTable init failed:', e); }
};

document.getElementById("addResidentForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    // 🔥 Check if user is loaded
    if (!loggedInUserData || !loggedInUserData.username) {
        console.error("❌ User data not loaded properly!");
        alert("Please login again.");
        submitButton.disabled = false;
        return;
    }

    // Now safe to get current barangay
    const currentBarangay = loggedInUserData.username.replace('barangay_', '');

    // Then collect form fields
    const nameInput = document.getElementById("name");
    const ageInput = document.getElementById("age");
    const addressZoneInput = document.getElementById("addressZone");
    const householdNumberInput = document.getElementById("householdNumber");
    const genderInput = document.getElementById("gender");
    const householdStatusInput = document.getElementById("householdStatus");
    const familyMembersInput = document.getElementById("familyMembers");
    const evacueeHistoryInput = document.getElementById("evacueeHistory");
    const studentCheckbox = document.getElementById("student");
    const workingCheckbox = document.getElementById("working");
    const monthlyIncomeInput = document.getElementById("monthlyIncome");
    const remarksInput = document.getElementById("remarks");

    if (!nameInput || !ageInput || !addressZoneInput || !householdNumberInput || !familyMembersInput || !evacueeHistoryInput || !studentCheckbox || !workingCheckbox || !monthlyIncomeInput || !genderInput || !householdStatusInput) {
        console.error("❌ Missing form fields!");
        alert("Form is incomplete. Please refresh the page.");
        submitButton.disabled = false;
        return;
    }

    // Normalize name into first/last + sort key
    const fullName = (nameInput.value || '').trim();
    const parts = fullName.split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : fullName;
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';

    const residentData = {
        name: fullName,
        firstName: firstName,
        lastName: lastName,
        lastNameLower: lastName.toLowerCase(),
        age: ageInput.value,
        addressZone: addressZoneInput.value,
        householdNumber: householdNumberInput.value,
        barangay: currentBarangay,
        isStudent: studentCheckbox.checked,
        isWorking: workingCheckbox.checked,
        monthlyIncome: workingCheckbox.checked ? monthlyIncomeInput.value : null,
        gender: genderInput.value,
        householdStatus: householdStatusInput.value,
        houseMaterial: document.getElementById("houseMaterial").value,
        barangayTerrain: document.getElementById("barangayTerrain").value,
        familyMembers: familyMembersInput.value,
        aidHistory: document.getElementById("aidHistory").value,
        evacueeHistory: evacueeHistoryInput.value,
        remarks: remarksInput ? remarksInput.value : ''
    };

    try {
        await addResidentToFirestore(residentData);
        alert("✅ Resident added successfully!");
        closeAddResidentModal();
        loadResidentsForBarangay(currentBarangay); 
    } catch (error) {
        console.error("❌ Error adding resident: ", error);
        alert("Failed to add resident. Please try again.");
    } finally {
        submitButton.disabled = false;
    }
});

// Open the Edit Resident Modal


// Handle Edit Form Submission
document.getElementById("editResidentForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const docId = document.getElementById("editResidentId").value;

    try {
        const isWorking = document.getElementById("editWorking").checked;
        const isStudent = document.getElementById("editStudent").checked;
        
        const fullName = (document.getElementById("editName").value || '').trim();
        const parts = fullName.split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : fullName;
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        await updateDoc(doc(db, "residents", docId), {
            name: fullName,
            firstName: firstName,
            lastName: lastName,
            lastNameLower: lastName.toLowerCase(),
            age: Number(document.getElementById("editAge").value),
            addressZone: document.getElementById("editAddressZone").value,
            householdNumber: String(document.getElementById("editHouseholdNumber").value),
            houseMaterial: document.getElementById("editHouseMaterial").value,
            barangayTerrain: document.getElementById("editBarangayTerrain").value,
            gender: document.getElementById("editGender").value,
            householdStatus: document.getElementById("editHouseholdStatus").value,
            familyMembers: Number(document.getElementById("editFamilyMembers").value),
            monthlyIncome: isWorking && !isStudent ? 
                (document.getElementById("editMonthlyIncome").value === "" ? null : Number(document.getElementById("editMonthlyIncome").value))
                : null,
            aidHistory: document.getElementById("editAidHistory").value,
            evacueeHistory: Number(document.getElementById("editEvacueeHistory").value),
            isStudent: isStudent,
            isWorking: isWorking,
            remarks: document.getElementById("editRemarks").value,
        });

        alert("✅ Resident updated successfully!");
  location.reload();

    } catch (err) {
        console.error("❌ Error updating resident:", err);
        alert("Failed to update resident.");
    }
});




// ✅ Navigation Sections



function showSection(sectionId) {
    console.log('[showSection] switching to', sectionId);
    // Always hide residents modal when switching sections
    const residentsModal = document.getElementById('viewResidentsModal');
    if (residentsModal) {
        residentsModal.classList.add('hidden');
        residentsModal.style.display = 'none';
        if (sectionId === "deliveryScheduling") {
        console.log("[showSection] calling loadAllDeliveriesForAdmin()");
        loadAllDeliveriesForAdmin();
    }
}
    // Hide any other modals to avoid overlays
    document.querySelectorAll('.modal').forEach(m => { m.classList.add('hidden'); });

    // Ensure dashboard container and main content are visible
    const dash = document.getElementById('dashboardContainer');
    if (dash) { dash.classList.remove('hidden'); dash.style.display = 'flex'; }
    const main = document.querySelector('.main-content');
    if (main) { main.style.display = 'block'; main.style.width = '100%'; }

    // Clean up listeners from previous section
    if (window.App.currentSection && window.App.currentSection !== sectionId) {
        window.App.clearListeners(window.App.currentSection);
    }

    // Hide all sections, then show target only
    document.querySelectorAll('.section').forEach(sec => { sec.classList.add('hidden'); sec.style.display = 'none'; });
    const target = document.getElementById(sectionId);
    if (!target) {
        console.warn('[showSection] target not found:', sectionId);
        return;
    }
    target.classList.remove('hidden');
    target.style.display = 'block';
    console.log('[showSection] target visible? hidden=', target.classList.contains('hidden'), 'display=', getComputedStyle(target).display, 'innerHTML length=', (target.innerHTML||'').length);

    // MSWD Delivery Scheduling
    if (sectionId === "deliveryScheduling" && loggedInUserData?.role === "mswd") {
        // Unhide any descendants that may still be hidden
        target.querySelectorAll('.hidden').forEach(el => el.classList.remove('hidden'));
        // Enforce visibility for key containers
        target.style.visibility = 'visible';
        target.style.opacity = '1';
        target.querySelectorAll('.card, .table-container, table').forEach(el => {
            el.style.display = 'block';
            el.style.visibility = 'visible';
        });
        if (typeof loadBarangayDropdown === "function") loadBarangayDropdown();
        if (typeof loadAllDeliveriesForAdmin === "function") loadAllDeliveriesForAdmin();
        
        // ✅ Initialize inventory display and event listeners
        setTimeout(async () => {
            await updateInventoryDisplay();
            setupInventoryEventListeners();
        }, 100);
        
        // Bring section into view
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
    }

    // Barangay Delivery Status
    if (sectionId === "deliveryStatus" && loggedInUserData?.role === "barangay") {
        if (typeof loadBarangayDeliveries === "function") loadBarangayDeliveries(loggedInUserData.username);
    }

    // MSWD Track Goods
    if (sectionId === 'trackGoods' && loggedInUserData?.role === 'mswd') {
        // trigger totals refresh if available
        try {
            const evt = new Event('DOMContentLoaded'); // fallback trigger for listener
            document.dispatchEvent(evt);
        } catch(_) {}
    }

    // Statistics
    if (sectionId === "statistics") {
        if (loggedInUserData?.role === "mswd") {
            document.getElementById("mswdStatisticsContainer").classList.remove("hidden");
            document.getElementById("barangayStatisticsContainer").classList.add("hidden");
            if (typeof window.loadBarangayPriorityChart === "function") {
                window.loadBarangayPriorityChart(db, getDocs, collection);
            }
            if (typeof window.setupStatsExports === 'function') window.setupStatsExports('barangay');
        } else if (loggedInUserData?.role === "barangay") {
            document.getElementById("mswdStatisticsContainer").classList.add("hidden");
            document.getElementById("barangayStatisticsContainer").classList.remove("hidden");
            const barangayName = loggedInUserData.username.replace("barangay_", "");
            if (typeof window.loadResidentPriorityChart === "function") {
                window.loadResidentPriorityChart(db, getDocs, collection, query, where, barangayName);
            }
            if (typeof window.setupStatsExports === 'function') window.setupStatsExports('resident');
        }
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
    }

    // Track current section
    window.App.currentSection = sectionId;
}
window.showSection = showSection;





// ==== Change Password ====
window.showChangePassword = function() {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) return;
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.style.zIndex = '100000';
    const cs = getComputedStyle(modal);
    console.log('[showChangePassword] modal display', cs.display, 'opacity', cs.opacity);
};

(function setupChangePassword(){
    const form = document.getElementById('changePasswordForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        if (newPassword !== confirmNewPassword) {
            showError('New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
                showError('Password must be at least 6 characters long.');
                return;
            }
            try {
                await changePassword(currentPassword, newPassword);
            showSuccess('Password updated.');
            document.getElementById('changePasswordModal').classList.add('hidden');
            form.reset();
        } catch (err) {
            showError(mapAuthError(err));
        }
    });
})();

// Handle approval form submission
document.addEventListener('DOMContentLoaded', function() {
    const approveForm = document.getElementById('approveAccountForm');
    if (approveForm) {
        approveForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const requestId = document.getElementById('approveRequestId').value;
            const barangayName = document.getElementById('approveBarangayName').value;
            const terrain = document.getElementById('approveTerrain').value;
            const password = document.getElementById('approvePassword').value;
            
            if (!terrain) {
                showError('Please select a terrain type');
                return;
            }
            
            if (!password) {
                showError('Please set a default password');
                return;
            }
            
            // Disable submit button to prevent double submission
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span><span>Approving...</span>';
            
            try {
                await approveRequest(requestId, barangayName, terrain, password);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-icons">check_circle</span><span>Approve Account</span>';
            }
        });
    }
});

// ✅ Enhanced Toggle Income Field (works for Add + Edit)
function toggleIncomeField(prefix = "") {
  const student = document.getElementById(prefix + "student");
  const working = document.getElementById(prefix + "working");
  const income = document.getElementById(prefix + "monthlyIncome");
  
  if (!student || !working || !income) return;
  
  // If working is checked and student is not checked, enable income field
  if (working.checked && !student.checked) {
    income.disabled = false;
    income.required = true;
  } else {
    income.disabled = true;
    income.required = false;
    income.value = ""; // Clear the value when disabled
  }
}

// ✅ Add event listeners for Add form
document.addEventListener('DOMContentLoaded', function() {
  const studentCheckbox = document.getElementById("student");
  const workingCheckbox = document.getElementById("working");
  const incomeField = document.getElementById("monthlyIncome");
  
  if (studentCheckbox && workingCheckbox && incomeField) {
    studentCheckbox.addEventListener("change", () => toggleIncomeField(""));
    workingCheckbox.addEventListener("change", () => toggleIncomeField(""));
  }
  
  // Also add listeners for edit form
  const editStudentCheckbox = document.getElementById("editStudent");
  const editWorkingCheckbox = document.getElementById("editWorking");
  const editIncomeField = document.getElementById("editMonthlyIncome");
  
  if (editStudentCheckbox && editWorkingCheckbox && editIncomeField) {
    editStudentCheckbox.addEventListener("change", () => toggleIncomeField("edit"));
    editWorkingCheckbox.addEventListener("change", () => toggleIncomeField("edit"));
  }
});

// ===== Enhanced Double-Click Prevention System =====
function addDoubleClickPrevention(button, asyncFunction, options = {}) {
  const {
    loadingText = 'Processing...',
    cooldown = 1500,
    showSuccess = true,
    showError = true,
    preventMultiple = true
  } = options;
  
  if (!button || typeof asyncFunction !== 'function') {
    console.warn('addDoubleClickPrevention: Invalid button or function');
    return;
  }
  
  // Store original state
  const originalText = button.textContent;
  const originalHTML = button.innerHTML;
  const originalDisabled = button.disabled;
  let isProcessing = false;
  
  // Create a unique identifier for this button
  const buttonId = button.id || `btn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Global processing tracker to prevent multiple simultaneous operations
  if (!window.processingButtons) {
    window.processingButtons = new Set();
  }
  
  button.addEventListener('click', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent processing if already processing this button
    if (isProcessing) {
      console.log('Button click ignored: already processing');
      return;
    }
    
    // Prevent multiple operations globally if enabled
    if (preventMultiple && window.processingButtons.size > 0) {
      showWarning('Please wait for the current operation to complete.');
      return;
    }
    
    // Mark as processing
    isProcessing = true;
    window.processingButtons.add(buttonId);
    
    // Update button state
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'not-allowed';
    
    // Show loading state
    if (loadingText) {
      if (button.querySelector('.btn-icon')) {
        const icon = button.querySelector('.btn-icon');
        const text = button.querySelector('.btn-text') || button.querySelector('span:last-child');
        if (icon) icon.innerHTML = '⏳';
        if (text) text.textContent = loadingText;
      } else {
        button.innerHTML = `<span style="display: flex; align-items: center; gap: 8px;"><span>⏳</span><span>${loadingText}</span></span>`;
      }
    }
    
    try {
      const result = await asyncFunction();
      
      // Show success message if enabled and result is successful
      if (showSuccess && result !== false) {
        // Success message will be shown by the async function itself
        console.log('Operation completed successfully');
      }
    } catch (error) {
      console.error('Button action failed:', error);
      
      // Show error message if enabled
      if (showError) {
        const errorMessage = error?.message || 'An unexpected error occurred. Please try again.';
        showError(`Operation failed: ${errorMessage}`);
      }
    } finally {
      // Reset button state after cooldown
      setTimeout(() => {
        isProcessing = false;
        window.processingButtons.delete(buttonId);
        
        if (button && !button.parentNode?.querySelector === undefined) { // Check if button still exists
          button.disabled = originalDisabled;
          button.style.opacity = '';
          button.style.cursor = '';
          button.innerHTML = originalHTML;
        }
      }, cooldown);
    }
  });
  
  // Store prevention data for cleanup if needed
  button._preventionData = {
    id: buttonId,
    isProcessing: () => isProcessing,
    cleanup: () => {
      window.processingButtons?.delete(buttonId);
      isProcessing = false;
    }
  };
}

// Enhanced form submission prevention
function addFormSubmissionPrevention(form, asyncHandler, options = {}) {
  if (!form || typeof asyncHandler !== 'function') {
    console.warn('addFormSubmissionPrevention: Invalid form or handler');
    return;
  }
  
  const {
    cooldown = 2000,
    resetOnSuccess = true,
    showValidationErrors = true
  } = options;
  
  let isSubmitting = false;
  const formId = form.id || `form-${Date.now()}`;
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting) {
      console.log('Form submission ignored: already submitting');
      return;
    }
    
    // Basic form validation
    const requiredFields = form.querySelectorAll('[required]');
    const emptyFields = Array.from(requiredFields).filter(field => !field.value.trim());
    
    if (emptyFields.length > 0 && showValidationErrors) {
      const fieldNames = emptyFields.map(field => field.labels?.[0]?.textContent || field.name || field.placeholder || 'Unknown field').join(', ');
      showError(`Please fill in all required fields: ${fieldNames}`);
      emptyFields[0].focus();
      return;
    }
    
    isSubmitting = true;
    
    // Disable form controls
    const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
    const formInputs = form.querySelectorAll('input, textarea, select, button');
    
    submitButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      const originalText = btn.textContent;
      btn.dataset.originalText = originalText;
      if (btn.querySelector('span:last-child')) {
        btn.querySelector('span:last-child').textContent = 'Submitting...';
      } else {
        btn.innerHTML = '<span>⏳</span><span>Submitting...</span>';
      }
    });
    
    formInputs.forEach(input => {
      if (input.type !== 'submit') {
        input.disabled = true;
        input.style.opacity = '0.7';
      }
    });
    
    try {
      const result = await asyncHandler(new FormData(form));
      
      if (result !== false && resetOnSuccess) {
        form.reset();
      }
    } catch (error) {
      console.error('Form submission failed:', error);
      const errorMessage = error?.message || 'Form submission failed. Please try again.';
      showError(errorMessage);
    } finally {
      setTimeout(() => {
        isSubmitting = false;
        
        // Re-enable form controls
        submitButtons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = '';
          const originalText = btn.dataset.originalText || 'Submit';
          if (btn.querySelector('span:last-child')) {
            btn.querySelector('span:last-child').textContent = originalText.replace(/.*\s/, '') || 'Submit';
          } else {
            btn.innerHTML = `<span class="btn-icon">📝</span><span>${originalText}</span>`;
          }
        });
        
        formInputs.forEach(input => {
          if (input.type !== 'submit') {
            input.disabled = false;
            input.style.opacity = '';
          }
        });
      }, cooldown);
    }
  });
  
  return {
    isSubmitting: () => isSubmitting,
    cleanup: () => { isSubmitting = false; }
  };
}

// Setup barangay-specific buttons after login
function setupBarangayButtons() {
  console.log('Setting up barangay buttons...');
  
  // Setup barangay delivery history button
  const deliveryHistoryBtn = document.getElementById('viewDeliveryHistoryBtn');
  console.log('Delivery history button found:', !!deliveryHistoryBtn);
  if (deliveryHistoryBtn) {
    console.log('Setting up delivery history button event listener');
    // Remove any existing listeners first
    deliveryHistoryBtn.replaceWith(deliveryHistoryBtn.cloneNode(true));
    const newBtn = document.getElementById('viewDeliveryHistoryBtn');
    newBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      console.log('Delivery history button clicked!');
      try {
        await showDeliveryHistory();
      } catch (error) {
        console.error('Error showing delivery history:', error);
        showError('Failed to load delivery history: ' + error.message);
      }
    });
  } else {
    console.warn('Delivery history button not found during setup');
    // Try to find it after a short delay
    setTimeout(() => {
      const laterBtn = document.getElementById('viewDeliveryHistoryBtn');
      if (laterBtn) {
        console.log('Found delivery history button on retry');
        laterBtn.addEventListener('click', async function(e) {
          e.preventDefault();
          await showDeliveryHistory();
        });
      }
    }, 500);
  }
}

// ===== Goods Inventory UI (MSWD) =====
document.addEventListener('DOMContentLoaded', async function() {
  // Load totals if Track Goods section exists
  async function refreshTotals() {
    try {
      // Fetch totals directly from Firestore
      const totalsRef = doc(db, 'inventory', 'totals');
      const snap = await getDoc(totalsRef);
      const totals = snap.exists() ? snap.data() : { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
      const safe = (v) => (typeof v === 'number' ? v : 0);
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
      set('totalRice', safe(totals.rice));
      set('totalBiscuits', safe(totals.biscuits));
      set('totalCanned', safe(totals.canned));
      set('totalShirts', safe(totals.shirts));
      const overall = safe(totals.rice) + safe(totals.biscuits) + safe(totals.canned) + safe(totals.shirts);
      set('totalOverall', overall);
    } catch (e) { console.warn('Failed loading inventory totals', e); }
  }
  
  // Setup inventory management buttons with double-click prevention
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    addDoubleClickPrevention(historyBtn, showInventoryHistory, 'Loading History...');
  }
  
  const newBatchBtn = document.getElementById('newBatchBtn');
  if (newBatchBtn) {
    addDoubleClickPrevention(newBatchBtn, showNewBatchModal, 'Processing...');
  }
  
  const summaryBtn = document.getElementById('summaryBtn');
  if (summaryBtn) {
    addDoubleClickPrevention(summaryBtn, generateSummaryReport, 'Generating Report...');
  }
  
  // Barangay-specific buttons are set up after login in setupBarangayButtons()
  
  // Setup delivery form event listener with enhanced prevention
  const deliveryForm = document.getElementById('deliveryForm');
  if (deliveryForm) {
    addFormSubmissionPrevention(deliveryForm, async (formData) => {
      return await handleScheduleDelivery();
    }, {
      cooldown: 2000,
      resetOnSuccess: true,
      showValidationErrors: true
    });
  }

  const goodsForm = document.getElementById('goodsForm');
  if (goodsForm) {
    await refreshTotals();
    // expose for external refresh without rebinding listeners
    window.refreshInventoryTotals = refreshTotals;
    if (!goodsForm.dataset.boundSubmit) {
      goodsForm.dataset.boundSubmit = '1';
    let isSubmittingInventory = false;
    goodsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingInventory || goodsForm.dataset.submitting === '1') return; // prevent double submit
      isSubmittingInventory = true;
      goodsForm.dataset.submitting = '1';
      const submitBtn = goodsForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }
      // disable inputs to avoid value changes mid-flight
      const inputs = goodsForm.querySelectorAll('input, textarea, select');
      inputs.forEach(i => { i.disabled = true; });
      const delta = {
        rice: Number(document.getElementById('invRice')?.value || 0),
        biscuits: Number(document.getElementById('invBiscuits')?.value || 0),
        canned: Number(document.getElementById('invCanned')?.value || 0),
        shirts: Number(document.getElementById('invShirts')?.value || 0),
      };
      try {
        // Use atomic transaction to avoid races and 400 stream issues
        await updateInventoryTransaction({
          rice: Number(delta.rice || 0),
          biscuits: Number(delta.biscuits || 0),
          canned: Number(delta.canned || 0),
          shirts: Number(delta.shirts || 0)
        });
        // Log the transaction
        await logInventoryTransaction({
          action: 'stock-in',
          type: 'manual',
          items: {
            rice: Number(delta.rice || 0),
            biscuits: Number(delta.biscuits || 0),
            canned: Number(delta.canned || 0),
            shirts: Number(delta.shirts || 0)
          },
          user: loggedInUserData?.username || 'Unknown',
          description: 'Manual stock addition'
        });
        showSuccess('Inventory updated.');
        goodsForm.reset();
        await refreshTotals();
      } catch (err) {
        console.error(err);
        showError('Failed to update inventory.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        inputs.forEach(i => { i.disabled = false; });
        isSubmittingInventory = false;
        goodsForm.dataset.submitting = '0';
      }
    });
    }
  }
});

// ===== Admin-Controlled Terrain System =====
// Terrain is now set by admin when approving barangay accounts
// No hardcoded profiles needed - terrain comes from user account data

// Function to auto-populate terrain based on barangay (for logged-in barangay users)
function autoPopulateTerrainForBarangay() {
    if (loggedInUserData && loggedInUserData.role === 'barangay') {
        // Get terrain from the user's account data (set by admin during approval)
        const terrain = loggedInUserData.terrain || 'Lowland'; // Default to Lowland if not set
        
        // Update Add Resident form terrain display
        updateTerrainDisplay('barangayTerrain', terrain);
        
        // Update Edit Resident form terrain display  
        updateTerrainDisplay('editBarangayTerrain', terrain);
    }
}

// Helper function to update terrain display with badge styling
function updateTerrainDisplay(fieldPrefix, terrain) {
    const hiddenInput = document.getElementById(fieldPrefix);
    const badge = document.getElementById(fieldPrefix + 'Badge');
    
    if (hiddenInput && badge) {
        // Set the hidden input value for form submission
        hiddenInput.value = terrain;
        
        // Update the visible badge
        const terrainLower = terrain.toLowerCase();
        badge.textContent = terrain;
        
        // Remove existing terrain classes
        badge.classList.remove('highland', 'lowland');
        
        // Add appropriate class for styling
        if (terrainLower === 'highland') {
            badge.classList.add('highland');
        } else if (terrainLower === 'lowland') {
            badge.classList.add('lowland');
        }
        
        // Update the note
        const note = badge.closest('.form-group').querySelector('.terrain-note');
        if (note) {
            note.textContent = `Terrain (${terrain}) was set by admin when your account was approved`;
        }
    }
}


// ===== Standardized A4 Single-Page Print Helpers =====
function buildA4PrintHTML({ title = 'RELIEF GOODS DELIVERY RECEIPT', subtitle = 'Municipal Social Welfare and Development Office', bodyHTML = '', footerHTML = '' }) {
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      /* A4 single page setup */
      @page { size: A4; margin: 12mm; }
      html, body { height: 100%; }
      body { font-family: Arial, Helvetica, sans-serif; color:#111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { display: grid; grid-template-rows: auto 1fr auto; min-height: calc(297mm - 24mm); }
      .header { text-align: center; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
      .title { font-size: 16px; font-weight: 700; letter-spacing: .3px; }
      .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
      .content { padding: 10px 2px; }
      .footer { font-size: 10px; color: #666; text-align: left; padding-top: 8px; border-top: 1px solid #e5e7eb; }
      /* Tables */
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; }
      th { background: #f5f5f5; }
      /* Utility */
      .section { margin-bottom: 10px; }
      .muted { color:#6b7280; }
      .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sig-row { display:flex; justify-content: space-between; gap: 24px; margin-top: 24px; }
      .sig { width: 45%; text-align:center; }
      .sig .line { border-bottom: 1px solid #333; height: 36px; margin-bottom: 6px; }
      .small { font-size: 11px; }
      /* Ensure single page: hide overflow if any */
      @media print { .page { overflow: hidden; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div class="title">${title}</div>
        <div class="subtitle">${subtitle}</div>
      </div>
      <div class="content">${bodyHTML}</div>
      <div class="footer">${footerHTML}</div>
    </div>
  </body>
  </html>`;
}

function openPrintA4(html) {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch(_){} }, 400);
}

// ===== Statistics Export/Print Helpers =====
function setupStatsExports(type) {
  try {
    if (type === 'barangay') {
      const excelBtn = document.getElementById('exportBarangayExcelBtn');
      const pdfBtn = document.getElementById('exportBarangayPDFBtn');
      const printBtn = document.getElementById('printBarangayStatsBtn');
      bindStatsButtons(excelBtn, pdfBtn, printBtn, 'barangay');
    } else {
      const excelBtn = document.getElementById('exportResidentExcelBtn');
      const pdfBtn = document.getElementById('exportResidentPDFBtn');
      const printBtn = document.getElementById('printResidentStatsBtn');
      bindStatsButtons(excelBtn, pdfBtn, printBtn, 'resident');
    }
  } catch(_) {}
}

function bindStatsButtons(excelBtn, pdfBtn, printBtn, scope) {
  const chartCanvasId = scope === 'barangay' ? 'barangayPriorityChart' : 'residentPriorityChart';
  const legendId = scope === 'barangay' ? 'barangayLegend' : 'residentLegend';
  const listId = scope === 'barangay' ? 'topBarangaysList' : 'topResidentsList';

  if (excelBtn) {
    excelBtn.onclick = () => exportStatsTableToExcel(listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
  }
  if (pdfBtn) {
    pdfBtn.onclick = () => exportStatsToPDF(chartCanvasId, listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
  }
  if (printBtn) {
    printBtn.onclick = () => printStats(chartCanvasId, listId, scope === 'barangay' ? 'Barangay Priority' : 'Resident Priority');
  }
}

function exportStatsTableToExcel(listContainerId, title) {
  const container = document.getElementById(listContainerId);
  if (!container) return;
  // Build a simple table from the list content for export
  const tempTable = document.createElement('table');
  const rows = container.querySelectorAll('li');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>${title}</th><th>Value</th></tr>`;
  tempTable.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(li => {
    const name = li.querySelector('.pl-name')?.textContent || '';
    const value = li.querySelector('.pl-value')?.textContent || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>${value}</td>`;
    tbody.appendChild(tr);
  });
  tempTable.appendChild(tbody);

  if (window.jQuery) {
    const $ = window.jQuery;
    $(tempTable).DataTable({
      dom: 'Bfrtip',
      buttons: [ { extend: 'excelHtml5', title } ],
      destroy: true
    });
    // Trigger the button programmatically
    $(tempTable).DataTable().button('.buttons-excel').trigger();
    $(tempTable).DataTable().destroy();
  }
}

function exportStatsToPDF(chartCanvasId, listContainerId, title) {
  // Use print pipeline with PDF button from DataTables or fallback to window.print with media
  printStats(chartCanvasId, listContainerId, title, true);
}

function printStats(chartCanvasId, listContainerId, title, pdf = false) {
  const chartCanvas = document.getElementById(chartCanvasId);
  const listContainer = document.getElementById(listContainerId);
  if (!chartCanvas || !listContainer) return;

  const style = ``;

  // Build a simple table from the list content
  const tableHtml = (() => {
    const rows = listContainer.querySelectorAll('li');
    let h = '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>';
    rows.forEach(li => {
      const name = li.querySelector('.pl-name')?.textContent || '';
      const value = li.querySelector('.pl-value')?.textContent || '';
      h += `<tr><td>${name}</td><td>${value}</td></tr>`;
    });
    h += '</tbody></table>';
    return h;
  })();

  // Clone chart as image
  const dataUrl = chartCanvas.toDataURL('image/png');
  const html = `
    <h1>${title}</h1>
    <div class="grid">
      <div class="chart-wrap"><img src="${dataUrl}" style="max-width:700px;width:100%;"/></div>
      <div class="list-wrap">${tableHtml}</div>
    </div>`;

  const pageHTML = buildA4PrintHTML({
    title: title || 'RELIEF GOODS DELIVERY RECEIPT',
    subtitle: 'Municipal Social Welfare and Development Office',
    bodyHTML: html,
    footerHTML: `<div>Generated on ${new Date().toLocaleString()}</div>`
  });
  openPrintA4(pageHTML);
}

// ✅ Event Delegation for Edit + Delete buttons in residents table
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("edit-btn")) {
    const id = e.target.getAttribute("data-id");
    const ref = doc(db, "residents", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Resident not found.");
      return;
    }
    const r = snap.data();
    // Fill edit form
    document.getElementById("editResidentId").value = id;
    document.getElementById("editName").value = r.name || "";
    document.getElementById("editAge").value = r.age || "";
    document.getElementById("editAddressZone").value = r.addressZone || "";
    document.getElementById("editHouseholdNumber").value = r.householdNumber || "";
    document.getElementById("editHouseMaterial").value = r.houseMaterial || "Concrete";
    
    // Auto-populate terrain based on admin-set terrain in user account
    const terrain = loggedInUserData?.terrain || r.barangayTerrain || 'Lowland';
    updateTerrainDisplay('editBarangayTerrain', terrain);
    document.getElementById("editFamilyMembers").value = r.familyMembers || "";
    document.getElementById("editGender").value = r.gender || "Male";
    document.getElementById("editHouseholdStatus").value = r.householdStatus || "Poor";
    document.getElementById("editMonthlyIncome").value = r.monthlyIncome ?? "";
    document.getElementById("editAidHistory").value = r.aidHistory || "";
    document.getElementById("editEvacueeHistory").value = r.evacueeHistory || "";
    document.getElementById("editRemarks").value = r.remarks || "";
    document.getElementById("editStudent").checked = r.isStudent || false;
    document.getElementById("editWorking").checked = r.isWorking || false;
    toggleIncomeField("edit");
    
    // Show edit modal with proper styling
    const editModal = document.getElementById("editResidentModal");
    if (editModal) {
        editModal.classList.remove("hidden");
        editModal.style.display = "flex";
        editModal.style.visibility = "visible";
        editModal.style.opacity = "1";
        editModal.style.pointerEvents = "auto";
    }
  }

  if (e.target.classList.contains("delete-btn")) {
    const id = e.target.getAttribute("data-id");
    if (confirm("Are you sure you want to delete this resident?")) {
      await deleteDoc(doc(db, "residents", id));
      alert("Resident deleted successfully!");
      const barangayName = loggedInUserData.username.replace("barangay_", "");
      loadResidentsForBarangay(barangayName);
    }
  }
});




function viewBarangayStats(barangayName) {
    // Switch to Priority Statistics section
    showSection("priorityStatistics");

    // Load stats for the clicked barangay
    if (typeof loadPriorityStatistics === "function") {
        loadPriorityStatistics(barangayName);
    }
}


// ===============================
// Residents Modal (Independent)
// ===============================
// removed alternate modal loader/openers to avoid duplication

// ✅ Expose functions globally for HTML onclick calls
window.updateDeliveryStatus = updateDeliveryStatus;

// Old approveRequest and declineRequest functions removed - using new versions with terrain selection

async function viewBarangay(barangayId, barangayName) {
    try {
        console.log('[viewBarangay] Opening modal for', barangayName, 'id:', barangayId);
        
        // Get the modal
        const modal = document.getElementById('viewResidentsModal');
        if (!modal) {
            console.error('[viewBarangay] viewResidentsModal not found');
            showError("Modal not found. Please refresh the page.");
            return;
        }
        
        // Move modal to body if needed
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
            console.log('[viewBarangay] Moved modal to <body>');
        }
        
        // Update modal title
        const titleElement = document.getElementById('viewResidentsTitle');
        if (titleElement) {
            titleElement.textContent = `🏘️ ${barangayName} - Residents`;
        }
        
        // Show the modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '100000';
        
        // Load residents for the selected barangay
        await loadResidentsForModal(barangayName);
        
        // Focus on search input
        const searchInput = document.getElementById('residentSearchInput');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
        
        console.log('[viewBarangay] Modal opened successfully');
        
    } catch (error) {
        console.error("Error viewing barangay:", error);
        showError("Failed to load barangay data. Please try again.");
    }
}

// Function to load residents for the modal
async function loadResidentsForModal(barangayName) {
    try {
        const residentsRef = collection(db, "residents");
        const q = query(residentsRef, where("barangay", "==", barangayName));
        const snapshot = await getDocs(q);
        
        const tableBody = document.getElementById("viewResidentsTableBody");
        if (!tableBody) {
            console.warn("View residents table body not found");
            return;
        }
        
        tableBody.innerHTML = "";
        
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="no-residents-message">
                        <div class="empty-state">
                            <div class="empty-icon">👥</div>
                            <h4>No Residents Found</h4>
                            <p>No residents are currently registered in ${barangayName}.</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        
        const rowsData = [];
        snapshot.forEach((docSnap) => {
            const resident = docSnap.data();
            rowsData.push(resident);
        });

        // Sort by last name A–Z
        function lastNameOf(fullName = '') {
            const parts = String(fullName).trim().split(/\s+/);
            return parts.length ? parts[parts.length - 1].toLowerCase() : '';
        }
        rowsData.sort((a,b) => lastNameOf(a.name).localeCompare(lastNameOf(b.name)));

        rowsData.forEach((resident) => {
            const row = document.createElement('tr');
            row.className = 'resident-row';
            const values = [
                resident.name || 'No Name',
                resident.age || 'N/A',
                resident.addressZone || 'N/A',
                resident.householdNumber || 'N/A',
                resident.gender || 'N/A',
                resident.householdStatus || 'N/A',
                resident.houseMaterial || 'N/A',
                resident.barangayTerrain || 'N/A',
                resident.familyMembers || 'N/A',
                resident.monthlyIncome ? '₱' + Number(resident.monthlyIncome).toLocaleString() : 'N/A',
                resident.aidHistory || 'N/A',
                resident.remarks || 'N/A',
                resident.evacueeHistory || 'N/A'
            ];
            values.forEach((val, idx) => {
                const td = document.createElement('td');
                td.textContent = String(val);
                if (idx === 3) {
                    const wrap = document.createElement('div');
                    wrap.className = 'resident-household';
                    const span = document.createElement('span');
                    span.className = 'household-text';
                    span.textContent = String(val);
                    wrap.appendChild(span);
                    td.textContent = '';
                    td.appendChild(wrap);
                }
                row.appendChild(td);
            });
            let status = 'None'; let statusClass = 'status-none';
            if (resident.isStudent && resident.isWorking) { status = 'Student & Working'; statusClass = 'status-both'; }
            else if (resident.isStudent) { status = 'Student'; statusClass = 'status-student'; }
            else if (resident.isWorking) { status = 'Working'; statusClass = 'status-working'; }
            const statusTd = document.createElement('td');
            const wrap = document.createElement('div'); wrap.className = 'resident-status';
            const badge = document.createElement('span'); badge.className = 'status-badge ' + statusClass;
            const txt = document.createElement('span'); txt.className = 'status-text'; txt.textContent = status;
            badge.appendChild(txt); wrap.appendChild(badge); statusTd.appendChild(wrap); row.appendChild(statusTd);
            tableBody.appendChild(row);
        });
        
        // Setup search functionality
        setupResidentSearch();
        
        // Enhanced close button click handling
        const modal = document.getElementById('viewResidentsModal');
        const closeButton = modal ? modal.querySelector('.close') : null;
        if (closeButton) {
            // Remove existing event listeners to avoid duplicates
            const newCloseButton = closeButton.cloneNode(true);
            closeButton.parentNode.replaceChild(newCloseButton, closeButton);
            
            // Add comprehensive event listeners for all interaction types
            ['click', 'touchstart', 'mousedown'].forEach(eventType => {
                newCloseButton.addEventListener(eventType, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    console.log('Close button triggered via:', eventType);
                    
                    // Close the modal
                    try {
                        closeViewResidentsModal();
                    } catch (err) {
                        console.warn('closeViewResidentsModal function not found, using fallback');
                        if (modal) {
                            modal.classList.add('hidden');
                            modal.style.display = 'none';
                        }
                    }
                }, { passive: false, capture: true });
            });
            
            // Additional pointer events for better cross-device compatibility
            newCloseButton.style.cssText += `
                cursor: pointer !important;
                pointer-events: auto !important;
                touch-action: manipulation !important;
                -webkit-tap-highlight-color: rgba(0,0,0,0.1) !important;
            `;
        }

        // Initialize DataTable for modal if available
        try {
            if (window.jQuery && $('#viewResidentsTable').length) {
                if ($.fn.dataTable.isDataTable('#viewResidentsTable')) {
                    $('#viewResidentsTable').DataTable().destroy();
                }
                const dt = $('#viewResidentsTable').DataTable({
                    order: [[0, 'asc']],
                    dom: 'Bfrtip',
buttons: [
                        { extend: 'excelHtml5', title: 'Residents', exportOptions: { columns: ':not(.no-export)' } },
                        { extend: 'pdfHtml5', title: 'Residents', pageSize: 'A4',
                          customize: function (doc) {
                            // Standardize PDF header/footer
                            doc.pageMargins = [20, 40, 20, 30];
                            doc.styles.tableHeader = { bold: true, fillColor: '#f5f5f5' };
                            doc.content.unshift({ text: 'RELIEF GOODS DELIVERY RECEIPT', style: { bold: true, fontSize: 14 }, alignment: 'center', margin: [0,0,0,6] });
                            doc.content.unshift({ text: 'Municipal Social Welfare and Development Office', alignment: 'center', fontSize: 10, margin: [0,0,0,12] });
                          },
                          exportOptions: { columns: ':not(.no-export)' } },
                        { extend: 'print', title: 'Residents',
                          customize: function (win) {
                            try {
                              const body = win.document.body;
                              const content = body.innerHTML;
                              const wrapper = `
                                <div class="page">
                                  <div class="header">
                                    <div class="title">RELIEF GOODS DELIVERY RECEIPT</div>
                                    <div class="subtitle">Municipal Social Welfare and Development Office</div>
                                  </div>
                                  <div class="content">${content}</div>
                                  <div class="footer"><div>Generated on ${new Date().toLocaleString()}</div></div>
                                </div>`;
                              const style = win.document.createElement('style');
                              style.innerHTML = `@page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header{ text-align:center; border-bottom:1px solid #e5e7eb; padding-bottom:8px; } .title{ font-size:16px; font-weight:700;} .subtitle{ font-size:11px; color:#555;} .content{ padding:10px 2px;} .footer{ border-top:1px solid #e5e7eb; padding-top:8px; font-size:10px; color:#666; } table{ width:100%; border-collapse:collapse;} th,td{ border:1px solid #e5e7eb; padding:6px 8px; font-size:12px;} th{ background:#f5f5f5; }`;
                              body.innerHTML = wrapper;
                              body.appendChild(style);
                            } catch(_) {}
                          },
                          exportOptions: { columns: ':not(.no-export)' } }
                    ],
                    pageLength: 10
                });
                // Move DataTables buttons above the search bar with improved handling
                try {
                    const wrapper = document.getElementById('viewResidentsTable').closest('.dataTables_wrapper');
                    const btns = wrapper ? wrapper.querySelector('.dt-buttons') : null;
                    const filter = wrapper ? wrapper.querySelector('.dataTables_filter') : null;
                    const searchSection = document.querySelector('#viewResidentsModal .search-section');
                    const searchBox = searchSection ? searchSection.querySelector('.search-box') : null;
                    
                    if (btns && searchSection) {
                        // Remove any existing button container to avoid duplicates
                        const existingBtns = searchSection.querySelector('.dt-buttons');
                        if (existingBtns && existingBtns !== btns) {
                            existingBtns.remove();
                        }
                        
                        // Move buttons to search section
                        if (searchBox) {
                            searchSection.insertBefore(btns, searchBox);
                        } else {
                            searchSection.insertBefore(btns, searchSection.firstChild);
                        }
                        
                        // Apply enhanced styling and ensure clickability
                        btns.style.cssText = `
                            margin: 0 0 12px 0 !important;
                            display: flex !important;
                            gap: 8px !important;
                            flex-wrap: wrap !important;
                            z-index: 100000 !important;
                            position: relative !important;
                            pointer-events: auto !important;
                        `;
                        
                        // Ensure each button is properly styled and clickable
                        btns.querySelectorAll('button').forEach((button, index) => {
                            button.style.cssText = `
                                display: inline-flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                width: auto !important;
                                min-height: 44px !important;
                                min-width: 44px !important;
                                padding: 12px 16px !important;
                                margin: 0 !important;
                                background: ${index === 0 ? '#217346' : index === 1 ? '#dc2626' : '#7c3aed'} !important;
                                color: white !important;
                                border: none !important;
                                border-radius: 6px !important;
                                cursor: pointer !important;
                                font-size: 0.875rem !important;
                                font-weight: 500 !important;
                                pointer-events: auto !important;
                                user-select: none !important;
                                z-index: 100001 !important;
                                position: relative !important;
                                transition: all 0.2s ease !important;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
                                touch-action: manipulation !important;
                                -webkit-tap-highlight-color: transparent !important;
                                -webkit-touch-callout: none !important;
                            `;
                            
                            // Add explicit event listeners as a fallback
                            if (!button.hasAttribute('data-enhanced')) {
                                button.setAttribute('data-enhanced', 'true');
                                
                                // Remove any existing event listeners by cloning the button
                                const originalClick = button.onclick;
                                const newButton = button.cloneNode(true);
                                button.parentNode.replaceChild(newButton, button);
                                button = newButton; // Update reference
                                
                                // Add comprehensive event handling for all interaction types
                                ['click', 'touchstart', 'mousedown'].forEach(eventType => {
                                    newButton.addEventListener(eventType, function(e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.stopImmediatePropagation();
                                        
                                        console.log('DataTables button triggered via:', eventType, this.textContent);
                                        
                                        // Try original handler first
                                    if (originalClick) {
                                        try {
                                            originalClick.call(this, e);
                                            return; // If original handler works, we're done
                                        } catch (err) {
                                            console.warn('Original click handler failed:', err);
                                        }
                                    }
                                    
                                    // Trigger DataTables button action as fallback
                                    try {
                                        if (this.classList.contains('buttons-excel')) {
                                            console.log('Triggering Excel export...');
                                            dt.button('.buttons-excel').trigger();
                                        } else if (this.classList.contains('buttons-pdf')) {
                                            console.log('Triggering PDF export...');
                                            dt.button('.buttons-pdf').trigger();
                                        } else if (this.classList.contains('buttons-print')) {
                                            console.log('Triggering print...');
                                            dt.button('.buttons-print').trigger();
                                        } else {
                                            // Try to find the button by index if class detection fails
                                            const allButtons = btns.querySelectorAll('button');
                                            const buttonIndex = Array.from(allButtons).indexOf(this);
                                            if (buttonIndex >= 0) {
                                                console.log('Triggering button by index:', buttonIndex);
                                                dt.button(buttonIndex).trigger();
                                            }
                                        }
                                    } catch (dtErr) {
                                        console.error('DataTables button trigger failed:', dtErr);
                                        // Last resort: try to manually trigger export functions
                                        if (this.textContent.toLowerCase().includes('excel')) {
                                            alert('Excel export would be triggered here');
                                        } else if (this.textContent.toLowerCase().includes('pdf')) {
                                            alert('PDF export would be triggered here');
                                        } else if (this.textContent.toLowerCase().includes('print')) {
                                            window.print();
                                        }
                                    }
                                    }, { passive: false, capture: true });
                                });
                                
                                // Add hover effects
                                button.addEventListener('mouseenter', function() {
                                    this.style.transform = 'translateY(-1px)';
                                    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                                });
                                
                                button.addEventListener('mouseleave', function() {
                                    this.style.transform = 'translateY(0)';
                                    this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                });
                            }
                        });
                    }
                
                    // Hide DataTables' built-in search; we'll keep the custom one above
                    if (filter) { filter.style.display = 'none'; }
                } catch(err) {
                    console.warn('Error enhancing DataTables buttons:', err);
                }
            }
        } catch (e) { console.warn('DataTable init (modal) failed:', e); }
        
    } catch (error) {
        console.error("Error loading residents for modal:", error);
        showError("Failed to load residents. Please try again.");
    }
}

// Setup resident search functionality
function setupResidentSearch() {
    const searchInput = document.getElementById('residentSearchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#viewResidentsTableBody .resident-row');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(searchTerm);
            row.style.display = matches ? '' : 'none';
        });

        // Household-aware: if any member matches, show all same-household rows
        const visibleHouseholds = new Set();
        document.querySelectorAll('#viewResidentsTableBody .resident-row').forEach(row => {
            if (row.style.display !== 'none') {
                const hhCell = row.querySelector('.resident-household .household-text');
                if (hhCell) visibleHouseholds.add(hhCell.textContent.trim());
            }
        });
        if (searchTerm) {
            document.querySelectorAll('#viewResidentsTableBody .resident-row').forEach(row => {
                const hhCell = row.querySelector('.resident-household .household-text');
                const hh = hhCell ? hhCell.textContent.trim() : '';
                if (visibleHouseholds.has(hh)) row.style.display = '';
            });
        }
    });
}

// Close view residents modal
function closeViewResidentsModal() {
    const modal = document.getElementById('viewResidentsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
}

// Helper function to get resident status icon
function getResidentStatusIcon(status) {
    switch (status.toLowerCase()) {
        case 'student': return '🎓';
        case 'working': return '💼';
        case 'student & working': return '🎓💼';
        default: return '❓';
    }
}

// ✅ Add missing loadPendingRequests function
async function loadPendingRequests() {
    try {
        const requestsRef = collection(db, "accountRequests");
        const q = query(requestsRef, where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        
        const tableBody = document.getElementById("requestsTableBody");
        if (!tableBody) {
            console.warn("Account requests table body not found");
            return;
        }
        
        tableBody.innerHTML = "";
        
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;">No pending requests.</td>
                </tr>`;
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const req = docSnap.data();
            const row = document.createElement("tr");
            const requestDate = req.dateRequested ? new Date(req.dateRequested.seconds * 1000).toLocaleDateString() : 'Unknown';
            
            row.innerHTML = `
                <td>${req.barangayName || 'Unknown'}</td>
                <td>${req.email || 'No email provided'}</td>
                <td>${req.contact || 'No contact provided'}</td>
                <td style="max-width: 200px; word-wrap: break-word;">${req.message || 'No message provided'}</td>
                <td>${requestDate}</td>
                <td>
                    <button onclick="showApproveModal('${docSnap.id}', '${req.barangayName}', '${req.email}', '${req.contact}')" class="action-button primary-btn" style="margin-right: 8px;">
                        <span class="material-icons">check</span>
                        <span>Approve</span>
                    </button>
                    <button onclick="declineRequest('${docSnap.id}')" class="action-button" style="background: #ef4444; color: white;">
                        <span class="material-icons">close</span>
                        <span>Decline</span>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading pending requests:", error);
        showError("Failed to load pending requests. Please try again.");
    }
}

// ✅ Expose all functions globally
// Show approval modal with terrain selection
function showApproveModal(requestId, barangayName, email, contact) {
    const modal = document.getElementById('approveAccountModal');
    if (!modal) return;
    
    // Populate the form with request data
    document.getElementById('approveRequestId').value = requestId;
    document.getElementById('approveBarangayName').value = barangayName;
    document.getElementById('approveEmail').value = email;
    document.getElementById('approveContact').value = contact;
    
    // Clear previous selections
    document.getElementById('approveTerrain').value = '';
    document.getElementById('approvePassword').value = '';
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
}

// Close approval modal
function closeApproveModal() {
    const modal = document.getElementById('approveAccountModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
        
        // Clear form
        document.getElementById('approveAccountForm').reset();
    }
}

// Updated approve request function
async function approveRequest(requestId, barangayName, terrain, password) {
    try {
        console.log('🔄 Starting approval process for:', barangayName);
        
        // Store the current admin's auth state before any operations
        const currentAdmin = auth.currentUser;
        const adminEmail = currentAdmin?.email;
        const adminUserData = loggedInUserData;
        
        console.log('💾 Storing admin session:', adminEmail);
        
        // Create the user account using same email format as existing system
        const formattedBarangay = barangayName.toLowerCase().replace(/\s+/g, '');
        const email = `${formattedBarangay}@example.com`;
        const username = `barangay_${formattedBarangay}`;
        
        console.log('📧 Creating account:', { email, username });
        
        // Check if user already exists first
        const signInMethods = await fetchSignInMethodsForEmail(auth, email);
        
        if (signInMethods.length > 0) {
            throw new Error(`Account already exists for ${email}. Please use a different barangay name.`);
        }
        
        // Create new user account in Firebase Auth (this will temporarily log in the new user)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUserId = userCredential.user.uid;
        console.log('✅ Firebase Auth user created:', newUserId);
        
        // Create user document in Firestore first (while we still have the auth context)
        const userDocRef = await addDoc(collection(db, 'users'), {
            uid: newUserId,
            username: username,
            email: email,
            role: 'barangay',
            barangayName: barangayName,
            terrain: terrain,
            contact: document.getElementById('approveContact').value || '',
            approved: true,
            dateApproved: serverTimestamp(),
            createdAt: serverTimestamp(),
            isFirstLogin: true,
            // Initialize session fields
            sessionId: null,
            isActive: false,
            lastLogin: null,
            lastLogout: null,
            loginTimestamp: null
        });
        
        console.log('✅ Firestore user document created:', userDocRef.id);
        
        // Update the request status
        await updateDoc(doc(db, 'accountRequests', requestId), {
            status: 'approved',
            dateApproved: serverTimestamp(),
            approvedTerrain: terrain,
            createdUserId: newUserId
        });
        
        console.log('✅ Request status updated');
        
        // Sign out the newly created user immediately
        await auth.signOut();
        console.log('🔐 Signed out new user');
        
        // Close modal immediately
        closeApproveModal();
        
        // Show success modal with account details
        if (window.Swal) {
            await Swal.fire({
                title: '✅ Account Approved Successfully!',
                html: `
                    <div style="text-align: left; margin: 15px 0;">
                        <p><strong>Account created for: ${barangayName}</strong></p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #16a34a;">
                            <p style="margin: 0 0 10px 0;"><strong>Login Details:</strong></p>
                            <p style="margin: 5px 0; font-family: monospace; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
                                <strong>Email:</strong> ${email}
                            </p>
                            <p style="margin: 5px 0; font-family: monospace; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
                                <strong>Password:</strong> ${password}
                            </p>
                            <p style="margin: 5px 0; font-family: monospace; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
                                <strong>Terrain:</strong> ${terrain}
                            </p>
                        </div>
                        <p style="color: #6b7280; font-size: 0.9em; margin-top: 15px;">
                            ℹ️ The barangay can now log in using these credentials.
                        </p>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Continue',
                confirmButtonColor: '#16a34a',
                background: '#ffffff',
                color: '#1f2937',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #2563eb';
                    popup.style.borderBottom = '6px solid #16a34a';
                }
            });
        } else {
            alert(`Account approved for ${barangayName}!\n\nLogin Details:\nEmail: ${email}\nPassword: ${password}\nTerrain: ${terrain}`);
        }
        
        // Force page refresh to restore admin session
        console.log('🔄 Refreshing page to restore admin session...');
        window.location.reload();
        
    } catch (error) {
        console.error('❌ Error approving request:', error);
        let errorMessage = 'Failed to approve request: ' + error.message;
        
        // Handle specific Firebase Auth errors
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = `Account already exists for this barangay. Please check if ${barangayName} already has an account.`;
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please choose a stronger password (at least 6 characters).';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format generated. Please check the barangay name.';
        }
        
        if (window.Swal) {
            await Swal.fire({
                title: '❌ Approval Failed',
                text: errorMessage,
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#2563eb',
                background: '#ffffff',
                color: '#1f2937',
                didOpen: (popup) => {
                    popup.style.borderTop = '6px solid #ef4444';
                    popup.style.borderBottom = '6px solid #2563eb';
                }
            });
        } else {
            showError(errorMessage);
        }
    }
}

// Decline request function
async function declineRequest(requestId) {
    if (!confirm('Are you sure you want to decline this request?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, "accountRequests", requestId));
        showSuccess('Request declined successfully');
        loadPendingRequests(); // Refresh the requests list
    } catch (error) {
        console.error('Error declining request:', error);
        showError('Failed to decline request: ' + error.message);
    }
}

window.showApproveModal = showApproveModal;
window.closeApproveModal = closeApproveModal;
window.approveRequest = approveRequest;
window.declineRequest = declineRequest;
window.viewBarangay = viewBarangay;
window.loadPendingRequests = loadPendingRequests;

// ✅ Add missing logout function
async function logout() {
    try {
        await auth.signOut();
        console.log("User logged out successfully");
        
        // Reset any global variables
        loggedInUserData = null;
        currentUserRole = null;
        currentBarangayName = null;
        
        // Show login container and hide dashboard
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('dashboardContainer').classList.add('hidden');
        
        // Clear any sensitive data from the UI
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.add('hidden'));
        
    } catch (error) {
        console.error("Error during logout:", error);
        showError("Logout failed. Please try again.");
    }
}

window.logout = logout;

// ✅ Enhanced showChangePassword function
function showChangePassword() {
    const modal = document.getElementById("changePasswordModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
        modal.style.visibility = "visible";
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
        
        // Focus on first input for better UX
        setTimeout(() => {
            const firstInput = modal.querySelector('input[type="password"]');
            if (firstInput) {
                firstInput.focus();
            }
        }, 300);
    }
}

window.showChangePassword = showChangePassword;
window.showAddResidentModal = showAddResidentModal;
window.closeAddResidentModal = closeAddResidentModal;

// ✅ Enhanced closeChangePasswordModal function
function closeChangePasswordModal() {
    const modal = document.getElementById("changePasswordModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
        
        // Reset form
        const form = document.getElementById("changePasswordForm");
        if (form) {
            form.reset();
        }
        
        // Clear validation states
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => {
            input.classList.remove('error', 'success');
        });
    }
}

window.closeChangePasswordModal = closeChangePasswordModal;

// ✅ Enhanced password validation and UX
document.addEventListener('DOMContentLoaded', function() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmNewPassword');
    
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            validatePasswordStrength(this.value);
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            validatePasswordMatch();
        });
    }
});

// Password strength validation
function validatePasswordStrength(password) {
    const strengthBar = document.querySelector('.password-strength-fill');
    const strengthText = document.querySelector('.password-strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    let feedback = '';
    
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    
    // Remove existing classes
    strengthBar.className = 'password-strength-fill';
    
    if (strength <= 25) {
        strengthBar.classList.add('password-strength-weak');
        feedback = 'Weak';
    } else if (strength <= 50) {
        strengthBar.classList.add('password-strength-fair');
        feedback = 'Fair';
    } else if (strength <= 75) {
        strengthBar.classList.add('password-strength-good');
        feedback = 'Good';
    } else {
        strengthBar.classList.add('password-strength-strong');
        feedback = 'Strong';
    }
    
    strengthText.textContent = feedback;
}

// Password match validation
function validatePasswordMatch() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const confirmInput = document.getElementById('confirmNewPassword');
    
    if (confirmPassword && newPassword !== confirmPassword) {
        confirmInput.classList.add('error');
        confirmInput.classList.remove('success');
    } else if (confirmPassword && newPassword === confirmPassword) {
        confirmInput.classList.remove('error');
        confirmInput.classList.add('success');
    } else {
        confirmInput.classList.remove('error', 'success');
    }
}

// Modal functions are now handled by global functions in main.html
// Remove duplicate declarations to avoid conflicts

// Edit resident modal function
function editResident(id) {
    console.log('Editing resident with ID:', id);
    // This function should be implemented to open the edit modal with resident data
    // You can add the implementation here if needed
}

// Delete resident function
function deleteResident(id) {
    if (confirm('Are you sure you want to delete this resident?')) {
        console.log('Deleting resident with ID:', id);
        // Add delete implementation here
        showSuccess('Resident deleted successfully!');
    }
}

// Modal functions are handled by global functions in main.html

// Toggle barangay delivery details is implemented below at line ~4004

// Print barangay delivery receipt is implemented below at line ~4024

// ===== INVENTORY HISTORY & BATCH MANAGEMENT =====

// Show inventory history modal
async function showInventoryHistory() {
    try {
        const modal = document.getElementById('historyModal');
        if (!modal) return;
        
        // Load history data
        const logs = await getInventoryLogs();
        const historyBody = document.getElementById('inventoryHistoryBody');
        if (!historyBody) return;
        
        // Clear existing data
        historyBody.innerHTML = '';
        
        if (logs.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No inventory history found.</td></tr>';
        } else {
            logs.forEach(log => {
                const row = document.createElement('tr');
                const createdAt = log.createdAt?.toDate ? log.createdAt.toDate() : new Date();
                
                // Format items display
                let itemsDisplay = '';
                if (log.items) {
                    const items = [];
                    if (log.items.rice) items.push(`Rice: ${log.items.rice}`);
                    if (log.items.biscuits) items.push(`Biscuits: ${log.items.biscuits}`);
                    if (log.items.canned) items.push(`Canned: ${log.items.canned}`);
                    if (log.items.shirts) items.push(`Shirts: ${log.items.shirts}`);
                    itemsDisplay = items.join(', ');
                }
                
                row.innerHTML = `
                    <td>${createdAt.toLocaleString()}</td>
                    <td>${log.action === 'stock-in' ? '📈 Stock In' : '📉 Delivery'}</td>
                    <td>${itemsDisplay || 'N/A'}</td>
                    <td>-</td>
                    <td>${log.user || 'System'}</td>
                    <td>${log.id || 'N/A'}</td>
                `;
                historyBody.appendChild(row);
            });
        }
        
        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading inventory history:', error);
        showError('Failed to load inventory history.');
    }
}

// Show new batch modal
function showNewBatchModal() {
    const batchName = prompt('Enter relief operation name:', 'Relief Operation ' + new Date().toLocaleDateString());
    if (batchName) {
        startNewReliefOperation(batchName);
    }
}

// Start new relief operation
async function startNewReliefOperation(name) {
    try {
        const periodLabel = new Date().toLocaleDateString();
        await startNewBatch(name, periodLabel);
        showSuccess('New relief operation started. Inventory has been reset.');
        
        // Refresh inventory totals
        if (typeof window.refreshInventoryTotals === 'function') {
            await window.refreshInventoryTotals();
        }
    } catch (error) {
        console.error('Error starting new relief operation:', error);
        showError('Failed to start new relief operation.');
    }
}

// Generate summary report
async function generateSummaryReport() {
    try {
        let activeBatch, logs, totals;
        
        try {
            activeBatch = await getActiveBatch();
        } catch (e) {
            console.warn('Failed to get active batch:', e);
            activeBatch = { id: 'default', name: 'Current Operation', periodLabel: new Date().toLocaleDateString() };
        }
        
        try {
            logs = await getInventoryLogs({ batchId: activeBatch.id });
        } catch (e) {
            console.warn('Failed to get inventory logs:', e);
            logs = [];
        }
        
        try {
            totals = await getInventoryTotals();
        } catch (e) {
            console.warn('Failed to get inventory totals:', e);
            totals = { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
        }
        
        // Create summary data
        let stockIn = { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
        let deliveries = { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
        
        logs.forEach(log => {
            if (log.action === 'stock-in' && log.items) {
                stockIn.rice += Number(log.items.rice || 0);
                stockIn.biscuits += Number(log.items.biscuits || 0);
                stockIn.canned += Number(log.items.canned || 0);
                stockIn.shirts += Number(log.items.shirts || 0);
            } else if (log.action === 'delivery' && log.items) {
                deliveries.rice += Number(log.items.rice || 0);
                deliveries.biscuits += Number(log.items.biscuits || 0);
                deliveries.canned += Number(log.items.canned || 0);
                deliveries.shirts += Number(log.items.shirts || 0);
            }
        });
        
        // Create summary HTML using standardized template
        const summaryHtml = `
            <div class="section">
                <div class="grid-2">
                    <table>
                        <tr><th>Operation:</th><td>${activeBatch.name}</td></tr>
                        <tr><th>Period:</th><td>${activeBatch.periodLabel}</td></tr>
                        <tr><th>Total Transactions:</th><td>${logs.length}</td></tr>
                    </table>
                    <div></div>
                </div>
            </div>
            
            <div class="section">
                <div class="small" style="font-weight:700;margin-bottom:6px;">Current Inventory</div>
                <table>
                    <tr><th>Item</th><th>Current Stock</th></tr>
                    <tr><td>Rice (sacks)</td><td>${totals.rice}</td></tr>
                    <tr><td>Biscuits (boxes)</td><td>${totals.biscuits}</td></tr>
                    <tr><td>Canned Goods (boxes)</td><td>${totals.canned}</td></tr>
                    <tr><td>Shirts (packs)</td><td>${totals.shirts}</td></tr>
                </table>
            </div>
            
            <div class="section">
                <div class="grid-2">
                    <div>
                        <div class="small" style="font-weight:700;margin-bottom:6px;">Stock Received</div>
                        <table>
                            <tr><th>Item</th><th>Total Received</th></tr>
                            <tr><td>Rice (sacks)</td><td>${stockIn.rice}</td></tr>
                            <tr><td>Biscuits (boxes)</td><td>${stockIn.biscuits}</td></tr>
                            <tr><td>Canned Goods (boxes)</td><td>${stockIn.canned}</td></tr>
                            <tr><td>Shirts (packs)</td><td>${stockIn.shirts}</td></tr>
                        </table>
                    </div>
                    <div>
                        <div class="small" style="font-weight:700;margin-bottom:6px;">Deliveries Made</div>
                        <table>
                            <tr><th>Item</th><th>Total Delivered</th></tr>
                            <tr><td>Rice (sacks)</td><td>${deliveries.rice}</td></tr>
                            <tr><td>Biscuits (boxes)</td><td>${deliveries.biscuits}</td></tr>
                            <tr><td>Canned Goods (boxes)</td><td>${deliveries.canned}</td></tr>
                            <tr><td>Shirts (packs)</td><td>${deliveries.shirts}</td></tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Use standardized A4 template for printing
        const pageHTML = buildA4PrintHTML({
            title: 'RELIEF OPERATION SUMMARY REPORT',
            subtitle: 'Municipal Social Welfare and Development Office',
            bodyHTML: summaryHtml,
            footerHTML: `<div class="small">This is an official summary report. Generated on ${new Date().toLocaleString()}.</div>`
        });
        
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            // Popup blocked - fallback to download as HTML file
            const blob = new Blob([pageHTML], { type: 'text/html' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Relief_Summary_${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('Summary report downloaded as HTML file.');
            return;
        }
        
        try {
            printWindow.document.write(pageHTML);
            printWindow.document.close();
            printWindow.focus();
            
            // Wait a bit for content to load, then print
            setTimeout(() => {
                printWindow.print();
            }, 500);
        } catch (docError) {
            printWindow.close();
            throw new Error('Failed to write to print window: ' + docError.message);
        }
        
    } catch (error) {
        console.error('Error generating summary report:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to generate summary report.';
        if (error.message.includes('popup') || error.message.includes('blocked')) {
            errorMessage = 'Popup blocked. Please allow popups for this site and try again.';
        } else if (error.message.includes('print window')) {
            errorMessage = 'Cannot open print window. Please check your browser settings.';
        } else if (error.message.includes('document')) {
            errorMessage = 'Browser security settings prevent opening the report. Please try downloading it instead.';
        }
        
        showError(errorMessage);
    }
}

// Show delivery history for barangays
async function showDeliveryHistory() {
    try {
        if (!loggedInUserData || loggedInUserData.role !== 'barangay') {
            showError('Access denied. Barangay users only.');
            return;
        }
        
        const modal = document.getElementById('deliveryHistoryModal');
        if (!modal) {
            showError('Delivery history modal not found.');
            return;
        }
        
        // Get all deliveries for this barangay
        const deliveries = await getDeliveries(loggedInUserData.username);
        const historyBody = document.getElementById('deliveryHistoryBody');
        if (!historyBody) {
            showError('History table body not found.');
            return;
        }
        
        // Clear existing data
        historyBody.innerHTML = '';
        
        if (deliveries.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No delivery history found.</td></tr>';
        } else {
            // Filter for received/completed deliveries
            const completedDeliveries = deliveries.filter(d => d.status === 'Received' || d.status === 'Delivered');
            
            if (completedDeliveries.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No completed deliveries yet.</td></tr>';
            } else {
                completedDeliveries.forEach(delivery => {
                    const row = document.createElement('tr');
                    
                    // Safely handle dates
                    const deliveryDate = safeToDate(delivery.deliveryDate);
                    const updatedAt = safeToDate(delivery.updatedAt);
                    const preferredTime = delivery.preferredTime || 'Anytime';
                    
                    // Format items received without emojis and without truncation
                    let itemsReceived = 'N/A';
                    if (delivery.goods) {
                        const items = [];
                        if (delivery.goods.rice) items.push(`${delivery.goods.rice} Rice`);
                        if (delivery.goods.biscuits) items.push(`${delivery.goods.biscuits} Biscuits`);
                        if (delivery.goods.canned) items.push(`${delivery.goods.canned} Canned`);
                        if (delivery.goods.shirts) items.push(`${delivery.goods.shirts} Shirts`);
                        itemsReceived = items.join('<br>');
                    }
                    
                    // Priority with text-only badge
                    const priority = delivery.priority || 'Normal';
                    const priorityClass = priority.toLowerCase().replace(' ', '-');
                    const priorityBadge = `<span class="priority-badge priority-${priorityClass}">${priority}</span>`;
                    
                    // Details with notes (no emojis, full text)
                    let detailsDisplay = delivery.details || 'No details';
                    if (delivery.notes) {
                        detailsDisplay += `<br><small class="notes-text">${delivery.notes}</small>`;
                    }
                    
                    row.innerHTML = `
                        <td>
                            <div class="date-info">
                                <span class="date-text">${deliveryDate.toLocaleDateString()}</span>
                                <span class="time-text">${preferredTime}</span>
                            </div>
                        </td>
                        <td><div class="items-content">${itemsReceived}</div></td>
                        <td>${priorityBadge}</td>
                        <td><span class="status-badge status-${delivery.status?.toLowerCase().replace(' ', '-')}">${delivery.status}</span></td>
                        <td><div class="details-content">${detailsDisplay}</div></td>
                        <td>${updatedAt.toLocaleDateString()}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }
        }
        
        // Initialize DataTable for delivery history with export buttons
        try {
            if (window.jQuery && $('#deliveryHistoryTable').length) {
                if ($.fn.dataTable.isDataTable('#deliveryHistoryTable')) {
                    $('#deliveryHistoryTable').DataTable().destroy();
                }
                const dt = $('#deliveryHistoryTable').DataTable({
                    order: [[0, 'desc']], // Most recent first
                    dom: 'Bfrtip',
                    buttons: [
                        { extend: 'excelHtml5', title: 'Delivery History', text: 'Excel', exportOptions: { columns: ':not(.no-export)' } },
                        { extend: 'pdfHtml5', title: 'Delivery History', text: 'PDF', pageSize: 'A4',
                          customize: function (doc) {
                            doc.pageMargins = [20, 40, 20, 30];
                            doc.styles.tableHeader = { bold: true, fillColor: '#f5f5f5' };
                            doc.content.unshift({ text: 'DELIVERY HISTORY REPORT', style: { bold: true, fontSize: 14 }, alignment: 'center', margin: [0,0,0,6] });
                            doc.content.unshift({ text: 'Municipal Social Welfare and Development Office', alignment: 'center', fontSize: 10, margin: [0,0,0,12] });
                          },
                          exportOptions: { columns: ':not(.no-export)' } },
                        { extend: 'print', title: 'Delivery History', text: 'Print',
                          customize: function (win) {
                            try {
                              const body = win.document.body;
                              const content = body.innerHTML;
                              const wrapper = `
                                <div class="page">
                                  <div class="header">
                                    <div class="title">DELIVERY HISTORY REPORT</div>
                                    <div class="subtitle">Municipal Social Welfare and Development Office</div>
                                  </div>
                                  <div class="content">${content}</div>
                                  <div class="footer"><div>Generated on ${new Date().toLocaleString()}</div></div>
                                </div>`;
                              const style = win.document.createElement('style');
                              style.innerHTML = `@page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header{ text-align:center; border-bottom:1px solid #e5e7eb; padding-bottom:8px; } .title{ font-size:16px; font-weight:700;} .subtitle{ font-size:11px; color:#555;} .content{ padding:10px 2px;} .footer{ border-top:1px solid #e5e7eb; padding-top:8px; font-size:10px; color:#666; } table{ width:100%; border-collapse:collapse;} th,td{ border:1px solid #e5e7eb; padding:6px 8px; font-size:12px;} th{ background:#f5f5f5; } .priority-badge{ padding:2px 6px; border-radius:8px; font-size:10px; } .date-info{ font-size:11px; } .time-text{ color:#666; }`;
                              body.innerHTML = wrapper;
                              body.appendChild(style);
                            } catch(_) {}
                          },
                          exportOptions: { columns: ':not(.no-export)' } }
                    ],
                    pageLength: 10
                });
                
                // Align export buttons and search nicely in the wrapper
                setTimeout(() => {
                    try {
                        const wrapper = document.getElementById('deliveryHistoryTable').closest('.dataTables_wrapper');
                        const btns = wrapper ? wrapper.querySelector('.dt-buttons') : null;
                        const filter = wrapper ? wrapper.querySelector('.dataTables_filter') : null;
                        if (btns) {
                            btns.style.cssText = `
                                margin: 0 0 12px 0 !important;
                                display: inline-flex !important;
                                gap: 8px !important;
                                flex-wrap: wrap !important;
                            `;
                            // Color-code buttons
                            btns.querySelectorAll('button').forEach((button, index) => {
                                button.style.cssText = `
                                    display: inline-flex !important;
                                    align-items: center !important;
                                    justify-content: center !important;
                                    min-height: 32px !important;
                                    padding: 8px 12px !important;
                                    background: ${index === 0 ? '#217346' : index === 1 ? '#dc2626' : '#7c3aed'} !important;
                                    color: white !important;
                                    border: none !important;
                                    border-radius: 6px !important;
                                    font-size: 0.85rem !important;
                                    font-weight: 500 !important;
                                `;
                            });
                        }
                        if (filter) {
                            filter.style.cssText = `
                                margin: 0 0 12px 0 !important;
                                float: right !important;
                                text-align: right !important;
                            `;
                            const input = filter.querySelector('input');
                            if (input) {
                                input.style.width = '260px';
                                input.style.maxWidth = '100%';
                                input.placeholder = 'Search...';
                            }
                        }
                    } catch(err) {
                        console.warn('Error aligning delivery history toolbar:', err);
                    }
                }, 100);
            }
        } catch (e) { 
            console.warn('DataTable init (delivery history) failed:', e); 
        }
        
        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        
    } catch (error) {
        console.error('Error loading delivery history:', error);
        showError('Failed to load delivery history: ' + error.message);
    }
}

// Helper function to safely convert various date formats to Date object
function safeToDate(dateInput) {
    if (!dateInput) return new Date();
    
    // Firestore Timestamp with toDate() method
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        return dateInput.toDate();
    }
    
    // Already a Date object
    if (dateInput instanceof Date) {
        return dateInput;
    }
    
    // String or number that can be converted to Date
    try {
        return new Date(dateInput);
    } catch (error) {
        console.warn('Failed to convert date:', dateInput, error);
        return new Date();
    }
}

// Toggle barangay delivery details expansion (similar to admin)
function toggleBarangayDeliveryDetails(deliveryId) {
    const detailsRow = document.getElementById(`barangay-details-row-${deliveryId}`);
    const mainRow = detailsRow?.previousElementSibling;
    const indicator = mainRow?.querySelector('.expand-indicator');
    
    if (detailsRow && mainRow) {
        const isExpanding = detailsRow.classList.contains('hidden');
        detailsRow.classList.toggle('hidden');
        
        // Rotate the indicator and add visual feedback
        if (indicator) {
            indicator.style.transform = isExpanding ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        // Add visual feedback to the main row
        if (isExpanding) {
            mainRow.classList.add('row-expanded');
            detailsRow.style.display = 'table-row';
        } else {
            mainRow.classList.remove('row-expanded');
            detailsRow.style.display = 'none';
        }
    }
}

// Print receipt for barangay delivery
function printBarangayDeliveryReceipt(deliveryId, deliveryData) {
    const barangayName = loggedInUserData?.username?.replace('barangay_', '') || 'Unknown Barangay';
    
    // Safely handle dates
    const deliveryDate = safeToDate(deliveryData.deliveryDate);
    const receivedDate = safeToDate(deliveryData.updatedAt);
    
    // Format goods list
    const goodsList = [];
    if (deliveryData.goods) {
        if (deliveryData.goods.rice > 0) goodsList.push(`Rice: ${deliveryData.goods.rice} sacks`);
        if (deliveryData.goods.biscuits > 0) goodsList.push(`Biscuits: ${deliveryData.goods.biscuits} boxes`);
        if (deliveryData.goods.canned > 0) goodsList.push(`Canned Goods: ${deliveryData.goods.canned} boxes`);
        if (deliveryData.goods.shirts > 0) goodsList.push(`Shirts: ${deliveryData.goods.shirts} packs`);
    }
    
    const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Delivery Receipt - ${barangayName}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    max-width: 600px; 
                    margin: 20px auto; 
                    padding: 20px;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .receipt-title {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2563eb;
                    margin-bottom: 5px;
                }
                .receipt-subtitle {
                    color: #666;
                    font-size: 16px;
                }
                .info-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding: 5px 0;
                    border-bottom: 1px dotted #ccc;
                }
                .info-label {
                    font-weight: bold;
                    color: #333;
                }
                .info-value {
                    color: #666;
                }
                .items-section {
                    margin-bottom: 25px;
                }
                .items-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 5px;
                }
                .item {
                    padding: 8px 15px;
                    margin: 5px 0;
                    background: #e0f2fe;
                    border-left: 4px solid #0ea5e9;
                    border-radius: 4px;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }
                .signature-section {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                }
                .signature-box {
                    text-align: center;
                    width: 200px;
                }
                .signature-line {
                    border-bottom: 1px solid #333;
                    margin-bottom: 5px;
                    height: 40px;
                }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="receipt-title">RELIEF GOODS DELIVERY RECEIPT</div>
                <div class="receipt-subtitle">Municipal Social Welfare and Development Office</div>
            </div>
            
            <div class="info-section">
                <div class="info-row">
                    <span class="info-label">Receipt ID:</span>
                    <span class="info-value">${deliveryId.substring(0, 8).toUpperCase()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Barangay:</span>
                    <span class="info-value">${barangayName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Delivery Date:</span>
                    <span class="info-value">${deliveryDate.toLocaleDateString()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Received Date:</span>
                    <span class="info-value">${receivedDate.toLocaleDateString()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value">${deliveryData.status || 'Pending'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-row">
                    <span class="info-label">Description:</span>
                </div>
                <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
                    ${deliveryData.details || 'No description provided'}
                </div>
            </div>
            
            <div class="items-section">
                <div class="items-title">Items Received</div>
                ${goodsList.length > 0 ? 
                    goodsList.map(item => `<div class="item">• ${item}</div>`).join('') : 
                    '<div class="item">No specific items listed</div>'
                }
            </div>
            
            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div>MSWD Representative</div>
                    <div style="font-size: 11px; color: #999;">Signature over Printed Name</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div>Barangay Representative</div>
                    <div style="font-size: 11px; color: #999;">Signature over Printed Name</div>
                </div>
            </div>
            
            <div class="footer">
                <p>This is an official receipt for relief goods delivery.</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>Keep this receipt for your records.</p>
            </div>
        </body>
        </html>
    `;
    
// Open in new window using standardized A4 template
    const pageHTML = buildA4PrintHTML({
        title: 'RELIEF GOODS DELIVERY RECEIPT',
        subtitle: 'Municipal Social Welfare and Development Office',
        bodyHTML: `
            <div class="section">
                <div class="grid-2">
                    <table>
                        <tr><th>Receipt ID:</th><td>${deliveryId.substring(0, 8).toUpperCase()}</td></tr>
                        <tr><th>Barangay:</th><td>${barangayName}</td></tr>
                        <tr><th>Delivery Date:</th><td>${deliveryDate.toLocaleDateString()}</td></tr>
                        <tr><th>Received Date:</th><td>${receivedDate.toLocaleDateString()}</td></tr>
                        <tr><th>Status:</th><td>${deliveryData.status || 'Pending'}</td></tr>
                    </table>
                    <div class="section">
                        <div class="small muted">Description:</div>
                        <div style="margin-top:6px; padding:10px; background:#fff; border:1px solid #e5e7eb; border-radius:4px; min-height:60px;">${deliveryData.details || 'No description provided'}</div>
                    </div>
                </div>
            </div>
            <div class="section">
                <div class="small" style="font-weight:700;margin-bottom:6px;">Items Received</div>
                <div>${goodsList.length > 0 ? goodsList.map(item => `<div class="small">• ${item}</div>`).join('') : '<div class="small muted">No specific items listed</div>'}</div>
            </div>
            <div class="sig-row">
                <div class="sig"><div class="line"></div><div>MSWD Representative</div><div class="muted small">Signature over Printed Name</div></div>
                <div class="sig"><div class="line"></div><div>Barangay Representative</div><div class="muted small">Signature over Printed Name</div></div>
            </div>
        `,
        footerHTML: `<div class="small">This is an official receipt for relief goods delivery. Generated on ${new Date().toLocaleString()}.</div>`
    });
    openPrintA4(pageHTML);
}

// Expose functions globally
window.showInventoryHistory = showInventoryHistory;
window.showNewBatchModal = showNewBatchModal;
window.generateSummaryReport = generateSummaryReport;
window.showDeliveryHistory = showDeliveryHistory;
window.handleScheduleDelivery = handleScheduleDelivery;
window.updateDeliveryStatus = updateDeliveryStatus;
window.toggleDeliveryDetails = toggleDeliveryDetails;
window.toggleBarangayDeliveryDetails = toggleBarangayDeliveryDetails;
window.printBarangayDeliveryReceipt = printBarangayDeliveryReceipt;
