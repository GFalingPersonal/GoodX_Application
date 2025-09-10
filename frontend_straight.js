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

async function loginDirect() {
    console.log("Unsecure: logging in directly to GoodX API...");
    const url = "https://dev_interview.qagoodx.co.za/api/session";
    const headers = { "Content-Type": "application/json" };
    const payload = {
        model: { timeout: 259200 },
        auth: [["password", { "username": username, "password": password }]]
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        const set_cookie = res.headers.get("set-cookie");
        let sessionCookie = null;
        if (set_cookie) {
            const match = set_cookie.match(/session_id=("[^;]+");/);
            if (match) sessionCookie = match[1];
        }

        const data = await res.json();
        const straight_sessionUID = data?.data?.uid;
        if (straight_sessionUID) {
            setCookie_Func("session_UID", straight_sessionUID, 1);
            console.log("Session UID stored in cookie:", straight_sessionUID);
        } else {
            console.error("No session UID found in response!");
        }

        return { straight_sessionUID, sessionCookie };

    } catch (err) {
        console.error("Login failed:", err);
        return null;
    }
}

async function getDiaryDirect(straight_sessionUID) {
    console.log("Unsecure: fetching data directly from GoodX API...");
    const fields = ["uid","entity_uid","treating_doctor_uid","service_center_uid","booking_type_uid","name","uuid","disabled"];
    const url = `https://dev_interview.qagoodx.co.za/api/diary?fields=${encodeURIComponent(JSON.stringify(fields))}`;

    try {
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json();
        console.log("Data response:", data);
        return data;
    } catch (err) {
        console.error("Data fetch failed:", err);
        return null;
    }
}

// --- NEW FUNCTION TO CALL WHEN TAB CLICKED ---
let straightTabInitialized = false;  // ensures we only call login once
async function initFrontendStraight() {
    if (!straightTabInitialized) {
        straightTabInitialized = true;
        const loginResult = await loginDirect();
// MOCK login for tab testing
// const loginResult = { straight_sessionUID: "TEST_UID" };
        console.log("Mock loginResult:", loginResult);
        if (loginResult?.straight_sessionUID) {
            await getDiaryDirect(loginResult.straight_sessionUID);
        }
    }
}

// Expose function globally to be called from index.html tab click
window.initFrontendStraight = initFrontendStraight;
// End of frontend_straight.js