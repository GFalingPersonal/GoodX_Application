# GoodX_Application
This is Gerrit Faling's application technical assessment assignment.

It is a Web page that shows a calendar page for a medical practice and uses the GoodX API to CRUD bookings (Create, Read, Update, Delete).
The GoodX API is user/pass authenticated via a login call that responds with a session_UID which the Web page stores in a cookie for follow on API calls. 

A user account has access to different Entities, each entity has Diaries, each diary has Bookings. Bookings have types, and statuses. Families are grouped in Debtor/Patient relationships.

There is a requirement to use the F12 Dev Tools in Google Chrome browser to monitor network requests and activity while exploring GXWeb. From there requests can exported. The GoodX API login call exposes its own user/pass authentication to being harvested from the frontend F12 dev tools. I attempted to only call the login from a proxy, then send the session_ID to the frontend to store in a cookie where the rest of the comunications can take place for the activity monitoring. GoodX API no 'Access-Control-Allow-Origin' header is present on the requested resource, thus we have to install Allow CORS plugin on browser and start the browser without security:

$ start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="C:/temp/chrome-dev"

Then we can see all the GoodX API traffic, including the login details visible in the javascript F12. But we run into a second problem, JS does not handle HttpOnly session cookies correctly and the session_UID in bearer authentication fails. 

I have implemented frontend_proxy.js and backend_proxy.py, that the python backend proxy handles the server-to-server connection without CORS and stores the cookie correctly. 


More requirements adhered to:
 • Unit testing: Consider adding unit tests to your application.
 • Code commenting: Consider adding sufficient comments in your code for clarity. 
 • Validation: Consider adding validation to data input fields where necessary.
 • Functionality: While we value innovation, kindly bear in mind that our primary interest lies in observing your coding proficiency. Prioritise the fundamental functionality, and there is no need to allocate excessive effort to elaborate features or detailed data displays
 