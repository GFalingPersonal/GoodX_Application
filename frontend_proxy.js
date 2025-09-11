console.log("----------GF Frontend Proxy----------");

let proxy_sessionUID = null;
let selectedDiaryUid = null;
let selectedEntityUid = null;
// Global caches, it gets refreshed when we open the modal, but we cache to avoid race conditions
let patientsCache = [];
let bookingTypesCache = [];
let bookingStatusMap = {};

// Login through the backend proxy
async function login() {
    console.log("Starting login...");
    const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        credentials: "include"
    });
    const data = await res.json();
    console.log("Login response:", data);

    if (data.success && data.session_UID) {
        proxy_sessionUID = data.session_UID;
        console.log("Login successful, session UID stored:", proxy_sessionUID);
    } else {
        console.error("Login failed:", data.error);
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
        `http://localhost:3000/booking_statuses?diary_uid=${selectedDiaryUid}&entity_uid=${selectedEntityUid}`,
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
// Fetch diary collection via backend proxy
async function getDiary() {
    if (!proxy_sessionUID) {
        console.error("Not logged in!");
        return;
    }

    console.log("Fetching diary via backend proxy...");
    const res = await fetch(`http://localhost:3000/diary`, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();
    console.log("Diary response:", data);

    if (data && data.data) {
        const select = document.getElementById("proxy-user");
        select.innerHTML = "";

        data.data.forEach(entry => {
            const option = document.createElement("option");
            option.value = entry.uid;
            option.textContent = entry.name;
            select.appendChild(option);
        });

        // Default selection
        selectedDiaryUid = data.data[0].uid;
        selectedEntityUid = data.data[0].entity_uid;

        // Update on change
        select.addEventListener("change", (e) => {
            selectedDiaryUid = e.target.value;                                              // Store selected diary UID
            selectedEntityUid = data.data.find(d => d.uid === selectedDiaryUid).entity_uid; // Store selected entity UID
            console.log("Selected diary UID:", selectedDiaryUid);
            getBookingStatus();             // Fetch booking statuses for the selected diary
        });
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

            console.log("---- Edit button clicked ----");
            console.log("bookingUID:", bookingUID);
            console.log("patientUID:", patientUID);
            console.log("duration:", duration);
            console.log("reason:", reason);
            console.log("startTime:", startTime);
            console.log("typeUID:", typeUID);
            console.log("statusUID:", statusUID);

            // Split date/time
            let datePart = "", timePart = "";
            if (startTime.includes("T")) {
                [datePart, timePart] = startTime.split("T");
            } else if (startTime.includes(" ")) {
                [datePart, timePart] = startTime.split(" ");
            } else {
                timePart = startTime;
            }

            console.log("Parsed datePart:", datePart, "timePart:", timePart);

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

            console.log("Setting modal selects...");
            document.getElementById("modal-patient").value = patientUID || "";
            document.getElementById("modal-booking-type").value = typeUID || "";
            document.getElementById("modal-status").value = statusUID || "";

            // Store UID for update
            document.getElementById("add-booking-form").dataset.bookingUid = bookingUID;

            // Show modal
            document.getElementById("add-booking-modal").style.display = "flex";

            console.log("Modal populated with booking:", bookingUID);
        });
    });
}

// Attach delete button listeners after rendering table
function attachDeleteBookingListeners() {
    const buttons = document.querySelectorAll(".delete-booking-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();  // prevent default button behavior
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
                const res = await fetch(`http://localhost:3000/booking/${bookingUID}`, {
                    method: "DELETE",
                    credentials: "include"
                });

                const data = await res.json();
                console.log("Delete booking response:", data);

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
        alert("Please select a diary first.");
        return;
    }

    const dateInput = document.getElementById("proxy-date");
    const dateValue = dateInput.value;

    if (!dateValue) {
        alert("Please select a date.");
        return;
    }

    console.log("Fetching bookings via backend proxy...");
    const url = `http://localhost:3000/bookings?diary_uid=${selectedDiaryUid}&date=${dateValue}`;
    const res = await fetch(url, {
        method: "GET",
        credentials: "include"
    });

    const data = await res.json();
    console.log("Bookings response:", data);

    // Use backend return structure: { data: [...], status: "OK" }
    if (Array.isArray(data.data) && data.data.length > 0) {
        document.getElementById("proxy-results").innerHTML = renderBookingsTable(data.data);
        // Attach edit and delete listeners
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
        `http://localhost:3000/booking_types?diary_uid=${selectedDiaryUid}&entity_uid=${selectedEntityUid}`, 
        { method: "GET", credentials: "include" }
    );
    const data = await res.json();
    console.log("Booking types:", data);

    bookingTypesCache = data.data || []; // cache

    const select = document.getElementById("modal-booking-type");
    select.innerHTML = "";
    bookingTypesCache.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type.uid;
        opt.textContent = type.name;
        select.appendChild(opt);
    });

    if (selectedUID) {
        select.value = selectedUID; // set selection if provided
    }
}

// Load patients into modal select (with optional preselect)
async function loadPatients(selectedUID = "") {
    const res = await fetch(
        `http://localhost:3000/patients?entity_uid=${selectedEntityUid}`, 
        { method: "GET", credentials: "include" }
    );
    const data = await res.json();
    console.log("Patients:", data);

    patientsCache = data.data || []; // cache

    const select = document.getElementById("modal-patient");
    select.innerHTML = "";
    patientsCache.forEach(patient => {
        const opt = document.createElement("option");
        opt.value = patient.uid;
        opt.textContent = `${patient.surname}, ${patient.name}`;
        select.appendChild(opt);
    });

    if (selectedUID) {
        select.value = selectedUID; // set selection if provided
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
// Populate selects from cache
function renderPatientSelect(selectedUID = "") {
    const sel = document.getElementById("modal-patient");
    sel.innerHTML = ""; // clear
    for (const p of patientsCache) {
        const opt = document.createElement("option");
        opt.value = p.uid;
        opt.textContent = `${p.surname}, ${p.name}`;
        sel.appendChild(opt);
    }
    if (selectedUID) sel.value = selectedUID;
}

function renderBookingTypeSelect(selectedUID = "") {
    const sel = document.getElementById("modal-booking-type");
    sel.innerHTML = "";
    for (const t of bookingTypesCache) {
        const opt = document.createElement("option");
        opt.value = t.uid;
        opt.textContent = t.name;
        sel.appendChild(opt);
    }
    if (selectedUID) sel.value = selectedUID;
}

// Open add booking modal form
function openAddBookingModal() {
    // Sync date from main form to modal
    const proxyDateInput = document.getElementById("proxy-date");
    const modalDateInput = document.getElementById("modal-date");
    if (proxyDateInput && modalDateInput) {
        modalDateInput.value = proxyDateInput.value; // sync selected date
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

    // Duration must be integer between 1 and 100
    const durationInt = parseInt(duration, 10);
    if (isNaN(durationInt) || durationInt < 1 || durationInt > 100) {
        alert("Duration must be a number between 1 and 100.");
        return false;
    }

    // Reason must allow only alphanumeric + basic punctuation (. ,)
    // No brackets, no quotes
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

// The Add Booking form submission handler, also used for updates
document.getElementById("add-booking-form").addEventListener("submit", async (e) => {
    e.preventDefault(); // prevent page reload
    // Validate form
    if (!validateBookingForm()) {
        return; // stop if validation fails
    }
    // If validation passes, gather data
    const bookingUID = e.target.dataset.bookingUid; // the UID already exists when we update
    const bookingType = document.getElementById("modal-booking-type").value;
    const bookingStatus = document.getElementById("modal-status").value;
    const patient = document.getElementById("modal-patient").value;
    const date = document.getElementById("modal-date").value;
    const time = document.getElementById("modal-time").value;
    const duration = document.getElementById("modal-duration").value;
    const reason = document.getElementById("modal-reason").value;

    const start_time = `${date}T${time}:00`;

    const bookingData = {
        model: {
            uid: bookingUID,                        // important when we update
            entity_uid: selectedEntityUid,
            diary_uid: selectedDiaryUid,
            booking_type_uid: bookingType,
            booking_status_uid: bookingStatus,
            start_time,
            duration,
            patient_uid: patient,
            reason,
            cancelled: false
        }
    };

    console.log(bookingUID ? "Updating booking:" : "Adding new booking:", bookingData);
    const url = bookingUID 
        ? `http://localhost:3000/booking/${bookingUID}` // PUT
        : "http://localhost:3000/add_booking";         // POST

    const method = bookingUID ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookingData),
            credentials: "include"
        });

        const data = await res.json();
        console.log("Add booking response:", data);

        // Handle the specific "update not supported" status
        if (data.status && data.status.startsWith("ACTION_NOT_SUPPORTED")) {
            alert("Booking update is not supported for this entry.");
            console.warn("API prevented update:", data.status);
        } else if (data && data.status === "OK" && data.data) {
            alert(bookingUID ? "Booking updated!" : "Booking added!");
            closeAddBookingModal();
            getBookings(); // refresh table
            e.target.dataset.bookingUid = ""; // clear booking UID for next add or update
        } else {
            alert("Failed to add/update booking: " + (data.error || "Unknown error"));
        }
    } catch (err) {
        console.error("Booking submission failed:", err);
        alert("Failed to communicate with backend. Check console.");
    }
});

// Attach button listener immediately
const getBtn = document.getElementById("proxy-get-bookings");
if (getBtn) {
    getBtn.addEventListener("click", getBookings);
} else {
    console.error("Button #proxy-get-bookings not found!");
}

// Async login , diary load and booking status load on script load
(async () => {
    const today = new Date().toISOString().split("T")[0]; // format YYYY-MM-DD
    const proxyDateInput = document.getElementById("proxy-date");
    if (proxyDateInput) {
        proxyDateInput.value = today;
    }
    const loginResult = await login();
    if (loginResult.success) {
        const diaryResult = await getDiary();
        if (diaryResult && diaryResult.status === "OK") {
            await getBookingStatus();
        }
    }
})();
// Note: The above IIFE ensures that login and diary fetching happen as soon as the script is loaded.