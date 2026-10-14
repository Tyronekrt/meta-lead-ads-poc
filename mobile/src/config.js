/**
 * Backend URL configuration.
 *
 * Change BACKEND_URL to point at your computer's backend:
 *
 *  - Android emulator  → http://10.0.2.2:3001
 *  - iOS simulator     → http://localhost:3001
 *  - Physical phone (Expo Go, same Wi-Fi) → http://<YOUR_LAPTOP_LAN_IP>:3001
 *      e.g. http://192.168.1.5:3001  (find with `ip addr` / `ifconfig`)
 *  - Public demo (after `ngrok http 3001`) → https://XXXX.ngrok-free.app
 *
 * The app also reads Expo extra `backendUrl` if you set it in app.json.
 */

export const DEFAULT_BACKEND_URL = 'http://10.0.2.2:3001';

// set to true to see socket logs in console (useful while recording/debugging)
export const DEBUG_SOCKET = false;
