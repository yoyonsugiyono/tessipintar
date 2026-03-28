// File: js/ui/navigation.js

import { appUser } from '../services/auth.js';

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
    if (!appUser) return;
    
    // Tutup sidebar jika di HP
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if(sidebar) sidebar.classList.add('-translate-x-full'); 
    if(sidebarOverlay) sidebarOverlay.classList.add('hidden');
    
    // Update warna tombol navigasi di sidebar
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

    // Update Judul Halaman Atas
    const pageTitle = document.getElementById('page-title');
    const titles = { 
        'dashboard':'Dashboard Utama', 
        'admin-import':'Kelola Data Siswa', 
        'admin-master':'Kelola Master Data',
        'admin-delete':'Hapus Data Kelas', 
        'admin-guru':'Kelola Data Guru', 
        'admin-backup':'Backup & Restore Database', 
        'nilai': appUser.role === 'wakasek' ? 'Cek Rekap Nilai Guru' : 'Input Nilai' 
    };
    if(pageTitle) pageTitle.textContent = titles[menuId] || 'Si PINTAR';

    // Sembunyikan semua konten section terlebih dahulu
    const sections = ['sec-dashboard', 'sec-admin-import', 'sec-admin-delete', 'sec-nilai', 'sec-admin-guru', 'sec-admin-backup', 'sec-admin-master'];
    sections.forEach(secId => {
        const el = document.getElementById(secId);
        if (el) el.classList.add('hidden');
    });

    // Tampilkan hanya section yang dipilih
    const activeMap = {
        'dashboard': 'sec-dashboard',
        'admin-import': 'sec-admin-import',
        'admin-master': 'sec-admin-master',
        'admin-delete': 'sec-admin-delete',
        'admin-guru': 'sec-admin-guru',
        'admin-backup': 'sec-admin-backup',
        'nilai': 'sec-nilai'
    };
    const activeEl = document.getElementById(activeMap[menuId]);
    if(activeEl) activeEl.classList.remove('hidden');

    // Update teks khusus di halaman Dashboard
    if(menuId === 'dashboard') {
        const dashName = document.getElementById('dash-name');
        const dashDesc = document.getElementById('dash-desc');
        const dashActionBtn = document.getElementById('dash-action-btn');
        
        if(dashName) dashName.textContent = appUser.username.split(',')[0];
        if(dashDesc) dashDesc.textContent = appUser.role==='wakasek' ? 'Pantau perkembangan akademik siswa dan aktivitas guru secara real-time.' : (appUser.role==='admin' ? 'Kelola data induk siswa dan distribusi kelas untuk seluruh mata pelajaran.' : 'Kelola nilai siswa dan administrasi rapor dengan lebih efisien dan terstruktur.');
        if(dashActionBtn) {
            dashActionBtn.onclick = () => switchMenu(appUser.role==='admin' ? 'admin-import' : 'nilai');
            dashActionBtn.innerHTML = appUser.role==='admin' ? '<i class="ph ph-gear"></i> Kelola Data Siswa' : (appUser.role==='wakasek' ? '<i class="ph ph-file-text"></i> Cek Rekap Nilai' : '<i class="ph ph-pencil-simple"></i> Mulai Input Nilai');
        }
    }
}

// Fungsi untuk membuat tombol menu sesuai role saat baru login
export function buildSidebarNav() {
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
