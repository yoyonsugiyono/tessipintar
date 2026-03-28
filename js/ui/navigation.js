// File: js/ui/navigation.js

import { getAppUser } from '../services/auth.js';
import { renderTableGuru, renderTableSiswa } from './tables.js';

// Setup tombol menu untuk tampilan Mobile (HP)
export function setupNavigation() {
    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');

    if (btnMobileMenu && sidebarOverlay && sidebar) {
        btnMobileMenu.onclick = () => {
            sidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
        };
        sidebarOverlay.onclick = () => {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        };
    }
}

// Fungsi untuk mengganti menu konten yang aktif
export function switchMenu(menuId) {
    const appUser = getAppUser();
    if (!appUser) return;
    
    // Tutup sidebar di HP
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if(sidebar) sidebar.classList.add('-translate-x-full'); 
    if(sidebarOverlay) sidebarOverlay.classList.add('hidden');
    
    // Update tombol aktif
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const icon = btn.querySelector('i');
        if(btn.dataset.id === menuId) {
            btn.className = 'nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-900 font-bold shadow-lg';
            if(icon) icon.classList.replace('text-blue-400', 'text-blue-900');
        } else {
            btn.className = 'nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white';
            if(icon) icon.classList.replace('text-blue-900', 'text-blue-400');
        }
    });

    const titles = { 
        'dashboard':'Dashboard Utama', 'admin-import':'Kelola Data Siswa', 'admin-master':'Kelola Master Data',
        'admin-delete':'Hapus Data Kelas', 'admin-guru':'Kelola Data Guru', 'admin-backup':'Backup & Restore Database', 
        'nilai': appUser.role === 'wakasek' ? 'Cek Rekap Nilai Guru' : 'Input Nilai' 
    };
    const pageTitle = document.getElementById('page-title');
    if(pageTitle) pageTitle.textContent = titles[menuId] || 'Si PINTAR';

    // Sembunyikan semua section
    ['sec-dashboard', 'sec-admin-import', 'sec-admin-delete', 'sec-nilai', 'sec-admin-guru', 'sec-admin-backup', 'sec-admin-master']
        .forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });

    // Tampilkan & RENDER berdasarkan menu yang dipilih
    if(menuId === 'dashboard') {
        document.getElementById('sec-dashboard').classList.remove('hidden');
    } 
    else if(menuId === 'admin-import') {
        document.getElementById('sec-admin-import').classList.remove('hidden');
        renderTableSiswa(); // Memanggil fungsi render tabel siswa
    } 
    else if(menuId === 'admin-master') {
        document.getElementById('sec-admin-master').classList.remove('hidden');
        // renderMasterDataUI(); (Akan kita pindahkan di tahap selanjutnya)
    } 
    else if(menuId === 'admin-guru') {
        document.getElementById('sec-admin-guru').classList.remove('hidden');
        renderTableGuru(); // Memanggil fungsi render tabel guru
    } 
    else if(menuId === 'admin-delete') {
        document.getElementById('sec-admin-delete').classList.remove('hidden');
    }
    else if(menuId === 'admin-backup') {
        document.getElementById('sec-admin-backup').classList.remove('hidden');
    }
    else if(menuId === 'nilai') {
        document.getElementById('sec-nilai').classList.remove('hidden');
        // renderTableNilai(); (Akan kita pindahkan di tahap selanjutnya)
    }
}

// Fungsi untuk membuat tombol menu sesuai role saat baru login
export function buildSidebarNav() {
    const appUser = getAppUser();
    const sidebarNav = document.getElementById('sidebar-nav');
    if (!sidebarNav || !appUser) return;

    let navHtml = `<button data-id="dashboard" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('dashboard')"><i class="ph ph-house text-xl text-blue-400"></i><span>Dashboard</span></button>`;
    
    if(appUser.role === 'admin') {
        navHtml += `
        <button data-id="admin-master" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('admin-master')"><i class="ph ph-database text-xl text-blue-400"></i><span>Kelola Master Data</span></button>
        <button data-id="admin-import" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('admin-import')"><i class="ph ph-users text-xl text-blue-400"></i><span>Kelola Data Siswa</span></button>
        <button data-id="admin-guru" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('admin-guru')"><i class="ph ph-users-three text-xl text-blue-400"></i><span>Kelola Data Guru</span></button>
        <button data-id="admin-delete" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('admin-delete')"><i class="ph ph-trash text-xl text-blue-400"></i><span>Hapus Data Kelas</span></button>
        <button data-id="admin-backup" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('admin-backup')"><i class="ph ph-hard-drives text-xl text-blue-400"></i><span>Backup & Restore</span></button>`;
    } else {
        navHtml += `
        <div class="pt-4 pb-2 px-5 text-xs font-bold text-blue-400 uppercase tracking-widest">Modul Akademik</div>
        <button data-id="nilai" class="nav-btn w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group text-blue-200 hover:bg-blue-800 hover:text-white" onclick="window.switchMenu('nilai')"><i class="ph ph-trend-up text-xl text-blue-400"></i><span>${appUser.role==='wakasek'?'Cek Rekap Nilai':'Input Nilai'}</span></button>`;
    }
    sidebarNav.innerHTML = navHtml;
}
