# **App Name**: Driver Command App

## Core Features:

- Driver Verification & Assignment: On login, the app reads /settings/branding from Firestore, looks inside the verifiedDrivers array for the logged-in user's email, retrieves their assigned busNumber, and grants or denies access.
- Broadcast Activation Toggle: A large toggle to initiate or stop the "Official Broadcast" of telemetry data.
- High-Precision GPS Telemetry: Uses navigator.geolocation.watchPosition with enableHighAccuracy: true to obtain precise location data.
- Real-time Telemetry Broadcasting: Writes telemetry data (uid, email, bus_id, bus_number, location, speed, timestamp) every few seconds to buses/{selectedBusId}/signals/{authUid}.
- Background Telemetry Persistence: Ensures the app continues to send data to Firebase and track location even if the phone goes to sleep, utilizing Capacitor for background support.
- Crowdsourcing Authority Toggle: A switch to update the allow_crowdsourcing (boolean) field in the buses/{busId} document, controlling whether the Driver App signal is the only one visible on the student tracker.
- Live Telemetry Dashboard: Displays the driver's current speed, GPS accuracy, and signal status (Live/Offline) in real-time.
- Broadcast Signal Cleanup: Ensures the app cleans up its signal (deleteDoc) from Firestore when the broadcast is toggled off or the user logs out.

## Style Guidelines:

- Dark mode command-center aesthetic, with a primary color of HSL: 215 69% 58%.
- Utilizes ShadCN-style cards for structured information display and big, accessible buttons for drivers on the move.