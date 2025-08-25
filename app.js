
function showSuccess(msg) {
    openMessageModal("Success", msg, "green");
}

function showError(msg) {
    openMessageModal("Error", msg, "red");
}

function openMessageModal(title, msg, color) {
    const modal = document.getElementById("messageModal");
    if (!modal) { alert(msg); return; }
    document.getElementById("messageTitle").innerText = title;
    document.getElementById("messageTitle").style.color = color;
    document.getElementById("messageText").innerText = msg;
    modal.classList.remove("hidden");
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
        showError("Invalid login: " + error.message);
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


function loadAllDeliveriesForAdmin() {
    const tableBody = document.getElementById("adminDeliveriesTableBody");
    if (!tableBody) {
        console.warn("[Admin Deliveries] Table body not found.");
        return;
    }

    const deliveriesRef = collection(db, "deliveries");

    onSnapshot(deliveriesRef, (snapshot) => {
        console.log("[Admin Deliveries] Snapshot size:", snapshot.size);  // 👈 NEW DEBUG
        tableBody.innerHTML = "";

        if (snapshot.empty) {
            console.log("[Admin Deliveries] No documents found");  // 👈 NEW DEBUG
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">No deliveries scheduled yet.</td>
                </tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const delivery = docSnap.data();
            console.log("[Admin Deliveries] Delivery:", docSnap.id, delivery); // 👈 NEW DEBUG

            const row = document.createElement("tr");

            // Barangay
            const tdBarangay = document.createElement("td");
            tdBarangay.textContent = delivery.barangay
                ? delivery.barangay.replace("barangay_", "")
                : "Unknown";
            row.appendChild(tdBarangay);

            // Delivery Date
            const tdDate = document.createElement("td");
            const deliveryDate = delivery.deliveryDate?.toDate?.();
            tdDate.textContent = deliveryDate
                ? deliveryDate.toLocaleDateString()
                : "No Date";
            row.appendChild(tdDate);

            // Details
            const tdDetails = document.createElement("td");
            tdDetails.textContent = delivery.details || "No Details";
            row.appendChild(tdDetails);

            // Status
            const tdStatus = document.createElement("td");
            tdStatus.textContent = delivery.status || "Pending";
            row.appendChild(tdStatus);

            // Action (Delete button)
            const tdAction = document.createElement("td");
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete";
            deleteBtn.onclick = async () => {
                await deleteDoc(doc(db, "deliveries", docSnap.id));
                console.log("[Admin Deliveries] Deleted:", docSnap.id); // 👈 NEW DEBUG
            };
            tdAction.appendChild(deleteBtn);
            row.appendChild(tdAction);

            tableBody.appendChild(row);
        });
    });
}



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
    document.getElementById("addResidentModal").style.display = "block";

    // 🌟 Set the barangay input automatically
    const barangayField = document.getElementById("barangay");
    if (!loggedInUserData || !loggedInUserData.username) {
        console.error("❌ User data not loaded properly!");
        alert("Please login again.");
        submitButton.disabled = false;
        return;
    }
    
    // Remove 'barangay_' prefix
    const currentBarangay = loggedInUserData.username.replace('barangay_', '');
    barangayField.value = currentBarangay; // Set the logged in Barangay automatically
}

// Close modal
function closeAddResidentModal() {
    document.getElementById("addResidentModal").style.display = "none";
}

window.loadResidentsForBarangay = async function(barangayName) {
    const tableBody = document.getElementById("residentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // clear before loading

    const q = query(collection(db, "residents"), where("barangay", "==", barangayName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        tableBody.innerHTML = "<tr><td colspan='9'>No residents found.</td></tr>";
        return;
    }

    snapshot.forEach(docSnap => {
        const resident = docSnap.data();
        const row = `
            <tr>
                <td>${resident.name}</td>
                <td>${resident.age}</td>
                <td>${resident.addressZone}</td>
                <td>${resident.householdNumber}</td>
                <td>${resident.familyMembers}</td>
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
        await updateDoc(doc(db, "residents", docId), {
            name: document.getElementById("editName").value,
            age: Number(document.getElementById("editAge").value),
            addressZone: document.getElementById("editAddressZone").value,
            householdNumber: String(document.getElementById("editHouseholdNumber").value),
            familyMembers: Number(document.getElementById("editFamilyMembers").value),
            monthlyIncome: document.getElementById("editMonthlyIncome").value === "" 
                ? null 
                : Number(document.getElementById("editMonthlyIncome").value),
            aidHistory: document.getElementById("editAidHistory").value,
            evacueeHistory: Number(document.getElementById("editEvacueeHistory").value),
            isStudent: document.getElementById("editStudent").checked,
            isWorking: document.getElementById("editWorking").checked,
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
    document.querySelectorAll('.modal').forEach(m => { m.classList.add('hidden'); m.style.display = 'none'; });

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
            showError(err.message || 'Failed to update password.');
        }
    });
})();




// ✅ Unified Toggle Income Field (works for Add + Edit)
function toggleIncomeField(prefix = "") {
  const student = document.getElementById(prefix + "Student");
  const working = document.getElementById(prefix + "Working");
  const income = document.getElementById(prefix + "MonthlyIncome");
  if (!student || !working || !income) return;
  if (working.checked && !student.checked) {
    income.disabled = false;
  } else {
    income.disabled = true;
    income.value = "";
  }
}

// Attach listeners for Add form
document.getElementById("student")?.addEventListener("change", () => toggleIncomeField(""));
document.getElementById("working")?.addEventListener("change", () => toggleIncomeField(""));

// Attach listeners for Edit form
document.getElementById("editStudent")?.addEventListener("change", () => toggleIncomeField("edit"));
document.getElementById("editWorking")?.addEventListener("change", () => toggleIncomeField("edit"));

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
    document.getElementById("editResidentModal").classList.remove("hidden");
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
