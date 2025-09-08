# GoodX_Application
This is Gerrit Faling's application technical assessment assignment. 
It is a Web page that shows a calendar page of a medical practice and uses the GoodX API to CRUD bookings (Create, Read, Update, Delete).
The API is user/pass authenticated via a log in call responds with a session_UID that the Web page stores in a cookie for follow on API calls.
A user account has access to different Entities, each entity has Diaries, each diary has Bookings. Bookings have types, and statuses. Families are grouped in Debtor/Patient relationships.
