console.log("----------GF Frontend Proxy----------");

let sessionUID = null;
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
        sessionUID = data.session_UID;
        console.log("Login successful, session UID stored:", sessionUID);
    } else {
        console.error("Login failed:", data.error);
    }
    return data;
}
// Fetch booking_status collection via backend proxy
async function getBookingStatus() {
    if (!sessionUID) {
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
    if (!sessionUID) {
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

// Attach button listener immediately
const getBtn = document.getElementById("proxy-get-bookings");
if (getBtn) {
    getBtn.addEventListener("click", getBookings);
} else {
    console.error("Button #proxy-get-bookings not found!");
}

// Async login , diary load and booking status load on script load
(async () => {
    const loginResult = await login();
    if (loginResult.success) {
        const diaryResult = await getDiary();
        if (diaryResult && diaryResult.status === "OK") {
            await getBookingStatus();
        }
    }
})();
// Note: The above IIFE ensures that login and diary fetching happen as soon as the script is loaded.