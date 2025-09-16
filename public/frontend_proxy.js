// ---- Dynamic Backend URL Configuration ----
// To make the app portable, we dynamically construct the backend URL based on the current frontend URL.
// This is crucial for environments like Firebase Studio where the domain is auto-generated.
let backendUrl;
try {
    // Get the current URL of the frontend (e.g., https://9002-....cloudworkstations.dev)
    const frontendUrl = new URL(window.location.href);

    // In Firebase Studio, the hostname contains the port. Replace the frontend port with the backend port.
    const newHostname = frontendUrl.hostname.replace(/\d+/, '3000');
    
    // Construct the new URL. The origin is composed of protocol, hostname, and port.
    backendUrl = `https://${newHostname}`;

    console.log(`Backend URL dynamically set to: ${backendUrl}`);
} catch (error) {
    // Fallback for safety, though this should not fail in a browser environment.
    console.error("Could not dynamically set backend URL, falling back to localhost.", error);
    backendUrl = "http://localhost:3000";
}
// ---- End of Dynamic URL Configuration ----
console.log("----------GF Frontend Proxy----------");

let proxy_sessionUID = null;
let loginInProgress = false;
let backoffDelay = 10000; // start with 10s
const maxBackoff = 60000; // cap at 1 minute
let backoffTimer = null;
let selectedDiaryUid = null;
let selectedEntityUid = null;

// --- Global Caches ---
let diaryDataCache = [];
let patientsCache = [];
let bookingTypesCache = [];
let bookingStatusMap = {};

// --- Helper Functions ---

// Populates the diary dropdown from the cache
function populateDiaryDropdown() {
    const select = document.getElementById("proxy-user");
    const previouslySelected = select.value;
    select.innerHTML = "";

    diaryDataCache.forEach(entry => {
        const option = document.createElement("option");
        option.value = entry.uid;
        option.textContent = entry.name;
        select.appendChild(option);
    });

    // Re-select the previous diary if it still exists in the list
    if (diaryDataCache.some(d => d.uid == previouslySelected)) { // Use loose equality
        select.value = previouslySelected;
    } else if (diaryDataCache.length > 0) {
        // Otherwise, default to the first diary in the list
        select.value = diaryDataCache[0].uid;
    }
    
    // Trigger the change handler to update other parts of the UI
    handleDiarySelectionChange();
}

// Handles the logic when a new diary is selected from the dropdown
function handleDiarySelectionChange() {
    const select = document.getElementById("proxy-user");
    selectedDiaryUid = select.value;
    // Find the selected diary in the cache, using loose equality to match string/number IDs
    const selectedDiary = diaryDataCache.find(d => d.uid == selectedDiaryUid);

    if (selectedDiary) {
        selectedEntityUid = selectedDiary.entity_uid;
        console.log("Diary selection changed. New Diary UID:", selectedDiaryUid, "Entity UID:", selectedEntityUid);
        // When diary changes, we must refetch statuses and bookings
        getBookingStatus(); 
        getBookings();
    }
}


// --- API Functions ---

// Login through the backend proxy
async function login() {
    console.log("Starting login...");
    const res = await fetch(`${backendUrl}/login`, {
        method: "POST",
        credentials: "include"
    });
    const data = await res.json();
    console.log("Login response:", data);
    // This function NO LONGER sets the global session UID.
    // It only returns the result of the API call.
    return data;
}

// Fetch diary collection via backend proxy
async function getDiary() {
    if (!proxy_sessionUID) {
        console.error("Not logged in, cannot get diary.");
        return;
    }

    console.log("Fetching diary via backend proxy...");
    const res = await fetch(`${backendUrl}/diary`, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();
    console.log("Diary response:", data);

    if (data && data.data) {
        diaryDataCache = data.data; // Update cache
        populateDiaryDropdown();   // Update UI from cache
    }

    return data;
}

// Fetch booking_status collection via backend proxy
async function getBookingStatus() {
    if (!proxy_sessionUID) {
        console.error("Not logged in!");
        return;
    }
    if (!selectedDiaryUid || !selectedEntityUid) {
        console.error("Diary UID or Entity UID missing!");
        return;
    }

    console.log("Fetching booking_statuses via backend proxy...");
    const res = await fetch(
        `${backendUrl}/booking_statuses?diary_uid=${selectedDiaryUid}&entity_uid=${selectedEntityUid}`,
        {
            method: "GET",
            credentials: "include"
        }
    );

    const data = await res.json();
    console.log("Booking Status response:", data);

    if (data && data.data) {
        bookingStatusMap = {};
        data.data.forEach(status => {
            bookingStatusMap[status.uid] = status.name;
        });
        console.log("Booking Status Map:", bookingStatusMap);
    }

    return data;
}

// Render bookings table HTML
function renderBookingsTable(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return "<p>No bookings found for this date.</p>";
    }

    let html = `
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Surname</th>
                    <th>Name</th>
                    <th>Cancelled</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const row of data) {
        const statusName =
            row.booking_status_uid && bookingStatusMap[row.booking_status_uid]
                ? bookingStatusMap[row.booking_status_uid]
                : "Unknown";

        html += `
            <tr 
                data-booking-uid="${row.uid}" 
                data-patient-uid="${row.patient_uid || ""}" 
                data-start-time="${row.start_time || ""}"
                data-duration="${row.duration || ""}"
                data-reason="${row.reason || ""}"
                data-type-uid="${row.booking_type_uid || ""}"
                data-status-uid="${row.booking_status_uid || ""}"
            >
                <td>${row.time_pretty || ""}</td>
                <td>${statusName}</td>
                <td>${row.patient_surname ?? ""}</td>
                <td>${row.patient_name ?? ""}</td>
                <td>${row.cancelled ? "Cancelled" : ""}</td>
                <td>
                    <button type="button" class="edit-booking-btn">Edit</button>
                    <button type="button" class="delete-booking-btn">Delete</button>
                </td>
            </tr>
        `;
    }

    html += "</tbody></table>";
    return html;
}

// Attach edit button listeners after rendering table
function attachEditBookingListeners() {
    const buttons = document.querySelectorAll(".edit-booking-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const tr = e.target.closest("tr");
            if (!tr) return;

            // Grab dataset values
            const bookingUID = tr.dataset.bookingUid;
            const patientUID = tr.dataset.patientUid;
            const duration   = tr.dataset.duration || 15;
            const reason     = tr.dataset.reason || "Updated Consultation";
            const startTime  = tr.dataset.startTime || "";
            const typeUID    = tr.dataset.typeUid || "";
            const statusUID  = tr.dataset.statusUid || "";

            // Split date/time
            let datePart = "", timePart = "";
            if (startTime.includes("T")) {
                [datePart, timePart] = startTime.split("T");
            } else if (startTime.includes(" ")) {
                [datePart, timePart] = startTime.split(" ");
            } else {
                timePart = startTime;
            }

            // Fill modal fields
            document.getElementById("modal-date").value =
                datePart || new Date().toISOString().split("T")[0];
            document.getElementById("modal-time").value =
                timePart ? timePart.slice(0, 5) : "09:00";
            document.getElementById("modal-duration").value = duration;
            document.getElementById("modal-reason").value   = reason;

            // Populate selects
            await loadPatients(patientUID);
            await loadBookingTypes(typeUID);
            await loadStatuses(statusUID);

            document.getElementById("modal-patient").value = patientUID || "";
            document.getElementById("modal-booking-type").value = typeUID || "";
            document.getElementById("modal-status").value = statusUID || "";

            // Store UID for update
            document.getElementById("add-booking-form").dataset.bookingUid = bookingUID;

            // Show modal
            document.getElementById("add-booking-modal").style.display = "flex";
        });
    });
}

// Attach delete button listeners after rendering table
function attachDeleteBookingListeners() {
    const buttons = document.querySelectorAll(".delete-booking-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const tr = e.target.closest("tr");
            if (!tr) return;

            const bookingUID = tr.dataset.bookingUid;
            if (!bookingUID) {
                console.error("No booking UID found for deletion");
                return;
            }

            const confirmDelete = confirm("Are you sure you want to delete (cancel) this booking?");
            if (!confirmDelete) return;

            try {
                const res = await fetch(`${backendUrl}/booking/${bookingUID}`, {
                    method: "DELETE",
                    credentials: "include"
                });

                const data = await res.json();

                if (res.ok && data.status === "OK") {
                    alert("Booking successfully cancelled!");
                    getBookings(); // refresh table
                } else {
                    alert("Failed to cancel booking: " + (data.error || JSON.stringify(data)));
                }
            } catch (err) {
                console.error("Error deleting booking:", err);
                alert("An error occurred while cancelling the booking.");
            }
        });
    });
}

// Fetch bookings for selected diary + date
async function getBookings() {
    if (!selectedDiaryUid) {
        // This is normal on first load, so we don't show an alert
        console.log("No diary selected, cannot fetch bookings.");
        return;
    }

    const dateInput = document.getElementById("proxy-date");
    const dateValue = dateInput.value;

    if (!dateValue) {
        alert("Please select a date.");
        return;
    }

    console.log("Fetching bookings via backend proxy...");
    const url = `${backendUrl}/bookings?diary_uid=${selectedDiaryUid}&date=${dateValue}`;
    const res = await fetch(url, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();
    console.log("Bookings response:", data);

    if (Array.isArray(data.data) && data.data.length > 0) {
        document.getElementById("proxy-results").innerHTML = renderBookingsTable(data.data);
        attachEditBookingListeners();
        attachDeleteBookingListeners();
    } else {
        document.getElementById("proxy-results").innerHTML =
            "<p>No bookings found for the selected date.</p>";
    }
}

// Load booking types into modal select (with optional preselect)
async function loadBookingTypes(selectedUID = "") {
    const res = await fetch(
        `${backendUrl}/booking_types?diary_uid=${selectedDiaryUid}&entity_uid=${selectedEntityUid}`, 
        { method: "GET", credentials: "include" }
    );
    const data = await res.json();
    bookingTypesCache = data.data || [];

    const select = document.getElementById("modal-booking-type");
    select.innerHTML = "";
    bookingTypesCache.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type.uid;
        opt.textContent = type.name;
        select.appendChild(opt);
    });

    if (selectedUID) {
        select.value = selectedUID;
    }
}

// Load patients into modal select (with optional preselect)
async function loadPatients(selectedUID = "") {
    const res = await fetch(
        `${backendUrl}/patients?entity_uid=${selectedEntityUid}`, 
        { method: "GET", credentials: "include" }
    );
    const data = await res.json();
    patientsCache = data.data || [];

    const select = document.getElementById("modal-patient");
    select.innerHTML = "";
    patientsCache.forEach(patient => {
        const opt = document.createElement("option");
        opt.value = patient.uid;
        opt.textContent = `${patient.surname}, ${patient.name}`;
        select.appendChild(opt);
    });

    if (selectedUID) {
        select.value = selectedUID;
    }
}

// Load booking statuses into modal select
function loadStatuses(statusUID = "") {
    const sel = document.getElementById("modal-status");
    sel.innerHTML = "";
    Object.entries(bookingStatusMap).forEach(([uid, name]) => {
        const opt = document.createElement("option");
        opt.value = uid;
        opt.textContent = name;
        sel.appendChild(opt);
    });
    if (statusUID) sel.value = statusUID;
}

// Open add booking modal form
function openAddBookingModal() {
    const proxyDateInput = document.getElementById("proxy-date");
    const modalDateInput = document.getElementById("modal-date");
    if (proxyDateInput && modalDateInput) {
        modalDateInput.value = proxyDateInput.value;
    }

    document.getElementById("add-booking-modal").style.display = "flex";
    loadBookingTypes();
    loadPatients();
    loadStatuses();
}

// Utility: validate booking form
function validateBookingForm() {
    const duration = document.getElementById("modal-duration").value.trim();
    const reason = document.getElementById("modal-reason").value.trim();

    const durationInt = parseInt(duration, 10);
    if (isNaN(durationInt) || durationInt < 1 || durationInt > 100) {
        alert("Duration must be a number between 1 and 100.");
        return false;
    }

    const reasonRegex = /^[a-zA-Z0-9 .,]+$/;
    if (!reasonRegex.test(reason)) {
        alert("Reason may only contain letters, numbers, spaces, commas, and full stops.");
        return false;
    }

    return true;
}

// Close add booking modal form
function closeAddBookingModal() {
    document.getElementById("add-booking-modal").style.display = "none";
}

// Check if the proxy tab is currently active
function isProxyTabActive() {
    const proxyTabContent = document.getElementById("frontend-proxy");
    return proxyTabContent && proxyTabContent.classList.contains("active");
}

// --- Session Management ---

// Main session-checking logic
async function checkSession() {
    if (!isProxyTabActive()) {
        // console.log("checkSession: skipped, proxy tab not active");
        return;
    }

    if (proxy_sessionUID) {
        // console.log("checkSession: session already present:", proxy_sessionUID);
        resetBackoff();
        return true;
    }

    if (loginInProgress) {
        console.log("checkSession: login already in progress, skipping.");
        return false;
    }

    console.log("checkSession: no session found — running login()");
    loginInProgress = true;

    try {
        const loginResult = await login();
        if (loginResult && loginResult.success && loginResult.session_UID) {
            // **REFACTORED LOGIC**
            // 1. Set the session UID
            proxy_sessionUID = loginResult.session_UID;
            console.log("checkSession: login succeeded, UID stored:", proxy_sessionUID);
            
            resetBackoff();
            
            // 2. NOW, fetch the diary data
            await getDiary();
            
            return true;
        } else {
            console.warn("checkSession: login failed, scheduling retry");
            scheduleBackoff();
            return false;
        }
    } catch (err) {
        console.error("checkSession: login() error:", err);
        scheduleBackoff();
        return false;
    } finally {
        loginInProgress = false;
    }
}

// Exponential backoff helpers for retrying login
function scheduleBackoff() {
    if (backoffTimer) return;

    console.log(`checkSession: retry in ${backoffDelay / 1000}s...`);
    backoffTimer = setTimeout(async () => {
        backoffTimer = null;
        backoffDelay = Math.min(backoffDelay * 2, maxBackoff);
        await checkSession();
    }, backoffDelay);
}

function resetBackoff() {
    backoffDelay = 5000;
    if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
    }
}

// --- Page Initialization and Event Listeners ---

// Attach event listeners that should only be set once
function initializeEventListeners() {
    // Diary selection
    document.getElementById("proxy-user").addEventListener("change", handleDiarySelectionChange);

    // Get Bookings button
    const getBtn = document.getElementById("proxy-get-bookings");
    if (getBtn) {
        getBtn.addEventListener("click", getBookings);
    }

    // Modal form submission (for add/update)
    document.getElementById("add-booking-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!validateBookingForm()) return;

        const bookingUID = e.target.dataset.bookingUid;
        const bookingData = {
            model: {
                uid: bookingUID || null,
                diary_uid: parseInt(selectedDiaryUid, 10),
                booking_type_uid: parseInt(document.getElementById("modal-booking-type").value, 10),
                booking_status_uid: parseInt(document.getElementById("modal-status").value, 10),
                start_time: `${document.getElementById("modal-date").value}T${document.getElementById("modal-time").value}:00`,
                duration: parseInt(document.getElementById("modal-duration").value, 10),
                patient_uid: parseInt(document.getElementById("modal-patient").value, 10),
                reason: document.getElementById("modal-reason").value,
                cancelled: false
            }
        };

        // Only include entity_uid for NEW bookings
        if (!bookingUID) {
            bookingData.model.entity_uid = parseInt(selectedEntityUid, 10);
        }

        const url = bookingUID ? `${backendUrl}/booking/${bookingUID}` : `${backendUrl}/add_booking`;
        const method = bookingUID ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bookingData),
                credentials: "include"
            });
            const data = await res.json();

            if (data.status && data.status.startsWith("ACTION_NOT_SUPPORTED")) {
                alert("Booking update is not supported for this entry.");
            } else if (data && data.status === "OK" && data.data) {
                alert(bookingUID ? "Booking updated!" : "Booking added!");
                closeAddBookingModal();
                getBookings();
                e.target.dataset.bookingUid = "";
            } else {
                alert("Failed to add/update booking: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("Booking submission failed:", err);
            alert("Failed to communicate with backend. Check console.");
        }
    });

    // Session checking timers and tab-click triggers
    setInterval(() => {
        checkSession().catch(err => console.error("Periodic checkSession error:", err));
    }, 10000);

    const proxyTab = document.querySelector('.tab[data-target="frontend-proxy"]');
    if (proxyTab) {
        proxyTab.addEventListener('click', () => {
            console.log("Proxy tab selected — ensuring session...");
            checkSession().catch(err => console.error("Tab-triggered checkSession error:", err));
        });
    }
}

// --- Main Application Start ---

// IIFE to run on script load
(async () => {
    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    const proxyDateInput = document.getElementById("proxy-date");
    if (proxyDateInput) {
        proxyDateInput.value = today;
    }
    
    // Attach all persistent event listeners
    initializeEventListeners();
    
    // Kick off the initial session check
    await checkSession();
})();
