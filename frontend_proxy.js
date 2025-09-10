console.log("----------GF Frontend Proxy----------");

let proxy_sessionUID = null;
let selectedDiaryUid = null;
let selectedEntityUid = null;
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
                </tr>
            </thead>
            <tbody>
    `;

    for (const row of data) {
        // Map booking_status_uid to its name using bookingStatusMap
        if (row.booking_status_uid && bookingStatusMap[row.booking_status_uid]) {
            row.booking_status_uid = bookingStatusMap[row.booking_status_uid];
        } else {
            row.booking_status_uid = "Unknown";
        }
        html += `
            <tr>
                <td>${row.time_pretty}</td>
                <td>${row.booking_status_uid ?? ""}</td>
                <td>${row.patient_surname ?? ""}</td>
                <td>${row.patient_name ?? ""}</td>
                <td>${row.cancelled ? "Cancelled" : ""}</td>
            </tr>
        `;
    }

    html += "</tbody></table>";
    return html;
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
    } else {
        document.getElementById("proxy-results").innerHTML =
            "<p>No bookings found for the selected date.</p>";
    }
}

// Load booking types into modal select
async function loadBookingTypes() {
    const res = await fetch(`http://localhost:3000/booking_types?diary_uid=${selectedDiaryUid}&entity_uid=${selectedEntityUid}`, {
        method: "GET",
        credentials: "include"
    });
    const data = await res.json();
    console.log("Booking types:", data);

    const select = document.getElementById("modal-booking-type");
    select.innerHTML = "";
    data.data.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type.uid;
        opt.textContent = type.name;
        select.appendChild(opt);
    });
}

// Load patients into modal select
async function loadPatients() {
    const res = await fetch(`http://localhost:3000/patients?entity_uid=${selectedEntityUid}`, {
        method: "GET",
        credentials: "include"
    });
    const data = await res.json();
    console.log("Patients:", data);

    const select = document.getElementById("modal-patient");
    select.innerHTML = "";
    data.data.forEach(patient => {
        const opt = document.createElement("option");
        opt.value = patient.uid;
        opt.textContent = `${patient.surname}, ${patient.name}`;
        select.appendChild(opt);
    });
}

// Load booking statuses into modal select
function loadStatuses() {
    const select = document.getElementById("modal-status");
    select.innerHTML = "";
    Object.entries(bookingStatusMap).forEach(([uid, name]) => {
        const opt = document.createElement("option");
        opt.value = uid;
        opt.textContent = name;
        select.appendChild(opt);
    });
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
// Close add booking modal form
function closeAddBookingModal() {
    document.getElementById("add-booking-modal").style.display = "none";
}

document.getElementById("add-booking-form").addEventListener("submit", async (e) => {
    e.preventDefault(); // prevent page reload

    // collect form values (correct IDs!)
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

    console.log("Submitting new booking:", bookingData);

    const res = await fetch("http://localhost:3000/add_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
        credentials: "include"
    });

    const data = await res.json();
    console.log("Add booking response:", data);

    if (data && data.status === "OK" && data.data) {
        alert("Booking added successfully!");
        closeAddBookingModal();
        getBookings(); // refresh table
    } else {
        alert("Failed to add booking: " + (data.error || "Unknown error"));
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