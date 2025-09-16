# GoodX_Application
This is Gerrit Faling's application technical assessment assignment.

It is a Web page that shows a calendar page for a medical practice and uses the GoodX API to CRUD bookings (Create, Read, Update, Delete).
The GoodX API is user/pass authenticated via a login call that responds with a session_UID which the Web page stores in a cookie for follow on API calls. 

A user account has access to different Entities, each entity has Diaries, each diary has Bookings. Bookings have types, and statuses. Families are grouped in Debtor/Patient relationships.

There is a requirement to use the F12 Dev Tools in Google Chrome browser to monitor network requests and activity while exploring GXWeb. From there requests can exported. The GoodX API login call exposes its own user/pass authentication to being harvested from the frontend F12 dev tools. I attempted to only call the login from a proxy, then send the session_ID to the frontend to store in a cookie where the rest of the comunications can take place for the activity monitoring. In the GoodX API no 'Access-Control-Allow-Origin' header is present on the requested resource, thus I had to install Allow CORS plugin on browser and resorted to starting the browser without security:

$ start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="C:/temp/chrome-dev"

Running the API through the file frontend_straight.js I could see the GoodX API traffic in F12 Network Tab. The login details visible in the Data payload in F12 view for all to see. Also I ran into a second problem, JS does not handle HttpOnly session cookies correctly, cannot add the cookie in the header and the session_UID in bearer authentication fails. 

I have implemented frontend_proxy.js and backend_proxy.py, that the python backend proxy handles the server-to-server connection without CORS and stores and uses the cookie correctly, while sending the cookie to the frontend as well for state awareness. 

With the proxy API server, the call to login retrieves the cookie that is used for subsequent calls: getDiary, getBookings, getBookingStatuses, getBookingTypes, getPatients, createBooking, updateBooking, deleteBooking all works with the cookie as token. All the API calls mentioned works as expected. The backend_proxy.py if hosted on Google Cloud and the frontend on Google Firebase

Requirements already adhered to:
 • Validation: Consider adding validation to data input fields where necessary.
 • Functionality: While we value innovation, kindly bear in mind that our primary interest lies in observing your coding proficiency. Prioritise the fundamental functionality... I have created a third screen Frontend Secure were I jotted down some thoughts on how this API implementation can be improved if it were to be taken into production, but not implemented... 
 • Code commenting: Some comments in my code for clarity is implemented, but can usually always be expanded on ;-).

More requirements to be adhered to:
 • Unit testing: Consider adding unit tests to your application.
 • Code commenting: Consider adding sufficient comments in your code for clarity. 
 

 