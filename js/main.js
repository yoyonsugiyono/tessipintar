// File: js/main.js

import { auth, db } from './config/firebase.js';
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru } from './ui/tables.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 1. Inisialisasi Navigasi & Form Login
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

    // 3. Tarik Master Data & Data Nilai saat terhubung ke Firestore
    setupAuth(async (firebaseUser) => {
        await loadMasterData();
        
        // Mulai dengarkan perubahan data nilai secara real-time dari cloud
        setupFirestoreListener(() => {
            // Callback ini akan dipanggil otomatis setiap kali ada perubahan data (tambah/edit/hapus)
            const activeSec = document.querySelector('.section-container:not(.hidden)');
            if (activeSec) {
                if (activeSec.id === 'sec-admin-import') renderTableSiswa(); 
                if (activeSec.id === 'sec-admin-guru') renderTableGuru();
                
                // Catatan: Fungsi renderTable (untuk nilai) akan kita buat di langkah berikutnya.
                // Logika ini mencegah aplikasi crash sebelum fungsi tersebut dibuat.
                if (activeSec.id === 'sec-nilai' && typeof window.renderTable === 'function') {
                    window.renderTable();
                }
            }
        });
    });

    // 4. Jadikan fungsi switchMenu global agar bisa dipanggil dari HTML
    window.switchMenu = switchMenu;
}

// Fungsi untuk transisi dari Login ke Layar Utama
function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    document.getElementById('auth-user-name').textContent = user.username.split(',')[0];
    document.getElementById('auth-user-role').textContent = user.role;
    document.getElementById('page-subtitle-name').textContent = user.username.split(',')[0];
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check"></i> TA. ${thn} - Semester ${smt}`;
    
    // Bangun menu sidebar sesuai role (Admin/Guru/Wakasek)
    buildSidebarNav();
    
    // Arahkan ke dashboard secara otomatis
    switchMenu('dashboard');
}

// Jalankan saat halaman siap
window.onload = init;
