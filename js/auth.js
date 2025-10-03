/**
 * Authentication Module
 * Handles user authentication, session management, and login/logout functionality
 */

// Authentication state management
let loggedInUserData = null;
let currentUserRole = null;
let currentBarangayName = null;

// Session management functions
function initializeSessionManagement() {
    console.log('Initializing session management system...');

    // Run cleanup on startup
    cleanupExpiredSessions().catch(error => {
        console.error('Error during startup session cleanup:', error);
    });

    // Set up periodic session cleanup (every 30 minutes)
    setInterval(() => {
        console.log('Running periodic session cleanup...');
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

    console.log('Session management system initialized');
}

// Validate current user's session
async function validateCurrentUserSession() {
    const currentEmail = localStorage.getItem('currentUserEmail');
    const sessionId = localStorage.getItem('currentSessionId');

    if (currentEmail && sessionId) {
        try {
            const isValid = await validateCurrentSession(currentEmail, sessionId);
            if (!isValid) {
                console.warn('Current session is no longer valid, logging out...');
                if (window.Swal) {
                    await Swal.fire({
                        title: 'Session Expired',
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
        console.log('Page unloading - attempting session cleanup');
        // In a real application, you might send a beacon to a server endpoint
        // that handles session cleanup server-side
    }
}

// Enhanced logout with session management
window.logout = async function () {
    try {
        const currentEmail = localStorage.getItem('currentUserEmail');
        const sessionId = localStorage.getItem('currentSessionId');

        console.log('Starting logout process...');
        console.log('Current email:', currentEmail);
        console.log('Session ID:', sessionId);

        // Terminate session in Firestore before signing out
        if (currentEmail) {
            console.log('Terminating session in Firestore...');
            await terminateUserSession(currentEmail);
            console.log('Session terminated in Firestore');
            try {
                await terminateUserSession(currentEmail);
                console.log('Session terminated in Firestore');
            } catch (error) {
                console.error('Error terminating session in Firestore:', error);
                // Continue with logout even if session termination fails
            }
        }

        // Clear local storage and hide session status
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('currentUserEmail');
        hideSessionStatusUI();
        console.log('Local storage cleared and UI updated');

        // Sign out from Firebase Auth
        await auth.signOut();
        console.log('Firebase auth sign out complete');

        // Show logout success message before reload
        if (window.Swal) {
            await Swal.fire({
                title: 'Logged Out',
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
        console.error('Error during logout:', error);

        // Still attempt to clear local state on error
        localStorage.removeItem('currentSessionId');
        localStorage.removeItem('currentUserEmail');

        if (window.Swal) {
            await Swal.fire({
                title: 'Logout Issue',
                text: 'There was an issue during logout, but you have been logged out locally.',
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#f59e0b'
            });
        }

        location.reload();
    }
};

// Initialize App when page loads
document.addEventListener("DOMContentLoaded", async () => {
    initializeDefaultAdmin();
    loadBarangaysFromFirebase(); // Load Barangays on page load

    // Initialize enhanced click prevention for forms
    initializeFormEnhancements();

    // Override global functions with full implementations
    setupGlobalFunctions();

    // NEW: Initialize session management and monitoring
    initializeSessionManagement();
});

// Auto login persist
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User is logged in:", user.email);

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
        console.log("No user logged in");
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('dashboardContainer').classList.add('hidden');
    }
});

async function initializeDefaultAdmin() {
    const usersRef = collection(db, "users");
    const adminQuery = query(usersRef, where("username", "==", "admin_mswd"));
    const querySnapshot = await getDocs(adminQuery);

    if (querySnapshot.empty) {
        const userCredential = await createUserWithEmailAndPassword(auth, "admin_mswd@example.com", "polangui12345");
        await createUserInFirestore(userCredential.user.uid, "admin_mswd", "admin_mswd@example.com", "mswd");
    }
}

async function initializeUser(userData) {
    loggedInUserData = userData;
    console.log("Initializing user with data:", userData);
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');
    document.getElementById('userRole').innerText = `Welcome, ${userData.role.toUpperCase()}`;

    // NEW: Initialize session status display
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
        loadResidentsForBarangay(barangayName); // Automatic load residents pag login

        // Setup barangay-specific button functionality
        setTimeout(() => {
            setupBarangayButtons();
        }, 100); // Small delay to ensure DOM is ready

        showSection('deliveryStatus');
    }
}

// Session status UI management
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
                console.warn('Current session is no longer valid, updating UI...');
                updateSessionStatusUI('invalid');

                // Show session expired dialog
                if (window.Swal) {
                    await Swal.fire({
                        title: 'Session Expired',
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

export {
    loggedInUserData,
    currentUserRole,
    currentBarangayName,
    initializeSessionManagement,
    validateCurrentUserSession,
    handleVisibilityChange,
    handlePageUnload,
    updateSessionStatusUI,
    hideSessionStatusUI,
    validateCurrentUserSessionWithUI,
    initializeDefaultAdmin,
    initializeUser
};
