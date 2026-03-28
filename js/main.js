// File: js/main.js

import './config/firebase.js'; // Memastikan Firebase jalan duluan
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    // 1. Atur Tanggal di Pojok Kanan Atas
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 2. Inisialisasi Semua Event Listener (Navigasi, UI, Admin, dan Login)
    setupNavigation();
    setupUIEvents(); 
    setupAdminEvents(); // Mengaktifkan Modal, CRUD Guru/Siswa, Export/Import
    
    initLoginForm((user) => {
        showApp(user);
    });

    // 3. Tombol Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            handleLogout(() => {
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            });
        }
    }

    // 4. Tarik Master Data & Render Dropdown saat terhubung ke Firestore
    setupAuth(async (firebaseUser) => {
        // Tunggu Master Data (Kelas & Mapel) dimuat
        await loadMasterData();
        
        // Isi semua pilihan dropdown di aplikasi (Filter, Tambah Siswa, dll)
        populateDropdowns();
        
        // Dengarkan perubahan data nilai secara real-time
        setupFirestoreListener(() => {
            const activeSec = document.querySelector('.section-container:not(.hidden)');
            if (activeSec) {
                if (activeSec.id === 'sec-admin-import') renderTableSiswa(); 
                if (activeSec.id === 'sec-admin-guru') renderTableGuru();
                if (activeSec.id === 'sec-admin-master') renderMasterDataUI(); 
                if (activeSec.id === 'sec-nilai' && typeof window.renderTable === 'function') {
                    window.renderTable();
                }
            }
        });
    });

    // 5. Jadikan fungsi pindah menu global agar bisa dipanggil HTML (onclick)
    window.switchMenu = (menuId) => {
        coreSwitchMenu(menuId);
        // Jika masuk ke menu Master Data, pastikan datanya di-render
        if (menuId === 'admin-master') {
            renderMasterDataUI();
        }
    };
}

// Fungsi Transisi dari Layar Login ke Dashboard Utama
function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    // Setel Identitas Pengguna
    document.getElementById('auth-user-name').textContent = user.username.split(',')[0];
    document.getElementById('auth-user-role').textContent = user.role;
    document.getElementById('page-subtitle-name').textContent = user.username.split(',')[0];
    
    // Setel Periode Tahun & Semester
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check"></i> TA. ${thn} - Semester ${smt}`;
    
    // Bangun menu sidebar sesuai role
    buildSidebarNav();
    
    // Arahkan ke dashboard secara otomatis
    window.switchMenu('dashboard');
}

// Eksekusi semua saat halaman siap
window.onload = init;
