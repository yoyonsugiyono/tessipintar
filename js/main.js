// File: js/main.js

// Import konfigurasi firebase yang baru saja kita buat
import { auth, db } from './config/firebase.js';

// --- INIT APP ---
function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    // Setel tanggal di header
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // Nanti kita akan panggil fungsi otentikasi (login) dan render di sini
    // setupAuth();
}

// Jalankan init saat halaman dimuat
window.onload = init;
