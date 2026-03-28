// File: js/main.js

import './config/firebase.js';
// Tambahkan import 'restoreSession' di bawah ini:
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';

function init() {
    console.log("[DEBUG] Aplikasi Si PINTAR mulai diinisialisasi...");
    
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
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
        await loadMasterData();
        populateDropdowns();
        
        // ----------------------------------------------------
        // FITUR BARU: CEK SESI LOGIN DARI LOCAL STORAGE
        // ----------------------------------------------------
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
