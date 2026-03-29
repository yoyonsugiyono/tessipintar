// File: js/main.js

import './config/firebase.js'; 
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI, gradesData } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';
import { updateDashboardChart } from './services/charts.js';

function init() {
    console.log("[DEBUG] Inisialisasi Si PINTAR...");

    // 1. Setup UI & Global Date
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 2. Setup Panel Debug & Event Listeners
    const debugDot = document.getElementById('debug-status-dot');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugPanel = document.getElementById('debug-panel');
    if (btnToggleDebug && debugPanel) btnToggleDebug.onclick = () => debugPanel.classList.toggle('hidden');

    setupNavigation();
    setupUIEvents(); 
    setupAdminEvents();
    
    // 3. Inisialisasi Form Login
    initLoginForm((user) => {
        showApp(user);
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => handleLogout();

    // 4. Proses Otentikasi & Load Data
    setupAuth(async (firebaseUser) => {
        if (debugDot) {
            debugDot.classList.replace('bg-red-500', 'bg-green-500');
            debugDot.classList.remove('animate-pulse');
        }

        await loadMasterData();
        populateDropdowns(); 
        
        const savedUser = restoreSession();
        if (savedUser) {
            console.log("[DEBUG] Sesi aktif ditemukan. Langsung masuk...");
            showApp(savedUser);
        }
        
        // Aktifkan Real-time Update dari Database
        setupFirestoreListener(() => {
            // PERBAIKAN: Filter data berdasarkan Tahun & Semester Aktif
            const thn = getActiveTahun();
            const smt = getActiveSemester();
            const activeGrades = gradesData.filter(g => g.tahun === thn && g.semester === smt);

            // Update Statistik & Grafik di Dashboard HANYA untuk periode aktif
            const totalSiswa = [...new Set(activeGrades.map(g => g.studentName))].length;
            const avgNilai = activeGrades.reduce((acc, curr) => acc + (curr.results?.final || 0), 0) / (activeGrades.length || 1);
            
            if(document.getElementById('stat-students')) document.getElementById('stat-students').textContent = totalSiswa;
            if(document.getElementById('stat-avg')) document.getElementById('stat-avg').textContent = avgNilai.toFixed(1);
            
            updateDashboardChart(activeGrades);

            // Re-render Tabel jika menu tersebut sedang dibuka
            const activeSec = document.querySelector('.section-container:not(.hidden)');
            if (activeSec) {
                if (activeSec.id === 'sec-admin-import') renderTableSiswa(); 
                if (activeSec.id === 'sec-admin-guru') renderTableGuru();
                if (activeSec.id === 'sec-admin-master') renderMasterDataUI(); 
                if (activeSec.id === 'sec-nilai') renderTable();
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
    document.getElementById('display-periode').innerHTML = `<i class="ph ph-calendar-check mr-2"></i> TA. ${thn} - ${smt}`;
    
    buildSidebarNav();
    window.switchMenu('dashboard');
}

window.onload = init;
