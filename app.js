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
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    createUserInFirestore,
    fetchSignInMethodsForEmail,
    addResidentToFirestore
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
    loadAllDeliveriesForAdmin(); // 🟢 Load deliveries for admin
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
    } else if (userData.role === 'barangay') {
        document.querySelectorAll('.barangay-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.mswd-only').forEach(el => el.style.display = 'none');

        loadBarangayDeliveries(userData.username); 
        
        const barangayName = userData.username.replace('barangay_', '');
        loadResidentsForBarangay(barangayName); // 🔥 Automatic load residents pag login
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
function showError(msg) { alert(msg); }

window.logout = function () { auth.signOut(); location.reload(); };

// ✅ Example kung may Change Password ka (Optional)
window.showChangePassword = function () {
    alert("Change Password feature soon!"); // Placeholder, palitan mo nalang
};

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
                    <td><button onclick="viewBarangay('${docSnap.id}', '${barangayName}')">View</button></td>
                </tr>`;
                tableBody.innerHTML += row;
            }
        }
    });
}

// ✅ Handle Viewing Barangay Residents
// ✅ View Residents Modal with Search Filter
window.viewBarangay = async function (barangayId, barangayName) {
    document.getElementById("viewResidentsModal").classList.remove("hidden");
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
            const filtered = residents.filter(r =>
                r.name.toLowerCase().includes(filter.toLowerCase()) ||
                (r.householdNumber && r.householdNumber.toString().includes(filter))
            );

            if (filtered.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='5'>No matching residents found</td></tr>";
                return;
            }

            tableBody.innerHTML = "";
            filtered.forEach((r) => {
                const row = `<tr>
                    <td>${r.name}</td>
                    <td>${r.age}</td>
                    <td>${r.addressZone}</td>
                    <td>${r.householdNumber}</td>
                    <td>${r.familyMembers}</td>
                </tr>`;
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
    document.getElementById("viewResidentsModal").classList.add("hidden");
};

// Function to schedule a delivery
async function loadBarangayDropdown() {
    const barangaySelect = document.getElementById("barangaySelect");
    if (!barangaySelect) {
        console.error("Error: barangaySelect element not found!");
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
async function loadBarangayDeliveries(barangayUsername) {
    const tableBody = document.getElementById("deliveriesTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // Clear table before inserting new rows

    const q = query(collection(db, "deliveries"), where("barangay", "==", barangayUsername));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((docSnapshot) => {
        const delivery = docSnapshot.data();
        console.log("Full delivery data:", delivery);  // To inspect the structure
        console.log("Delivery Keys:", Object.keys(delivery));  // To see all keys in the delivery object

        const row = document.createElement("tr");

        // Correctly get the delivery date from the Firestore document
        const deliveryDate = delivery.deliveryDate?.toDate?.();
        console.log("Date from Firestore:", deliveryDate);  // Should log a Date object

        const readableDate = deliveryDate ? deliveryDate.toLocaleDateString() : "No Date"; 
        const tdDate = document.createElement("td");
        tdDate.textContent = readableDate;  // Use readableDate for the display
        row.appendChild(tdDate);

        console.log("Date from Firestore:", delivery.deliveryDate);
        console.log("Full delivery data:", delivery);
        console.log("Delivery Keys:", Object.keys(delivery));


        // **Delivery Details** (Show the details of the delivery)
        const tdDetails = document.createElement("td");
        tdDetails.textContent = delivery.details || "No details";// Default if no details available
        row.appendChild(tdDetails);

        // **Status** (Keep the status as "Pending")
        const tdStatus = document.createElement("td");
        tdStatus.textContent = delivery.status || "Pending"; // Show "Pending" if no status
        row.appendChild(tdStatus);

        // **Action Button** (If not received, show "Received" button)
        const tdAction = document.createElement("td");
        if (delivery.status !== "Received") {
            const receiveButton = document.createElement("button");
            receiveButton.textContent = "Received"; // Change text to clarify action
            receiveButton.classList.add("receive-button"); // Add class for styling or visibility checks

            // Use an inline function to handle the button click and update the status
            receiveButton.addEventListener("click", async () => {
                // ✅ Disable button immediately for feedback
                receiveButton.disabled = true;
                receiveButton.textContent = "Updating...";
            
                const docRef = doc(db, "deliveries", docSnapshot.id);
            
                try {
                    await updateDoc(docRef, { status: "Received" });
                    console.log("Status successfully updated to Received.");
                    alert("Marked as received!");
                    await loadBarangayDeliveries(auth.currentUser.displayName); // ✅ Reload table
                } catch (error) {
                    console.error("Real error caught:", error);
                    showError("Error updating status.");
                }
            });

            tdAction.appendChild(receiveButton);
        } else {
            tdAction.textContent = "Received"; // If already received, just show "Received"
        }
        row.appendChild(tdAction);

        // Append the row to the table body
        tableBody.appendChild(row);
    });
}

// Function to update delivery status
async function updateDeliveryStatus(deliveryId, newStatus) {
    const deliveryRef = doc(db, "deliveries", deliveryId);
    try {
        await updateDoc(deliveryRef, { status: newStatus });
        console.log("Status updated successfully!");
        // Reload deliveries after updating
        loadBarangayDeliveries(auth.currentUser.uid);
    } catch (error) {
        console.error("Error updating status:", error);
        showError("Failed to update delivery status.");
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

async function loadAllDeliveriesForAdmin() {
    const tableBody = document.getElementById("adminDeliveriesTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // Clear table

    const deliveriesQuery = query(collection(db, "deliveries"));
    const snapshot = await getDocs(deliveriesQuery);

    // later for users
    const usersQuery = query(collection(db, "users"), where("role", "==", "barangay"));
    const querySnapshot = await getDocs(usersQuery);

    if (snapshot.empty) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No deliveries scheduled yet.</td></tr>`;
        return; // Exit kung walang data
    }

    snapshot.forEach((docSnap) => {
        const delivery = docSnap.data();
        const row = document.createElement("tr");

        // Barangay
        const tdBarangay = document.createElement("td");
        tdBarangay.textContent = delivery.barangay || "Unknown";
        row.appendChild(tdBarangay);

        // Date
        const deliveryDate = delivery.deliveryDate?.toDate?.();
        const tdDate = document.createElement("td");
        tdDate.textContent = deliveryDate ? deliveryDate.toLocaleDateString() : "No Date";
        row.appendChild(tdDate);

        // Details
        const tdDetails = document.createElement("td");
        tdDetails.textContent = delivery.details || "No Details";
        row.appendChild(tdDetails);

        // Status
        const tdStatus = document.createElement("td");
        tdStatus.textContent = delivery.status || "Pending";
        row.appendChild(tdStatus);

        // Create Action Button
        const tdAction = document.createElement("td");
        const deleteBtn = document.createElement("button"); // <-- Declare muna

        deleteBtn.textContent = "Delete";
        deleteBtn.style.backgroundColor = "#e74c3c"; 
        deleteBtn.style.color = "white";             
        deleteBtn.style.border = "none";
        deleteBtn.style.padding = "5px 10px";
        deleteBtn.style.borderRadius = "5px";
        deleteBtn.style.cursor = "pointer";

        // THEN NOW you can apply condition
        if (delivery.status === "Received") {
            deleteBtn.disabled = true;
            deleteBtn.textContent = "Completed";
            deleteBtn.style.backgroundColor = "gray";
            deleteBtn.style.cursor = "not-allowed";
        }

        // Attach Delete Function
        deleteBtn.addEventListener("click", async () => {
            const confirmDelete = confirm("Are you sure you want to delete this delivery?");
            if (!confirmDelete) return;

            try {
                await deleteDoc(doc(db, "deliveries", docSnap.id)); 
                alert("Delivery deleted successfully.");
                loadAllDeliveriesForAdmin(); 
            } catch (error) {
                console.error("❌ Failed to delete:", error);
                alert("Failed to delete delivery. Try again.");
            }
        });

        // Finally append to td
        tdAction.appendChild(deleteBtn);
        row.appendChild(tdAction);

        // Append the row to the table body
        tableBody.appendChild(row);
    });

    // Schedule Delivery form event listener
    const scheduleDeliveryForm = document.getElementById("scheduleDeliveryForm");
    if (scheduleDeliveryForm) {
        scheduleDeliveryForm.addEventListener("submit", function(event) {
            event.preventDefault();  // Prevent traditional form submission
            handleScheduleDelivery();  // Call delivery scheduling handler
        });
    }

    const barangaySelect = document.getElementById("barangaySelect");  // Assuming you have this select element
    barangaySelect.innerHTML = ""; // Clear it first!

    // Add a default option (optional)
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Barangay";
    barangaySelect.appendChild(defaultOption);

    // Fetch barangays from Firestore
    const barangayQuery = query(collection(db, "users"), where("role", "==", "barangay"));
    const barangaySnapshot = await getDocs(barangayQuery);

    barangaySnapshot.forEach((doc) => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = data.username; // Assuming 'username' is unique
        option.textContent = data.username.replace("barangay_", ""); // Remove prefix
        barangaySelect.appendChild(option);
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

// Toggle monthly income field based on "Student" or "Working" checkbox
function toggleIncomeField() {
    const isStudent = document.getElementById("student").checked;
    const isWorking = document.getElementById("working").checked;
    const monthlyIncomeField = document.getElementById("monthlyIncome");
    
    if (isStudent) {
        monthlyIncomeField.disabled = true;
    } else if (isWorking) {
        monthlyIncomeField.disabled = false;
    }
}

window.loadResidentsForBarangay = async function(barangayName) {
    const tableBody = document.getElementById("residentsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = ""; // clear muna before loading

    const q = query(collection(db, "residents"), where("barangay", "==", barangayName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        tableBody.innerHTML = "<tr><td colspan='6'>No residents found.</td></tr>";
        return;
    }

    snapshot.forEach(doc => {
        const resident = doc.data();
        const row = `
            <tr>
                <td>${resident.name}</td>
                <td>${resident.age}</td>
                <td>${resident.addressZone}</td>
                <td>${resident.householdNumber}</td>
                <td>${resident.familyMembers}</td>
                <td>
                    <button onclick="editResident('${doc.id}')">Update</button>
                    <button onclick="deleteResident('${doc.id}')">Delete</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row; // 🔥 Important part para mapakita sa table
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

window.deleteResident = async function(docId) {
    if (confirm("Are you sure you want to delete this resident?")) {
        try {
            await deleteDoc(doc(db, "residents", docId));
            alert("Resident deleted successfully!");
            loadResidentsForBarangay(auth.currentUser.displayName.replace("barangay_", "")); // Reload
        } catch (error) {
            console.error("Error deleting resident:", error);
            alert("Failed to delete resident.");
        }
    }
};

// ✅ Navigation Sections
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(sec => sec.classList.add('hidden'));
    // Show requested section
    document.getElementById(sectionId)?.classList.remove('hidden');

    // Delivery scheduling (admin only)
    if (sectionId === "deliveryScheduling") {
        loadAllDeliveriesForAdmin?.();
    }

    // Statistics logic
    if (sectionId === "statistics") {
        if (loggedInUserData?.role === 'mswd') {
            console.log("MSWD Statistics Section opened");
            document.getElementById('mswdStatisticsContainer').classList.remove('hidden');
            document.getElementById('barangayStatisticsContainer').classList.add('hidden');
            window.loadBarangayPriorityChart(db, getDocs, collection);
        } else if (loggedInUserData?.role === 'barangay') {
            const barangayName = loggedInUserData.username.replace('barangay_', '');
            console.log("Barangay Statistics Section opened for:", barangayName);
            document.getElementById('barangayStatisticsContainer').classList.remove('hidden');
            document.getElementById('mswdStatisticsContainer').classList.add('hidden');
            window.loadResidentPriorityChart(db, getDocs, collection, query, where, barangayName);
        }
    }
}

// ✅ Expose globally so HTML onclick works
window.showSection = showSection;
