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
    limit
};
