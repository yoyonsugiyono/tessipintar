// File: js/main.js

import { auth, db } from './config/firebase.js';
import { setupAuth, initLoginForm, handleLogout, activeTahun, activeSemester } from './services/auth.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    // Setel tanggal di pojok kanan atas
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 1. Siapkan Form Login
    initLoginForm((user) => {
        // Jika login sukses, jalankan ini
        showApp(user);
    });

    // 2. Siapkan Tombol Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            handleLogout(() => {
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            });
        }
    }

    // 3. Mulai koneksi Firebase Auth
    setupAuth((firebaseUser) => {
        console.log("[DEBUG] Data master & pengguna siap digunakan!");
        // (Nanti fungsi load master data dan load nilai kita panggil di sini)
    });
}

// Fungsi untuk berpindah dari layar Login ke Layar Utama
function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    // Set identitas di sidebar & header
    document.getElementById('auth-user-name').textContent = user.username.split(',')[0];
    document.getElementById('auth-user-role').textContent = user.role;
    document.getElementById('page-subtitle-name').textContent = user.username.split(',')[0];
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check"></i> TA. ${activeTahun} - Semester ${activeSemester}`;
    
    console.log(`[DEBUG] Berhasil masuk sebagai ${user.role}`);
}

window.onload = init;
