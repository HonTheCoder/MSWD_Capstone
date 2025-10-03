// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc,   // ✅ Added this
    addDoc, 
    setDoc,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc, // ✅ For deleting requests
    Timestamp,
    runTransaction,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    signInWithEmailAndPassword, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider, 
    createUserWithEmailAndPassword, 
    fetchSignInMethodsForEmail // ✅ Proper import
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ✅ Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC_4SPOGyi0PJY5Wo4V8BtSdQGpvtX3HEk",
    authDomain: "relief-allocation-app.firebaseapp.com",
    projectId: "relief-allocation-app",
    storageBucket: "relief-allocation-app.appspot.com",
    messagingSenderId: "720199363072",
    appId: "1:720199363072:web:1868c9182d2aa34c2bc6e5"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ✅ Create User in Firestore (for Admin/Barangay)
export async function createUserInFirestore(uid, username, email, role = 'barangay') {
    try {
        await addDoc(collection(db, "users"), {
            uid,
            username,
            email,
            role,
            isFirstLogin: true,
            createdAt: serverTimestamp()
        });
        console.log(`✅ User ${username} added to Firestore.`);
    } catch (error) {
        console.error("❌ Error adding user to Firestore:", error);
        throw error;
    }
}

// ✅ Request Account (Barangay request)
export async function requestAccount(barangayName, email, contact, message) {
    try {
        await addDoc(collection(db, "accountRequests"), {
            barangayName,
            email,
            contact,
            message,
            status: 'pending',
            dateRequested: serverTimestamp()
        });
        console.log("✅ Account request submitted.");
        return true;
    } catch (error) {
        console.error("❌ Error submitting account request:", error);
        throw error;
    }
}

// ✅ Change Password Function (With Re-auth)
export async function changePassword(currentPassword, newPassword) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user is logged in");

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        console.log("✅ Password updated successfully.");
        return true;
    } catch (error) {
        console.error("❌ Error changing password:", error);
        throw error;
    }
}

// ✅ Get All Pending Requests (For MSWD Review)
export async function getPendingRequests() {
    try {
        const q = query(collection(db, "accountRequests"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        console.log("✅ Fetched pending requests.");
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("❌ Error fetching requests:", error);
        throw error;
    }
}

// ✅ Add New Delivery
export async function addDelivery(barangay, deliveryDate, details) {
    try {
        if (!barangay || !deliveryDate || !details) {
            throw new Error("Missing required fields: Barangay, Delivery Date, or Details.");
        }
        await addDoc(collection(db, "deliveries"), {
            barangay,
            deliveryDate: Timestamp.fromDate(new Date(deliveryDate)),
            details,
            status: "Pending",
            timestamp: serverTimestamp(),
        });
        console.log("✅ Delivery scheduled for Barangay:", barangay);
        return true;
    } catch (error) {
        console.error("❌ Error scheduling delivery:", error);
        throw error;
    }
}

// Inventory document: collection 'inventory', doc 'totals'
export async function getInventoryTotals() {
    const ref = doc(db, 'inventory', 'totals');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
}

// Ensure inventory totals doc exists
export async function ensureInventoryTotals() {
    const ref = doc(db, 'inventory', 'totals');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { rice: 0, biscuits: 0, canned: 0, shirts: 0, updatedAt: serverTimestamp() });
    }
    return ref;
}

export async function addInventory(delta) {
    const ref = await ensureInventoryTotals();
    const current = await getInventoryTotals();
    const next = {
        rice: (current.rice || 0) + (Number(delta.rice) || 0),
        biscuits: (current.biscuits || 0) + (Number(delta.biscuits) || 0),
        canned: (current.canned || 0) + (Number(delta.canned) || 0),
        shirts: (current.shirts || 0) + (Number(delta.shirts) || 0),
        updatedAt: serverTimestamp(),
    };
    await setDoc(ref, next, { merge: true });
    return next;
}

export async function deductInventory(delta) {
    return addInventory({
        rice: -(Number(delta.rice) || 0),
        biscuits: -(Number(delta.biscuits) || 0),
        canned: -(Number(delta.canned) || 0),
        shirts: -(Number(delta.shirts) || 0),
    });
}

// ✅ Transactional inventory update (atomic add/deduct with non-negative guard)
export async function updateInventoryTransaction(delta) {
    const totalsRef = doc(db, 'inventory', 'totals');
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(totalsRef);
        const cur = snap.exists() ? snap.data() : { rice: 0, biscuits: 0, canned: 0, shirts: 0 };
        const next = {
            rice: (cur.rice || 0) + (Number(delta.rice) || 0),
            biscuits: (cur.biscuits || 0) + (Number(delta.biscuits) || 0),
            canned: (cur.canned || 0) + (Number(delta.canned) || 0),
            shirts: (cur.shirts || 0) + (Number(delta.shirts) || 0),
            updatedAt: serverTimestamp()
        };
        if (next.rice < 0 || next.biscuits < 0 || next.canned < 0 || next.shirts < 0) {
            throw new Error('INSUFFICIENT_INVENTORY');
        }
        tx.set(totalsRef, next, { merge: true });
    });
}

// ===== Batch/Transaction Management =====
// Collection: inventory_batches (one active at a time)
export async function getActiveBatch() {
    // Use simple query to avoid composite index requirement
    const qBatch = query(collection(db, 'inventory_batches'), where('active', '==', true), limit(1));
    const snap = await getDocs(qBatch);
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    // Create default batch if none
    const ref = await addDoc(collection(db, 'inventory_batches'), {
        name: 'Default Batch',
        periodLabel: new Date().toLocaleString(),
        active: true,
        startedAt: serverTimestamp()
    });
    return { id: ref.id, name: 'Default Batch', active: true };
}

export async function startNewBatch(name, periodLabel) {
    // deactivate existing
    const qBatch = query(collection(db, 'inventory_batches'), where('active', '==', true));
    const snap = await getDocs(qBatch);
    const batchPromises = [];
    snap.forEach(d => {
        batchPromises.push(updateDoc(doc(db, 'inventory_batches', d.id), { active: false, endedAt: serverTimestamp() }));
    });
    await Promise.all(batchPromises);
    // create new
    const ref = await addDoc(collection(db, 'inventory_batches'), {
        name: name || 'Relief Operation',
        periodLabel: periodLabel || new Date().toLocaleDateString(),
        active: true,
        startedAt: serverTimestamp()
    });
    // reset totals to zero
    await setDoc(doc(db, 'inventory', 'totals'), { rice: 0, biscuits: 0, canned: 0, shirts: 0, updatedAt: serverTimestamp() }, { merge: true });
    return ref.id;
}

// ===== Inventory Logs =====
// Collection: inventory_logs (append-only)
export async function logInventoryTransaction(entry) {
    const active = await getActiveBatch();
    const payload = {
        ...entry,
        batchId: entry.batchId || active.id,
        createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'inventory_logs'), payload);
}

export async function getInventoryLogs({ batchId, barangay, limitCount = 200 } = {}) {
    // Use simple query first, then filter client-side to avoid index requirements
    let qLogs = query(collection(db, 'inventory_logs'), limit(limitCount));
    const snap = await getDocs(qLogs);
    const rows = [];
    snap.forEach(d => {
        const data = { id: d.id, ...d.data() };
        // Filter client-side if batchId is specified
        if (!batchId || data.batchId === batchId) {
            rows.push(data);
        }
    });
    // Sort by creation date (client-side)
    return rows.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate - aDate;
    }).slice(0, limitCount);
}

// Mark delivery deducted flag
export async function markDeliveryDeducted(deliveryId) {
    const ref = doc(db, 'deliveries', deliveryId);
    await updateDoc(ref, { inventoryDeducted: true, inventoryDeductedAt: serverTimestamp() });
}

export async function isDeliveryDeducted(deliveryId) {
    const ref = doc(db, 'deliveries', deliveryId);
    const snap = await getDoc(ref);
    return !!snap.data()?.inventoryDeducted;
}

// ✅ Check if sufficient inventory is available for delivery
async function validateInventoryAvailability(requestedGoods) {
    try {
        const currentInventory = await getInventoryTotals();
        const validationResult = {
            isValid: true,
            insufficientItems: [],
            availableStock: currentInventory,
            requestedItems: requestedGoods
        };

        // Check each item type
        const itemTypes = ['rice', 'biscuits', 'canned', 'shirts'];
        
        for (const item of itemTypes) {
            const available = currentInventory[item] || 0;
            const requested = Number(requestedGoods[item]) || 0;
            
            if (requested > available) {
                validationResult.isValid = false;
                validationResult.insufficientItems.push({
                    item,
                    requested,
                    available,
                    shortage: requested - available
                });
            }
        }

        return validationResult;
    } catch (error) {
        console.error('Error validating inventory availability:', error);
        throw error;
    }
}

// ✅ Get Deliveries for Barangay (on the Barangay's page)
export async function getDeliveries(barangay) {
    try {
        if (!barangay) {
            throw new Error("Barangay ID is required to fetch deliveries.");
        }

        const q = query(collection(db, "deliveries"), where("barangay", "==", barangay));
        const snapshot = await getDocs(q);

        console.log("✅ Fetched deliveries for Barangay:", barangay);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("❌ Error fetching deliveries:", error);
        throw error;
    }
}

// ✅ Add Resident to Firestore
export async function addResidentToFirestore(residentData) {
    try {
        const { 
            name, 
            age, 
            addressZone, 
            householdNumber, 
            barangay, 
            isStudent, 
            isWorking, 
            monthlyIncome, 
            familyMembers, 
            evacueeHistory,
            aidHistory,
        } = residentData;

        await addDoc(collection(db, "residents"), {
            name,
            age,
            addressZone,
            householdNumber,
            barangay,
            isStudent,
            isWorking,
            monthlyIncome,
            familyMembers,
            aidHistory,
            evacueeHistory,
            timestamp: serverTimestamp(),
        });

        console.log("✅ Resident added to Firestore.");
        return true;
    } catch (error) {
        console.error("❌ Error adding resident:", error);
        throw error;
    }
}

// ===== ENHANCED SESSION MANAGEMENT =====

// Generate unique session ID
export function generateSessionId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create or update user session
export async function createUserSession(email, userData) {
    try {
        const sessionId = generateSessionId();
        const sessionData = {
            sessionId,
            lastLogin: serverTimestamp(),
            isActive: true,
            loginTimestamp: Date.now(),
            userAgent: navigator.userAgent || 'Unknown',
            ipAddress: 'Client-side' // Would need server-side for real IP
        };

        // Update user document with session info
        const userQuery = query(collection(db, "users"), where("email", "==", email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDocRef = userSnapshot.docs[0].ref;
            await updateDoc(userDocRef, sessionData);
            console.log(`✅ Session created for user: ${email}`);
            return sessionId;
        } else {
            throw new Error('User document not found');
        }
    } catch (error) {
        console.error("❌ Error creating user session:", error);
        throw error;
    }
}

// Check if user has an active session
export async function checkActiveSession(email) {
    try {
        const userQuery = query(collection(db, "users"), where("email", "==", email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            if (userData.isActive && userData.sessionId) {
                // Check if session is still valid (within 24 hours)
                const sessionAge = Date.now() - (userData.loginTimestamp || 0);
                const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
                
                if (sessionAge < maxSessionAge) {
                    return {
                        hasActiveSession: true,
                        sessionId: userData.sessionId,
                        lastLogin: userData.lastLogin,
                        loginTimestamp: userData.loginTimestamp,
                        userAgent: userData.userAgent
                    };
                } else {
                    // Session expired, clean it up
                    await terminateUserSession(email);
                    return { hasActiveSession: false };
                }
            }
        }
        return { hasActiveSession: false };
    } catch (error) {
        console.error("❌ Error checking active session:", error);
        return { hasActiveSession: false };
    }
}

// Terminate user session
export async function terminateUserSession(email) {
    try {
        const userQuery = query(collection(db, "users"), where("email", "==", email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userDocRef = userSnapshot.docs[0].ref;
            await updateDoc(userDocRef, {
                sessionId: null,
                isActive: false,
                lastLogout: serverTimestamp()
            });
            console.log(`✅ Session terminated for user: ${email}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error("❌ Error terminating user session:", error);
        throw error;
    }
}

// Cleanup expired sessions (run periodically)
export async function cleanupExpiredSessions() {
    try {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        const activeUsersQuery = query(collection(db, "users"), where("isActive", "==", true));
        const activeUsersSnapshot = await getDocs(activeUsersQuery);
        
        const batch = [];
        activeUsersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            if (userData.loginTimestamp && userData.loginTimestamp < cutoffTime) {
                batch.push({
                    ref: doc.ref,
                    data: {
                        sessionId: null,
                        isActive: false,
                        lastLogout: serverTimestamp()
                    }
                });
            }
        });
        
        // Update expired sessions
        for (const item of batch) {
            await updateDoc(item.ref, item.data);
        }
        
        console.log(`✅ Cleaned up ${batch.length} expired sessions`);
        return batch.length;
    } catch (error) {
        console.error("❌ Error cleaning up expired sessions:", error);
        throw error;
    }
}

// Validate current session
export async function validateCurrentSession(email, sessionId) {
    try {
        const userQuery = query(collection(db, "users"), where("email", "==", email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            return userData.isActive && userData.sessionId === sessionId;
        }
        return false;
    } catch (error) {
        console.error("❌ Error validating current session:", error);
        return false;
    }
}

// LEGACY COMPATIBILITY FUNCTIONS (for backward compatibility)
// Check if user is currently logged in elsewhere
export async function isUserLoggedInElsewhere(username) {
    try {
        // Convert username to email for compatibility
        const barangayName = username.replace('barangay_', '');
        const email = `${barangayName}@example.com`;
        
        const sessionCheck = await checkActiveSession(email);
        return sessionCheck.hasActiveSession;
    } catch (error) {
        console.error('Error checking user login status:', error);
        return false;
    }
}

// Mark user as logged in
export async function setUserLoggedIn(username) {
    try {
        const barangayName = username.replace('barangay_', '');
        const email = `${barangayName}@example.com`;
        
        await createUserSession(email, { username });
        console.log(`✅ User ${username} marked as logged in`);
    } catch (error) {
        console.error('Error setting user login status:', error);
    }
}

// Mark user as logged out
export async function setUserLoggedOut(username) {
    try {
        console.log(`🚪 Starting logout process for: ${username}`);
        const barangayName = username.replace('barangay_', '');
        const email = `${barangayName}@example.com`;
        
        await terminateUserSession(email);
        console.log(`✅ Database updated - User ${username} marked as logged out`);
    } catch (error) {
        console.error('Error setting user logout status:', error);
        throw error;
    }
}

// Force clear login status (for debugging stuck states)
export async function forceLogoutUser(username) {
    try {
        console.log(`🔄 Force clearing login status for: ${username}`);
        await setUserLoggedOut(username);
        console.log(`✅ Force logout completed for ${username}`);
        return true;
    } catch (error) {
        console.error('Error in force logout:', error);
        throw error;
    }
}

// ✅ Export Everything Needed
export { 
    db, 
    auth, 
    collection, 
    query, 
    where, 
    getDocs, 
    getDoc,   // ✅ Added export
    addDoc, 
    setDoc,
    doc, 
    updateDoc, 
    deleteDoc, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    EmailAuthProvider,
    serverTimestamp,
    Timestamp,
    runTransaction,
    orderBy,
    limit,
    validateInventoryAvailability  // ✅ Added for inventory validation
};