// File: js/main.js

import './config/firebase.js'; // Pastikan Firebase diinisialisasi pertama kali
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    // --- 1. ATUR TANGGAL & WAKTU ---
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // --- 2. FITUR DEBUGGER UI ---
    const debugDot = document.getElementById('debug-status-dot');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugPanel = document.getElementById('debug-panel');

    // Mengaktifkan tombol buka/tutup panel debug di pojok kiri bawah
    if (btnToggleDebug && debugPanel) {
        btnToggleDebug.onclick = () => debugPanel.classList.toggle('hidden');
    }

    // --- 3. INISIALISASI EVENT LISTENER & FORM ---
    setupNavigation();
    setupUIEvents(); 
    setupAdminEvents();
    
    initLoginForm((user) => {
        showApp(user);
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            handleLogout(() => {
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            });
        }
    }

    // --- 4. KONEKSI FIREBASE & DATA AWAL ---
    setupAuth(async (firebaseUser) => {
        // Ubah titik debug menjadi hijau karena Firebase berhasil terhubung
        if (debugDot) {
            debugDot.classList.replace('bg-red-500', 'bg-green-500');
            debugDot.classList.remove('animate-pulse');
        }

        // Tunggu Master Data (Kelas & Mapel) dimuat dari cloud
        await loadMasterData();
        populateDropdowns(); // Isi semua dropdown di aplikasi
        
        // Cek Sesi Login dari Local Storage (Auto-Login)
        const savedUser = restoreSession();
        if (savedUser) {
            console.log("[DEBUG] Sesi ditemukan! Otomatis masuk aplikasi...");
            showApp(savedUser);
        }
        
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

    // --- 5. JADIKAN FUNGSI GLOBAL ---
    window.switchMenu = (menuId) => {
        coreSwitchMenu(menuId);
        // Jika masuk ke menu Master Data, pastikan datanya langsung di-render
        if (menuId === 'admin-master') renderMasterDataUI();
    };
}

// --- FUNGSI TRANSISI LAYAR UTAMA ---
function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    // Setel Identitas Pengguna di Header & Sidebar
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
