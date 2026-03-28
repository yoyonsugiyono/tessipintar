// File: js/main.js

import { auth, db } from './config/firebase.js';
import { setupAuth, initLoginForm, handleLogout, activeTahun, activeSemester } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu } from './ui/navigation.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 1. Inisialisasi Auth & Sidebar Event
    setupNavigation();
    initLoginForm((user) => {
        showApp(user);
    });

    // 2. Tombol Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            handleLogout(() => {
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            });
        }
    }

    // 3. Tarik Master Data saat terhubung
    setupAuth(async (firebaseUser) => {
        await loadMasterData();
        // Nanti kita tambahkan "loadDataNilai()" di sini
    });

    // 4. Jadikan fungsi switchMenu global agar bisa dipanggil dari atribut 'onclick' di HTML
    window.switchMenu = switchMenu;
}

function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    document.getElementById('auth-user-name').textContent = user.username.split(',')[0];
    document.getElementById('auth-user-role').textContent = user.role;
    document.getElementById('page-subtitle-name').textContent = user.username.split(',')[0];
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check"></i> TA. ${activeTahun} - Semester ${activeSemester}`;
    
    // Bangun menu sidebar sesuai role (Admin/Guru/Wakasek)
    buildSidebarNav();
    
    // Secara otomatis arahkan ke dashboard
    switchMenu('dashboard');
}

window.onload = init;
