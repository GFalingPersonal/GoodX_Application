console.log("----------GF Frontend Secure Placeholder----------");

// Placeholder message on the secure panel
const panel = document.getElementById("frontend-secure");

if (panel) {
    const infoDiv = document.createElement("div");
    infoDiv.style.padding = "10px";
    infoDiv.style.marginTop = "1rem";
    infoDiv.style.backgroundColor = "#f0f0f0";
    infoDiv.style.border = "1px dashed #aaa";
    infoDiv.innerHTML = `
        <h4>Secure API Implementation Concept</h4>
        <p>
            This panel is designed for users to enter their <strong>Practice Name</strong> 
            and <strong>Password</strong> manually. Unlike the Proxy mode, that pre-populate the dropdown.
        </p>
        <p>
            Backend (backend_secure.py) would:
            <ol>
                <li>Confirm the practice name exists in the diary.</li>
                <li>The practice cannot have itself as debtor, we store the SHA256 hash of the password</li>
                <li>    in the debtors collection, debtor name = diary name and debtor surname = pasword hash</li>
                <li>Compare the hash of the entered password with the stored hash.</li>
                <li>If the hash matches, allow access to bookings.</li>
            </ol>
        </p>
        <p style="color: red;"><em>Note: This is a placeholder. Actual login and API calls are not implemented.</em></p>
    `;
    panel.appendChild(infoDiv);
}

// Optional: focus the practice name input when the tab is opened
window.initFrontendSecure = function() {
    console.log("Frontend Secure placeholder initialized");
    // focus username input
    const firstInput = document.querySelector("#frontend-secure input");
    if (firstInput) firstInput.focus();
};


// Expose to window so index.html tab click can call
window.initFrontendSecure = initFrontendSecure;
// End of frontend_secure.js