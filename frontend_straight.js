// This the the JavaScript that calls the GoodX API directly, the username and password is visible to F12 console
//const username = import.meta.env.VITE_API_USERNAME;  // injected at build time thus unsafe in runtime, so this method is a anti-pattern
//const password = import.meta.env.VITE_API_PASSWORD;  // but we need F12 for API calls capturing as part of the deliverable
//even the import doesn't in dev time
const username = "applicant_004";
const password = "applica_4";

console.log("----------GF Frontend Straight Calls----------");

// Store cookie manually (for F12 visibility)
function setCookie_Func(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value || ""}${expires}; path=/; Secure; SameSite=Strict`;
}

// Login directly to GoodX API
async function loginDirect() {
    console.log("Unsecure: logging in directly to GoodX API...");
    const url = "https://dev_interview.qagoodx.co.za/api/session";
    const headers = { "Content-Type": "application/json" };
    const payload = {
        model: { timeout: 259200 },
        auth: [
            [
                "password",
                {
                    "username": username,
                    "password": password
                }
            ]
        ]
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload),
            credentials: "include" // <-- add this
        });

        // Extract session_id from Set-Cookie header
        const set_cookie = res.headers.get("set-cookie");
        let sessionCookie = null;
        if (set_cookie) {
            const match = set_cookie.match(/session_id=("[^;]+");/);
            if (match) {
                sessionCookie = match[1];
                console.log("Extracted session_id cookie:", sessionCookie);
            }
        }

        const data = await res.json();
        const sessionUID = data?.data?.uid;
        if (sessionUID) {
            setCookie_Func("session_UID", sessionUID, 1);
            console.log("Session UID stored in cookie:", sessionUID);
        } else {
            console.error("No session UID found in response!");
        }
        // Return both sessionUID and sessionCookie
        return { sessionUID, sessionCookie };

    } catch (err) {
        console.error("Login failed:", err);
        return null;
    }
}

// Fetch data directly from GoodX API
async function getDiaryDirect(sessionUID) {
    console.log("Unsecure: fetching data directly from GoodX API...");

    const fields = [
        "uid","entity_uid","treating_doctor_uid","service_center_uid",
        "booking_type_uid","name","uuid","disabled"
    ];

    const url = `https://dev_interview.qagoodx.co.za/api/diary?fields=${encodeURIComponent(JSON.stringify(fields))}`;
    const headers = {};
    // Do NOT set Cookie header manually

    try {
        const res = await fetch(url, {
            headers: headers,
            credentials: "include" // <-- add this
        });

        const data = await res.json();
        console.log("Data response:", data);
        return data;

    } catch (err) {
        console.error("Data fetch failed:", err);
        return null;
    }
}

// Run on page load
(async () => {
    console.log("----------GF Starting direct login----------");
    const loginResult = await loginDirect();
    if (loginResult && loginResult.sessionUID) {
        await getDiaryDirect(loginResult.sessionUID);
    }
})();
