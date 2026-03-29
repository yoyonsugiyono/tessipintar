// File: js/ui/navigation.js

import { getAppUser } from '../services/auth.js';

export function setupNavigation() {
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleSidebar = () => {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    };

    if(btnMobileMenu) btnMobileMenu.onclick = toggleSidebar;
    if(overlay) overlay.onclick = toggleSidebar;
}

export function buildSidebarNav() {
    const nav = document.getElementById('sidebar-nav');
    const user = getAppUser();
    if (!nav || !user) return;

    const isWali = user.tugasTambahan === 'Wali Kelas' || user.jabatan === 'Wali Kelas';
    const isWakasek = user.tugasTambahan === 'Wakasek Kurikulum' || user.role === 'wakasek';
    const isAdmin = user.role === 'admin';

    let html = `
        <button onclick="window.switchMenu('dashboard')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left">
            <i class="ph ph-squares-four text-xl group-hover:text-yellow-400 transition-colors"></i> Dashboard Utama
        </button>
        <button onclick="window.switchMenu('nilai')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left mt-1">
            <i class="ph ph-exam text-xl group-hover:text-yellow-400 transition-colors"></i> Data Nilai Siswa
        </button>
    `;

    // Menu Kelola Siswa: Admin, Wakasek (Semua Kelas), Wali Kelas (Kelas Sendiri)
    if (isAdmin || isWakasek || isWali) {
        let titleSiswa = 'Kelola Data Siswa';
        if (!isAdmin && !isWakasek && isWali) {
            titleSiswa = `Kelola Siswa (${user.waliKelas})`;
        }
        
        html += `
        <button onclick="window.switchMenu('admin-import')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left mt-1">
            <i class="ph ph-users text-xl group-hover:text-yellow-400 transition-colors"></i> ${titleSiswa}
        </button>`;
    }

    if (isAdmin) {
        html += `
        <div class="my-4 border-t border-blue-800/50"></div>
        <p class="px-4 text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Administrator</p>
        
        <button onclick="window.switchMenu('admin-master')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left">
            <i class="ph ph-database text-xl group-hover:text-purple-400 transition-colors"></i> Master Data
        </button>
        <button onclick="window.switchMenu('admin-guru')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left mt-1">
            <i class="ph ph-users-three text-xl group-hover:text-blue-400 transition-colors"></i> Kelola Pengguna
        </button>
        <button onclick="window.switchMenu('admin-backup')" class="nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-100 hover:bg-blue-800 hover:text-white transition-all font-medium group text-left mt-1">
            <i class="ph ph-cloud-arrow-down text-xl group-hover:text-emerald-400 transition-colors"></i> Backup & Reset
        </button>
        `;
    }

    nav.innerHTML = html;
}

export function switchMenu(menuId) {
    document.querySelectorAll('.section-container').forEach(el => el.classList.add('hidden'));
    
    const targetSec = document.getElementById(`sec-${menuId}`);
    if (targetSec) targetSec.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-blue-800', 'text-white', 'shadow-inner');
        btn.classList.add('text-blue-100');
        const icon = btn.querySelector('i');
        if(icon) icon.classList.remove('text-yellow-400', 'text-purple-400', 'text-blue-400', 'text-emerald-400');
    });

    const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(menuId));
    if (activeBtn) {
        activeBtn.classList.remove('text-blue-100');
        activeBtn.classList.add('bg-blue-800', 'text-white', 'shadow-inner');
        const icon = activeBtn.querySelector('i');
        if(icon) {
            if(menuId.includes('master')) icon.classList.add('text-purple-400');
            else if(menuId.includes('guru')) icon.classList.add('text-blue-400');
            else if(menuId.includes('backup')) icon.classList.add('text-emerald-400');
            else icon.classList.add('text-yellow-400');
        }
    }
}
