// File: js/main.js

import './config/firebase.js'; 
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';

// ==========================================
// FITUR VISUAL DEBUGGER (Menampilkan Log ke Layar)
// ==========================================
const debugContent = document.getElementById('debug-content');
const debugDot = document.getElementById('debug-status-dot');
const originalLog = console.log;
const originalError = console.error;

function printToUI(msg, isErr = false) {
    if (!debugContent) return;
    const p = document.createElement('div');
    const time = new Date().toLocaleTimeString('id-ID');
    
    if (isErr) {
        p.innerHTML = `<span class="text-gray-400">[${time}]</span> <span class="text-red-400 font-bold">Err: ${msg}</span>`;
        if (debugDot) {
            debugDot.classList.replace('bg-green-500', 'bg-red-500');
            debugDot.classList.add('animate-pulse');
        }
    } else {
        p.innerHTML = `<span class="text-gray-400">[${time}]</span> <span class="text-green-300">${msg}</span>`;
    }
    
    debugContent.appendChild(p);
    
    // Auto-scroll ke bawah saat ada pesan baru
    const panel = document.getElementById('debug-panel');
    if (panel) panel.scrollTop = panel.scrollHeight;
}

// Intersep console.log agar tampil di HTML
console.log = function(...args) {
    originalLog.apply(console, args);
    if (typeof args[0] === 'string' && args[0].includes('[DEBUG]')) {
        printToUI(args[0].replace('[DEBUG] ', ''));
    }
};

console.error = function(...args) {
    originalError.apply(console, args);
    if (typeof args[0] === 'string' && args[0].includes('[DEBUG]')) {
        const errMsg = args[1]?.message || args[1]?.code || args[1] || '';
        printToUI(args[0].replace('[DEBUG] ', '') + ' ' + errMsg, true);
    }
};

// ==========================================
// INISIALISASI APLIKASI
// ==========================================
function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // Mengaktifkan tombol buka/tutup panel debug di pojok kiri bawah
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugPanel = document.getElementById('debug-panel');
    if (btnToggleDebug && debugPanel) {
        btnToggleDebug.onclick = () => debugPanel.classList.toggle('hidden');
    }

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

    setupAuth(async (firebaseUser) => {
        // Ubah titik debug menjadi hijau saat berhasil tembus Firebase
        if (debugDot) {
            debugDot.classList.replace('bg-red-500', 'bg-green-500');
            debugDot.classList.remove('animate-pulse');
        }

        await loadMasterData();
        populateDropdowns(); 
        
        const savedUser = restoreSession();
        if (savedUser) {
            console.log("[DEBUG] Sesi ditemukan! Otomatis masuk aplikasi...");
            showApp(savedUser);
        }
        
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

    window.switchMenu = (menuId) => {
        coreSwitchMenu(menuId);
        if (menuId === 'admin-master') renderMasterDataUI();
    };
}

function showApp(user) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-view').classList.remove('hidden');
    
    document.getElementById('auth-user-name').textContent = user.username.split(',')[0];
    document.getElementById('auth-user-role').textContent = user.role;
    document.getElementById('page-subtitle-name').textContent = user.username.split(',')[0];
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check"></i> TA. ${thn} - Semester ${smt}`;
    
    buildSidebarNav();
    window.switchMenu('dashboard');
}

window.onload = init;
