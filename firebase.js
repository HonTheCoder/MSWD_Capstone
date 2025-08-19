// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc // ✅ For deleting requests
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
export async function requestAccount(barangayName, email, message) {
    try {
        await addDoc(collection(db, "accountRequests"), {
            barangayName,
            email,
            message,
            status: 'pending',
            timestamp: serverTimestamp()
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
        // Ensure required fields are present
        if (!barangay || !deliveryDate || !details) {
            throw new Error("Missing required fields: Barangay ID, Delivery Date, or Details.");
        }

        // Add delivery for specific Barangay
        await addDoc(collection(db, "deliveries"), {
            barangay, 
            deliveryDate: new Date(deliveryDate),  // ← should be a Date object
            details, 
            status: "scheduled",
            timestamp: serverTimestamp(),
        });       

        console.log("✅ Delivery scheduled for Barangay:", barangay);
        return true;
    } catch (error) {
        console.error("❌ Error scheduling delivery:", error);
        throw error;
    }
}

// ✅ Get Deliveries for Barangay (on the Barangay's page)
export async function getDeliveries(barangay) {
    try {
        // Ensure Barangay ID is provided
        if (!barangay) {
            throw new Error("Barangay ID is required to fetch deliveries.");
        }

        // Query Firestore for deliveries assigned to the Barangay
        const q = query(collection(db, "deliveries"), where("barangay", "==", barangay));
        const snapshot = await getDocs(q);

        console.log("✅ Fetched deliveries for Barangay:", barangay);
        
        // Map through docs and return delivery data
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
            evacueeHistory 
        } = residentData;

        // Add the resident to the "residents" collection
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
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, // ✅ Important for deletion of requests
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    fetchSignInMethodsForEmail,
    EmailAuthProvider
};
