
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
    getDeliveries
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
    const raw = document.getElementById('username')?.value || '';
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, '');
    const password = document.getElementById('password')?.value;

    const barangayName = normalized.replace('barangay_', '');
    const email = `${barangayName}@example.com`;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showError(mapAuthError(error));
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
        const row = document.createElement('tr');
        const tdName = document.createElement('td');
        tdName.textContent = String(req.barangayName || '');
        const tdRole = document.createElement('td');
        tdRole.textContent = 'Barangay';
        const tdDate = document.createElement('td');
        const ts = req.timestamp && (req.timestamp.seconds ? new Date(req.timestamp.seconds * 1000) : new Date());
        tdDate.textContent = ts ? ts.toLocaleDateString() : '';
        const tdAction = document.createElement('td');
        const approveBtn = document.createElement('button');
        approveBtn.textContent = 'Approve';
        approveBtn.addEventListener('click', () => window.approveRequest(req.id, req.barangayName));
        const declineBtn = document.createElement('button');
        declineBtn.textContent = 'Decline';
        declineBtn.addEventListener('click', () => window.declineRequest(req.id));
        tdAction.appendChild(approveBtn);
        tdAction.appendChild(declineBtn);
        row.appendChild(tdName);
        row.appendChild(tdRole);
        row.appendChild(tdDate);
        row.appendChild(tdAction);
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
                    <td colspan="4" style="text-align:center;">No deliveries scheduled yet.</td>
                </tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            const row = document.createElement('tr');
            const deliveryDate = d.deliveryDate?.toDate?.();
            const dateStr = deliveryDate ? deliveryDate.toLocaleDateString() : 'No Date';
            const tds = [dateStr, d.details || '', d.status || 'Pending'];
            tds.forEach(text => { const td = document.createElement('td'); td.textContent = String(text); row.appendChild(td); });
            const tdBtn = document.createElement('td');
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
            tdBtn.appendChild(btn);
            row.appendChild(tdBtn);
            tableBody.appendChild(row);
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
    } catch (error) {
        console.error("Error updating delivery status:", error);
        showError("Failed to update delivery status. Please try again.");
    }
}

// Function to handle scheduling deliveries
async function handleScheduleDelivery() {
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
        showError("All fields are required!");
        return;
    }

    try {
        // Save delivery with goods
        await addDoc(collection(db, 'deliveries'), {
            barangay,
            deliveryDate: Timestamp.fromDate(new Date(deliveryDate)),
            details: deliveryDetails,
            goods,
            status: 'Pending',
            timestamp: serverTimestamp()
        });
        
        // NOTE: Inventory will be deducted when delivery is marked as 'Received'
        showSuccess('Delivery scheduled successfully.');
        // Reset form
        document.getElementById('deliveryForm')?.reset();
        
    } catch (error) {
        console.error('Error scheduling delivery:', error);
        showError('Failed to schedule delivery.');
        throw error; // Re-throw to be handled by the form submission
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
                ${delivery.rawData?.goods ? `<div class="goods-mini">Rice: ${delivery.rawData.goods.rice||0}, Biscuits: ${delivery.rawData.goods.biscuits||0}, Canned: ${delivery.rawData.goods.canned||0}, Shirts: ${delivery.rawData.goods.shirts||0}</div>` : ''}
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
                <button class="print-btn" onclick="printDeliveryReceipt('${delivery.id}')">
                    <span class="btn-icon">🖨️</span>
                    <span class="btn-text">Print</span>
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
window.printDeliveryReceipt = printDeliveryReceipt;
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

    // Initialize DataTable for barangay list
    try {
        if (window.jQuery && $('#residentsTable').length) {
            if ($.fn.dataTable.isDataTable('#residentsTable')) {
                $('#residentsTable').DataTable().destroy();
            }
            $('#residentsTable').DataTable({
                order: [[0, 'asc']],
                dom: 'Bfrtip',
                buttons: [
                    { extend: 'excelHtml5', title: 'Residents', exportOptions: { columns: ':not(.no-export)' } },
                    { extend: 'pdfHtml5', title: 'Residents', orientation: 'landscape', pageSize: 'A4', exportOptions: { columns: ':not(.no-export)' } },
                    { extend: 'print', title: 'Residents', customize: function (win) { try { win.document.title = 'Residents'; } catch(_) {} }, exportOptions: { columns: ':not(.no-export)' } }
                ],
                columnDefs: [ { targets: 'no-export', searchable: false, orderable: false } ],
                pageLength: 10
            });
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

// ===== Double-Click Prevention Helper =====
function addDoubleClickPrevention(button, asyncFunction, loadingText = 'Processing...') {
  let isProcessing = false;
  const originalText = button.textContent;
  const originalHTML = button.innerHTML;
  
  button.addEventListener('click', async function(e) {
    e.preventDefault();
    if (isProcessing) return;
    
    isProcessing = true;
    button.disabled = true;
    button.textContent = loadingText;
    
    try {
      await asyncFunction();
    } catch (error) {
      console.error('Button action failed:', error);
    } finally {
      setTimeout(() => {
        isProcessing = false;
        button.disabled = false;
        button.innerHTML = originalHTML;
      }, 1000);
    }
  });
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
  
  // Setup barangay delivery history button with double-click prevention
  const deliveryHistoryBtn = document.getElementById('viewDeliveryHistoryBtn');
  if (deliveryHistoryBtn) {
    addDoubleClickPrevention(deliveryHistoryBtn, showDeliveryHistory, 'Loading History...');
  }
  
  // Setup delivery form event listener with double-click prevention
  const deliveryForm = document.getElementById('deliveryForm');
  if (deliveryForm) {
    let isSubmittingDelivery = false;
    deliveryForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (isSubmittingDelivery) return;
      isSubmittingDelivery = true;
      
      const submitBtn = deliveryForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Scheduling...</span>';
      
      try {
        await handleScheduleDelivery();
      } finally {
        setTimeout(() => {
          isSubmittingDelivery = false;
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="btn-icon">🚚</span><span>Schedule Delivery</span>';
        }, 1000);
      }
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

  const win = window.open('', '_blank');
  const style = `
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color:#111; }
      h1 { font-size: 18px; margin: 0 0 8px; text-align:center; }
      .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      .chart-wrap { display:flex; justify-content:center; }
      .list-wrap table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
      th { background:#f5f5f5; }
      @page { margin: 12mm; }
      @media print { .controls { display:none } }
    </style>`;

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

  win.document.write(`<html><head><title>${title}</title>${style}</head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 200);
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

// ✅ Add missing functions for account requests
async function approveRequest(requestId, barangayName) {
    try {
        const requestRef = doc(db, "accountRequests", requestId);
        await updateDoc(requestRef, {
            status: 'approved',
            approvedAt: new Date()
        });
        
        // Create user account for the approved barangay if needed (noop if exists)
        const formatted = String(barangayName || '').toLowerCase().replace(/\s+/g, '');
        const email = `${formatted}@example.com`;
        const username = `barangay_${formatted}`;
        try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (!methods || methods.length === 0) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, 'default123');
                await createUserInFirestore(userCredential.user.uid, username, email, 'barangay');
            } else {
                await createUserInFirestore('already-in-auth', username, email, 'barangay');
            }
            showSuccess(`Account approved for ${barangayName}.`);
        } catch (userError) {
            console.error('Error creating user account:', userError);
            showError('Account approved but user creation failed.');
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
                        { extend: 'pdfHtml5', title: 'Residents', orientation: 'landscape', pageSize: 'A4', exportOptions: { columns: ':not(.no-export)' } },
                        { extend: 'print', title: 'Residents', customize: function (win) { try { win.document.title = 'Residents'; } catch(_) {} }, exportOptions: { columns: ':not(.no-export)' } }
                    ],
                    pageLength: 10
                });
                // Move DataTables buttons above the search bar
                try {
                    const wrapper = document.getElementById('viewResidentsTable').closest('.dataTables_wrapper');
                    const btns = wrapper ? wrapper.querySelector('.dt-buttons') : null;
                    const filter = wrapper ? wrapper.querySelector('.dataTables_filter') : null;
                    const searchSection = document.querySelector('#viewResidentsModal .search-section');
                    const searchBox = searchSection ? searchSection.querySelector('.search-box') : null;
                    if (btns && searchSection) {
                        if (searchBox) {
                            searchSection.insertBefore(btns, searchBox);
                        } else {
                            searchSection.insertBefore(btns, searchSection.firstChild);
                        }
                        // Layout buttons horizontally with spacing
                        btns.style.margin = '0 0 8px 0';
                        btns.style.display = 'flex';
                        btns.style.gap = '8px';
                        btns.querySelectorAll('button').forEach(b => {
                            b.style.display = 'inline-block';
                            b.style.width = 'auto';
                        });
                    }
                    // Hide DataTables' built-in search; we'll keep the custom one above
                    if (filter) { filter.style.display = 'none'; }
                } catch(_) {}
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
    }
}

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
        
        // Create summary HTML
        const summaryHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Relief Operation Summary Report</h2>
                <p><strong>Operation:</strong> ${activeBatch.name}</p>
                <p><strong>Period:</strong> ${activeBatch.periodLabel}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                
                <h3>Current Inventory</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><th>Item</th><th>Current Stock</th></tr>
                    <tr><td>Rice (sacks)</td><td>${totals.rice}</td></tr>
                    <tr><td>Biscuits (boxes)</td><td>${totals.biscuits}</td></tr>
                    <tr><td>Canned Goods (boxes)</td><td>${totals.canned}</td></tr>
                    <tr><td>Shirts (packs)</td><td>${totals.shirts}</td></tr>
                </table>
                
                <h3>Stock Received</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><th>Item</th><th>Total Received</th></tr>
                    <tr><td>Rice (sacks)</td><td>${stockIn.rice}</td></tr>
                    <tr><td>Biscuits (boxes)</td><td>${stockIn.biscuits}</td></tr>
                    <tr><td>Canned Goods (boxes)</td><td>${stockIn.canned}</td></tr>
                    <tr><td>Shirts (packs)</td><td>${stockIn.shirts}</td></tr>
                </table>
                
                <h3>Deliveries Made</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><th>Item</th><th>Total Delivered</th></tr>
                    <tr><td>Rice (sacks)</td><td>${deliveries.rice}</td></tr>
                    <tr><td>Biscuits (boxes)</td><td>${deliveries.biscuits}</td></tr>
                    <tr><td>Canned Goods (boxes)</td><td>${deliveries.canned}</td></tr>
                    <tr><td>Shirts (packs)</td><td>${deliveries.shirts}</td></tr>
                </table>
                
                <p><em>Total Transactions: ${logs.length}</em></p>
            </div>
        `;
        
        // Open in new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(summaryHtml);
        printWindow.document.close();
        printWindow.print();
        
    } catch (error) {
        console.error('Error generating summary report:', error);
        showError('Failed to generate summary report.');
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
        if (!modal) return;
        
        // Get all deliveries for this barangay
        const deliveries = await getDeliveries(loggedInUserData.username);
        const historyBody = document.getElementById('deliveryHistoryBody');
        if (!historyBody) return;
        
        // Clear existing data
        historyBody.innerHTML = '';
        
        if (deliveries.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No delivery history found.</td></tr>';
        } else {
            // Filter for received/completed deliveries
            const completedDeliveries = deliveries.filter(d => d.status === 'Received' || d.status === 'Delivered');
            
            if (completedDeliveries.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No completed deliveries yet.</td></tr>';
            } else {
                completedDeliveries.forEach(delivery => {
                    const row = document.createElement('tr');
                    const deliveryDate = delivery.deliveryDate?.toDate ? delivery.deliveryDate.toDate() : new Date();
                    const updatedAt = delivery.updatedAt || new Date();
                    
                    // Format items received
                    let itemsReceived = 'N/A';
                    if (delivery.goods) {
                        const items = [];
                        if (delivery.goods.rice) items.push(`Rice: ${delivery.goods.rice}`);
                        if (delivery.goods.biscuits) items.push(`Biscuits: ${delivery.goods.biscuits}`);
                        if (delivery.goods.canned) items.push(`Canned: ${delivery.goods.canned}`);
                        if (delivery.goods.shirts) items.push(`Shirts: ${delivery.goods.shirts}`);
                        itemsReceived = items.join(', ');
                    }
                    
                    row.innerHTML = `
                        <td>${deliveryDate.toLocaleDateString()}</td>
                        <td>${delivery.details || 'No details'}</td>
                        <td>${itemsReceived}</td>
                        <td><span class="status-badge status-${delivery.status?.toLowerCase()}">${delivery.status}</span></td>
                        <td>${updatedAt.toLocaleDateString()}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }
        }
        
        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error loading delivery history:', error);
        showError('Failed to load delivery history.');
    }
}

// Expose functions globally
window.showInventoryHistory = showInventoryHistory;
window.showNewBatchModal = showNewBatchModal;
window.generateSummaryReport = generateSummaryReport;
window.showDeliveryHistory = showDeliveryHistory;
window.handleScheduleDelivery = handleScheduleDelivery;
window.updateDeliveryStatus = updateDeliveryStatus;

