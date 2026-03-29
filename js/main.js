// File: js/main.js

import './config/firebase.js'; 
import { setupAuth, initLoginForm, handleLogout, getActiveTahun, getActiveSemester, restoreSession, getAppUser } from './services/auth.js';
import { loadMasterData } from './services/db-master.js';
import { setupNavigation, buildSidebarNav, switchMenu as coreSwitchMenu } from './ui/navigation.js';
import { setupFirestoreListener } from './services/db-grades.js';
import { renderTableSiswa, renderTableGuru, renderTable, populateDropdowns, renderMasterDataUI, gradesData } from './ui/tables.js';
import { setupUIEvents } from './ui/events.js';
import { setupAdminEvents } from './ui/admin.js';
import { updateDashboardChart } from './services/charts.js';

function init() {
    console.log("[DEBUG] Inisialisasi Si PINTAR...");

    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    const debugDot = document.getElementById('debug-status-dot');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugPanel = document.getElementById('debug-panel');
    if (btnToggleDebug && debugPanel) btnToggleDebug.onclick = () => debugPanel.classList.toggle('hidden');

    setupNavigation();
    setupUIEvents(); 
    setupAdminEvents();
    
    initLoginForm((user) => {
        showApp(user);
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => handleLogout();

    // Event Global Filter Dashboard
    const btnApplyDashFilter = document.getElementById('btn-apply-dash-filter');
    if (btnApplyDashFilter) {
        btnApplyDashFilter.onclick = () => {
            updateDashboardView();
        };
    }

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
        
        setupFirestoreListener(() => {
            updateDashboardView();

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

// FUNGSI UPDATE TAMPILAN DASHBOARD
export function updateDashboardView() {
    if (!gradesData) return;
    
    // Default ambil dari Login
    let thn = getActiveTahun();
    let smt = getActiveSemester();
    
    // Tapi jika Admin menggunakan filter histori, override datanya!
    const dashTahun = document.getElementById('dash-filter-tahun');
    const dashSmt = document.getElementById('dash-filter-smt');
    if (dashTahun && dashSmt) {
        thn = dashTahun.value;
        smt = dashSmt.value;
    }

    const activeGrades = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    const totalSiswa = [...new Set(activeGrades.map(g => g.studentName + g.nisn))].length;
    const avgNilai = activeGrades.length ? activeGrades.reduce((acc, curr) => acc + (curr.results?.final || 0), 0) / activeGrades.length : 0;
    
    if(document.getElementById('stat-students')) document.getElementById('stat-students').textContent = totalSiswa;
    if(document.getElementById('stat-avg')) document.getElementById('stat-avg').textContent = avgNilai.toFixed(1);
    
    updateDashboardChart(activeGrades);
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
    
    // Tampilkan Filter Dashboard Khusus untuk Admin
    if (user.role === 'admin' || user.role === 'wakasek') {
        const filterDash = document.getElementById('dashboard-filter-bar');
        if (filterDash) {
            filterDash.classList.remove('hidden');
            document.getElementById('dash-filter-tahun').value = thn;
            document.getElementById('dash-filter-smt').value = smt;
        }
    }

    // Set Label Tahun & Semester Aktif di Menu Copy Siswa
    if (document.getElementById('label-copy-tahun-aktif')) document.getElementById('label-copy-tahun-aktif').textContent = thn;
    if (document.getElementById('label-copy-smt-aktif')) document.getElementById('label-copy-smt-aktif').textContent = smt;

    buildSidebarNav();
    window.switchMenu('dashboard');
}

window.onload = init;
