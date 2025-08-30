
function showSuccess(msg) {
    openMessageModal("✅ Success", msg, "green");
}

function showError(msg) {
    openMessageModal("❌ Error", msg, "red");
}

function openMessageModal(title, msg, color) {
    const modal = document.getElementById("messageModal");
    if (!modal) { alert(msg); return; }
    
    // Set title with icon
    document.getElementById("messageTitle").innerHTML = title;
    document.getElementById("messageTitle").style.color = color;
    
    // Set message with better formatting
    document.getElementById("messageText").innerHTML = msg;
    
    // Show modal with enhanced styling
    modal.classList.remove("hidden");
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
}

function closeMessageModal() {
    const modal = document.getElementById("messageModal");
    if (modal) modal.classList.add("hidden");
}

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
    doc, 
    updateDoc, 
    deleteDoc, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    createUserInFirestore,
    fetchSignInMethodsForEmail,
    addResidentToFirestore,
    changePassword
} from './firebase.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let loggedInUserData = null; //(GLOBAL VARIABLE)

// ✅ Auto login persist
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("✅ User is logged in:", user.email);
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

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;

    const barangayName = username.replace('barangay_', '');
    const email = `${barangayName}@example.com`;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        let userFriendlyMessage = "Invalid username or password. Please try again.";
        
        // Handle specific Firebase error codes with user-friendly messages
        if (error.code === 'auth/invalid-credential') {
            userFriendlyMessage = "Invalid username or password. Please try again.";
        } else if (error.code === 'auth/user-not-found') {
            userFriendlyMessage = "Username not found. Please check your username and try again.";
        } else if (error.code === 'auth/wrong-password') {
            userFriendlyMessage = "Incorrect password. Please try again.";
        } else if (error.code === 'auth/too-many-requests') {
            userFriendlyMessage = "Too many failed attempts. Please wait a moment and try again.";
        } else if (error.code === 'auth/network-request-failed') {
            userFriendlyMessage = "Network error. Please check your connection and try again.";
        }
        
        showError(userFriendlyMessage);
    }
}

async function initializeUser(userData) {
    loggedInUserData = userData;
    console.log("Initializing user with data:", userData);
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');
    document.getElementById('userRole').innerText = `Welcome, ${userData.role.toUpperCase()}`;

    if (userData.role === 'mswd') {
        document.querySelectorAll('.mswd-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.barangay-only').forEach(el => el.style.display = 'none');
        loadAccountRequests(); 
    
        showSection('deliveryScheduling');
} else if (userData.role === 'barangay') {
        document.querySelectorAll('.barangay-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.mswd-only').forEach(el => el.style.display = 'none');

        loadBarangayDeliveries(userData.username); 
        
        const barangayName = userData.username.replace('barangay_', '');
        loadResidentsForBarangay(barangayName); // 🔥 Automatic load residents pag login
        showSection('deliveryStatus');
    }
}



async function loadAccountRequests() {
    const requests = await getPendingRequests();
    const tableBody = document.getElementById("requestsTableBody");
    tableBody.innerHTML = "";
    requests.forEach(req => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${req.barangayName}</td>
            <td>Barangay</td>
            <td>${new Date(req.timestamp.seconds * 1000).toLocaleDateString()}</td>
            <td>
                <button onclick="approveRequest('${req.id}', '${req.barangayName}')">Approve</button>
                <button onclick="declineRequest('${req.id}')">Decline</button>
            </td>`;
        tableBody.appendChild(row);
    });
}

window.approveRequest = async function (id, barangayName) {
    const password = prompt(`Set password for ${barangayName}:`);
    if (!password) return alert("Password is required!");

    const formattedBarangay = barangayName.toLowerCase().replace(/\s+/g, '');
    const email = `${formattedBarangay}@example.com`;
    const username = `barangay_${formattedBarangay}`;

    try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email);
        if (signInMethods.length > 0) {
            await createUserInFirestore('already-in-auth', username, email, "barangay");
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await createUserInFirestore(userCredential.user.uid, username, email, "barangay");
        }
        await deleteDoc(doc(db, "accountRequests", id));
        loadAccountRequests();
    } catch (error) { console.error(error); }
};

window.declineRequest = async function (id) {
    await deleteDoc(doc(db, "accountRequests", id));
    loadAccountRequests();
};

async function handleRequestAccount(event) {
    event.preventDefault();
    const username = document.getElementById('requestUsername').value.trim();
    const email = document.getElementById('requestEmail').value.trim();
    const message = document.getElementById('requestMessage').value.trim();
    await requestAccount(username, email, message);
    hideRequestAccount();
}

function showRequestAccount() { document.getElementById("requestAccountModal").classList.remove("hidden"); }
function hideRequestAccount() { document.getElementById("requestAccountModal").classList.add("hidden"); }
    

window.logout = function () { auth.signOut(); location.reload(); };

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

                const row = `<tr>
                    <td>${barangayName}</td>
                    <td>${residentCount}</td>
                    <td><button class="view-residents-btn" data-id="${docSnap.id}" data-bname="${barangayName}" onclick="viewBarangay('${docSnap.id}', '${barangayName}')">View</button></td>
                </tr>`;
                tableBody.innerHTML += row;
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
window.viewBarangay = async function (barangayId, barangayName) {
    console.log('[viewBarangay] Open modal for', barangayName, 'id:', barangayId);
    const modalEl = document.getElementById("viewResidentsModal");
    if (!modalEl) {
        console.error('[viewBarangay] viewResidentsModal not found');
        return;
    }
    // Ensure modal is top-level to avoid stacking contexts
    if (modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
        console.log('[viewBarangay] Moved modal to <body>');
    }
    modalEl.classList.remove("hidden");
    modalEl.style.display = "flex";
    modalEl.style.opacity = "1";
    modalEl.style.pointerEvents = "auto";
    modalEl.style.zIndex = "100000";
    const cs = window.getComputedStyle(modalEl);
    console.log('[viewBarangay] modal style => display:', cs.display, 'opacity:', cs.opacity, 'z-index:', cs.zIndex);
    document.getElementById("viewResidentsTitle").innerText = "Residents of " + barangayName;

    const tableBody = document.getElementById("viewResidentsTableBody");
    const searchInput = document.getElementById("residentSearchInput");
    tableBody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";

    try {
        const residentsRef = collection(db, "residents");
        const q = query(residentsRef, where("barangay", "==", barangayName));
        const snapshot = await getDocs(q);

        let residents = [];
        if (!snapshot.empty) {
            residents = snapshot.docs.map((docSnap) => docSnap.data());
        }

        function renderResidents(filter = "") {
            const filtered = residents.filter(r => {
                const name = (r.name || '').toLowerCase();
                return name.includes(filter.toLowerCase()) ||
                    (r.householdNumber && r.householdNumber.toString().includes(filter));
            });

            if (filtered.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='5'>No matching residents found</td></tr>";
                return;
            }

            tableBody.innerHTML = "";
            filtered.forEach((r) => {
                const row = `
            <tr>
                <td>${r.name}</td>
                <td>${r.age}</td>
                <td>${r.addressZone}</td>
                <td>${r.householdNumber}</td>
                <td>${r.familyMembers}</td>
                <td>${r.monthlyIncome ?? ''}</td>
                <td>${r.aidHistory ?? ''}</td>
                <td>${r.evacueeHistory ?? ''}</td>
            </tr>
        `;
                tableBody.innerHTML += row;
            });
        }

        // Initial render
        renderResidents();
        searchInput.oninput = () => renderResidents(searchInput.value);

    } catch (error) {
        console.error("Error fetching residents:", error);
        tableBody.innerHTML = "<tr><td colspan='5'>Error loading residents</td></tr>";
    }
};

window.closeViewResidentsModal = function () {
    const modalEl = document.getElementById("viewResidentsModal");
    modalEl.classList.add("hidden");
    modalEl.style.display = "none";
};

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

    onSnapshot(q, (snapshot) => {
        tableBody.innerHTML = "";
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;">No deliveries scheduled yet.</td>
                </tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const row = document.createElement("tr");

            const deliveryDate = d.deliveryDate?.toDate?.();
            const dateStr = deliveryDate ? deliveryDate.toLocaleDateString() : "No Date";

            row.innerHTML = `
                <td>${dateStr}</td>
                <td>${d.details || ""}</td>
                <td>${d.status || "Pending"}</td>
                <td>
                    <button onclick="updateDeliveryStatus('${docSnap.id}', 'Received')">Mark Received</button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    });
}

// Function to update delivery status
async function updateDeliveryStatus(deliveryId, newStatus) {
    try {
        const deliveryRef = doc(db, "deliveries", deliveryId);
        await updateDoc(deliveryRef, {
            status: newStatus,
            updatedAt: new Date()
        });
        
        console.log(`Delivery ${deliveryId} status updated to ${newStatus}`);
        showSuccess(`Delivery status updated to ${newStatus}`);
        
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
    } catch (error) {
        console.error("Error updating delivery status:", error);
        showError("Failed to update delivery status. Please try again.");
    }
}

// Function to handle scheduling deliveries
function handleScheduleDelivery() {
    // Get form values
    const barangay = document.getElementById("barangaySelect").value;
    const deliveryDate = document.getElementById("deliveryDate").value;
    const deliveryDetails = document.getElementById("deliveryDetails").value;

    // Add your logic here
    console.log("Scheduled delivery for barangay:", barangay);
    console.log("Date:", deliveryDate);
    console.log("Details:", deliveryDetails);

    // **Add the delivery to Firestore**
    if (barangay && deliveryDate && deliveryDetails) {
        // Get the reference to Firestore collection
        const deliveriesRef = collection(db, "deliveries");

        // Create a new document for the delivery
        addDoc(deliveriesRef, {
            barangay: barangay, // ✅ keep this
            deliveryDate: new Date(deliveryDate), // ✅ this fixes the problem!
            details: deliveryDetails,
            status: "Pending",
            timestamp: new Date()
        })       
        .then(() => {
            // Successfully added the document
            console.log("Delivery scheduled successfully!");

            // Optionally show a success message in the UI
            document.getElementById("successMessage").innerText = "Delivery scheduled successfully!";
            document.getElementById("successMessage").classList.remove("hidden");

            // Optionally reset the form (if needed)
            document.getElementById("scheduleDeliveryForm").reset();
        })
        .catch((error) => {
            console.error("Error scheduling delivery:", error);
            showError("Failed to schedule delivery. Please try again.");
        });
    } else {
        showError("All fields are required!");
    }
}


// Global variable to store all deliveries for filtering
let allDeliveries = [];

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
        
        // Barangay with enhanced styling
        const tdBarangay = document.createElement("td");
        tdBarangay.innerHTML = `
            <div class="barangay-cell">
                <span class="barangay-icon">🏘️</span>
                <span class="barangay-name">${delivery.barangay}</span>
            </div>
        `;
        row.appendChild(tdBarangay);

        // Delivery Date with enhanced styling
        const tdDate = document.createElement("td");
        const deliveryDate = delivery.deliveryDate;
        const dateText = deliveryDate ? deliveryDate.toLocaleDateString() : "No Date";
        const dateClass = deliveryDate && deliveryDate < new Date() ? "past-date" : "future-date";
        tdDate.innerHTML = `
            <div class="date-cell ${dateClass}">
                <span class="date-icon">📅</span>
                <span class="date-text">${dateText}</span>
            </div>
        `;
        row.appendChild(tdDate);

        // Details with enhanced styling
        const tdDetails = document.createElement("td");
        tdDetails.innerHTML = `
            <div class="details-cell">
                <span class="details-icon">📝</span>
                <span class="details-text">${delivery.details}</span>
            </div>
        `;
        row.appendChild(tdDetails);

        // Status with enhanced styling
        const tdStatus = document.createElement("td");
        const statusClass = getStatusClass(delivery.status);
        tdStatus.innerHTML = `
            <div class="status-cell">
                <span class="status-badge ${statusClass}">
                    <span class="status-icon">${getStatusIcon(delivery.status)}</span>
                    <span class="status-text">${delivery.status}</span>
                </span>
            </div>
        `;
        row.appendChild(tdStatus);

        // Action with enhanced styling
        const tdAction = document.createElement("td");
        tdAction.innerHTML = `
            <div class="action-cell">
                <button class="delete-btn" onclick="deleteDelivery('${delivery.id}')">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Delete</span>
                </button>
            </div>
        `;
        row.appendChild(tdAction);

        tableBody.appendChild(row);
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
    if (confirm("Are you sure you want to delete this delivery?")) {
        try {
            await deleteDoc(doc(db, "deliveries", deliveryId));
            showSuccess("Delivery deleted successfully!");
        } catch (error) {
            console.error("Error deleting delivery:", error);
            showError("Failed to delete delivery. Please try again.");
        }
    }
}

// Expose functions globally
window.clearDeliveryFilters = clearDeliveryFilters;
window.deleteDelivery = deleteDelivery;
window.closeViewResidentsModal = closeViewResidentsModal;



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

    snapshot.forEach(docSnap => {
        const resident = docSnap.data();
        
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
        
        const row = `
            <tr>
                <td>${resident.name}</td>
                <td>${resident.age}</td>
                <td>${resident.addressZone}</td>
                <td>${resident.householdNumber}</td>
                <td>${resident.familyMembers}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${resident.monthlyIncome ?? ''}</td>
                <td>${resident.aidHistory ?? ''}</td>
                <td>${resident.evacueeHistory ?? ''}</td>
                <td>
                    <button class="edit-btn" data-id="${docSnap.id}">Edit</button>
                    <button class="delete-btn" data-id="${docSnap.id}">Delete</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
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
    const familyMembersInput = document.getElementById("familyMembers");
    const evacueeHistoryInput = document.getElementById("evacueeHistory");
    const studentCheckbox = document.getElementById("student");
    const workingCheckbox = document.getElementById("working");
    const monthlyIncomeInput = document.getElementById("monthlyIncome");

    if (!nameInput || !ageInput || !addressZoneInput || !householdNumberInput || !familyMembersInput || !evacueeHistoryInput || !studentCheckbox || !workingCheckbox || !monthlyIncomeInput) {
        console.error("❌ Missing form fields!");
        alert("Form is incomplete. Please refresh the page.");
        submitButton.disabled = false;
        return;
    }

    const residentData = {
        name: nameInput.value,
        age: ageInput.value,
        addressZone: addressZoneInput.value,
        householdNumber: householdNumberInput.value,
        barangay: currentBarangay,
        isStudent: studentCheckbox.checked,
        isWorking: workingCheckbox.checked,
        monthlyIncome: workingCheckbox.checked ? monthlyIncomeInput.value : null,
        familyMembers: familyMembersInput.value,
        aidHistory: document.getElementById("aidHistory").value,
        evacueeHistory: evacueeHistoryInput.value,
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
        
        await updateDoc(doc(db, "residents", docId), {
            name: document.getElementById("editName").value,
            age: Number(document.getElementById("editAge").value),
            addressZone: document.getElementById("editAddressZone").value,
            householdNumber: String(document.getElementById("editHouseholdNumber").value),
            familyMembers: Number(document.getElementById("editFamilyMembers").value),
            monthlyIncome: isWorking && !isStudent ? 
                (document.getElementById("editMonthlyIncome").value === "" ? null : Number(document.getElementById("editMonthlyIncome").value))
                : null,
            aidHistory: document.getElementById("editAidHistory").value,
            evacueeHistory: Number(document.getElementById("editEvacueeHistory").value),
            isStudent: isStudent,
            isWorking: isWorking,
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
        // Bring section into view
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
    }

    // Barangay Delivery Status
    if (sectionId === "deliveryStatus" && loggedInUserData?.role === "barangay") {
        if (typeof loadBarangayDeliveries === "function") loadBarangayDeliveries(loggedInUserData.username);
    }

    // Statistics
    if (sectionId === "statistics") {
        if (loggedInUserData?.role === "mswd") {
            document.getElementById("mswdStatisticsContainer").classList.remove("hidden");
            document.getElementById("barangayStatisticsContainer").classList.add("hidden");
            if (typeof window.loadBarangayPriorityChart === "function") {
                window.loadBarangayPriorityChart(db, getDocs, collection);
            }
        } else if (loggedInUserData?.role === "barangay") {
            document.getElementById("mswdStatisticsContainer").classList.add("hidden");
            document.getElementById("barangayStatisticsContainer").classList.remove("hidden");
            const barangayName = loggedInUserData.username.replace("barangay_", "");
            if (typeof window.loadResidentPriorityChart === "function") {
                window.loadResidentPriorityChart(db, getDocs, collection, query, where, barangayName);
            }
        }
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_) {}
    }
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
            let userFriendlyMessage = "Failed to update password. Please try again.";
            
            // Handle specific Firebase error codes with user-friendly messages
            if (err.code === 'auth/wrong-password') {
                userFriendlyMessage = "Current password is incorrect. Please try again.";
            } else if (err.code === 'auth/weak-password') {
                userFriendlyMessage = "New password is too weak. Please choose a stronger password.";
            } else if (err.code === 'auth/requires-recent-login') {
                userFriendlyMessage = "For security reasons, please log out and log back in before changing your password.";
            } else if (err.code === 'auth/too-many-requests') {
                userFriendlyMessage = "Too many failed attempts. Please wait a moment and try again.";
            } else if (err.code === 'auth/network-request-failed') {
                userFriendlyMessage = "Network error. Please check your connection and try again.";
            }
            
            showError(userFriendlyMessage);
        }
    });
})();




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
    document.getElementById("editFamilyMembers").value = r.familyMembers || "";
    document.getElementById("editMonthlyIncome").value = r.monthlyIncome ?? "";
    document.getElementById("editAidHistory").value = r.aidHistory || "";
    document.getElementById("editEvacueeHistory").value = r.evacueeHistory || "";
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

// ✅ Add missing functions for account requests
async function approveRequest(requestId, barangayName) {
    try {
        const requestRef = doc(db, "accountRequests", requestId);
        await updateDoc(requestRef, {
            status: 'approved',
            approvedAt: new Date()
        });
        
        // Create user account for the approved barangay
        const email = `${barangayName}@example.com`;
        const password = 'default123'; // Default password
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await createUserInFirestore(userCredential.user.uid, `barangay_${barangayName}`, email, 'barangay');
            showSuccess(`Account approved for ${barangayName}. Default password: ${password}`);
        } catch (userError) {
            console.error("Error creating user account:", userError);
            showError("Account approved but user creation failed. Please contact support.");
        }
        
        // Refresh the requests list
        loadPendingRequests();
    } catch (error) {
        console.error("Error approving request:", error);
        showError("Failed to approve request. Please try again.");
    }
}

async function declineRequest(requestId) {
    try {
        const requestRef = doc(db, "accountRequests", requestId);
        await updateDoc(requestRef, {
            status: 'declined',
            declinedAt: new Date()
        });
        
        showSuccess("Request declined successfully.");
        
        // Refresh the requests list
        loadPendingRequests();
    } catch (error) {
        console.error("Error declining request:", error);
        showError("Failed to decline request. Please try again.");
    }
}

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
        
        snapshot.forEach((docSnap) => {
            const resident = docSnap.data();
            const row = document.createElement("tr");
            row.className = "resident-row";
            
            // Determine status and status class
            let status = "None";
            let statusClass = "status-none";
            
            if (resident.isStudent && resident.isWorking) {
                status = "Student & Working";
                statusClass = "status-both";
            } else if (resident.isStudent) {
                status = "Student";
                statusClass = "status-student";
            } else if (resident.isWorking) {
                status = "Working";
                statusClass = "status-working";
            }
            
            row.innerHTML = `
                <td>
                    <div class="resident-name">
                        <span class="name-text">${resident.name || 'No Name'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-age">
                        <span class="age-text">${resident.age || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-zone">
                        <span class="zone-text">${resident.addressZone || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-household">
                        <span class="household-text">${resident.householdNumber || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-family">
                        <span class="family-text">${resident.familyMembers || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-income">
                        <span class="income-text">${resident.monthlyIncome ? '₱' + resident.monthlyIncome.toLocaleString() : 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-aid">
                        <span class="aid-text">${resident.aidHistory || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-evac">
                        <span class="evac-text">${resident.evacueeHistory || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <div class="resident-status">
                        <span class="status-badge ${statusClass}">
                            <span class="status-text">${status}</span>
                        </span>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Setup search functionality
        setupResidentSearch();
        
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
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
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
        
        const tableBody = document.getElementById("accountRequestsTableBody");
        if (!tableBody) {
            console.warn("Account requests table body not found");
            return;
        }
        
        tableBody.innerHTML = "";
        
        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;">No pending requests.</td>
                </tr>`;
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const req = docSnap.data();
            const row = document.createElement("tr");
            
            row.innerHTML = `
                <td>${req.barangayName || 'Unknown'}</td>
                <td>${req.email || 'No email'}</td>
                <td>${req.message || 'No message'}</td>
                <td>
                    <button onclick="approveRequest('${docSnap.id}', '${req.barangayName}')">Approve</button>
                    <button onclick="declineRequest('${docSnap.id}')">Decline</button>
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

// Close edit resident modal
function closeEditResidentModal() {
    const modal = document.getElementById("editResidentModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
    }
}

window.closeEditResidentModal = closeEditResidentModal;

