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
    
    // Tutup sidebar di HP jika sedang terbuka
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if(sidebar) sidebar.classList.add('-translate-x-full'); 
    if(sidebarOverlay) sidebarOverlay.classList.add('hidden');
    
    // Update tampilan tombol aktif di sidebar
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

    // Update Judul Halaman Atas sesuai menu
    const titles = { 
        'dashboard':'Dashboard Utama', 
        'admin-import':'Kelola Data Siswa', 
        'admin-master':'Kelola Master Data',
        'admin-delete':'Hapus Data Kelas', 
        'admin-guru':'Kelola Data Guru', 
        'admin-backup':'Backup & Restore Database', 
        'nilai': appUser.role === 'wakasek' ? 'Cek Rekap Nilai Guru' : 'Input Nilai' 
    };
    const pageTitle = document.getElementById('page-title');
    if(pageTitle) pageTitle.textContent = titles[menuId] || 'Si PINTAR';

    // Sembunyikan semua section terlebih dahulu
    ['sec-dashboard', 'sec-admin-import', 'sec-admin-delete', 'sec-nilai', 'sec-admin-guru', 'sec-admin-backup', 'sec-admin-master']
        .forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });

    // Tampilkan & RENDER section berdasarkan menu yang dipilih
    if(menuId === 'dashboard') {
        document.getElementById('sec-dashboard').classList.remove('hidden');
        
        // --- DYNAMIC DASHBOARD TEXT (MENGGANTIKAN LOGIKA MONOLITHIC PINTAR) ---
        const dashName = document.getElementById('dash-name');
        const dashDesc = document.getElementById('dash-desc');
        const dashActionBtn = document.getElementById('dash-action-btn');
        const userManual = document.getElementById('user-manual-content');
        
        if(dashName) dashName.textContent = appUser.username.split(',')[0];
        
        if(dashDesc) {
            dashDesc.textContent = appUser.role === 'wakasek' ? 'Pantau perkembangan akademik siswa dan aktivitas guru secara real-time.' : 
                                  (appUser.role === 'admin' ? 'Kelola data induk siswa dan distribusi kelas untuk seluruh mata pelajaran.' : 
                                  'Kelola nilai siswa dan administrasi rapor dengan lebih efisien dan terstruktur.');
        }
        
        if(dashActionBtn) {
            dashActionBtn.onclick = () => window.switchMenu(appUser.role === 'admin' ? 'admin-import' : 'nilai');
            dashActionBtn.innerHTML = appUser.role === 'admin' ? '<i class="ph ph-gear text-xl"></i> Kelola Data Siswa' : 
                                     (appUser.role === 'wakasek' ? '<i class="ph ph-file-text text-xl"></i> Cek Rekap Nilai' : '<i class="ph ph-pencil-simple text-xl"></i> Mulai Input Nilai');
        }

        if(userManual) {
            if(appUser.role==='admin') userManual.innerHTML = `<ul class="space-y-3"><li class="flex gap-3"><i class="ph ph-database text-purple-500 text-lg mt-0.5"></i><span><strong>Master Data:</strong> Atur penamaan kelas dan daftar mata pelajaran.</span></li><li class="flex gap-3"><i class="ph ph-gear text-blue-500 text-lg mt-0.5"></i><span><strong>Kelola Data Siswa:</strong> Tambah/Edit/Hapus data siswa, atau unggah Excel masal.</span></li><li class="flex gap-3"><i class="ph ph-users-three text-purple-500 text-lg mt-0.5"></i><span><strong>Kelola Data Guru:</strong> Menambahkan dan mengedit profil login pengguna aplikasi secara manual maupun massal.</span></li><li class="flex gap-3"><i class="ph ph-hard-drives text-emerald-500 text-lg mt-0.5"></i><span><strong>Backup, Restore & Reset:</strong> Unduh cadangan JSON, pulihkan data, atau reset total database sekolah.</span></li></ul>`;
            else if(appUser.role==='wakasek') userManual.innerHTML = `<ul class="space-y-3"><li class="flex gap-3"><i class="ph ph-funnel text-blue-500 text-lg mt-0.5"></i><span><strong>Monitor & Filter:</strong> Gunakan filter untuk melihat rekap spesifik sesuai tahun & semester yang dipilih saat login.</span></li><li class="flex gap-3"><i class="ph ph-file-xls text-emerald-500 text-lg mt-0.5"></i><span><strong>Export Excel:</strong> Klik tombol Export Excel untuk mendownload rekap nilai menjadi format .xlsx ke komputer Anda.</span></li></ul>`;
            else userManual.innerHTML = `<ul class="space-y-3"><li class="flex gap-3"><i class="ph ph-file-xls text-emerald-500 text-lg mt-0.5"></i><span><strong>Import Nilai Excel:</strong> Unduh Format Nilai di pojok kanan atas tabel, isi angkanya secara offline, lalu Import kembali ke sistem. Cepat dan mudah!</span></li><li class="flex gap-3"><i class="ph ph-pencil-simple text-blue-500 text-lg mt-0.5"></i><span><strong>Mengisi Manual:</strong> Ketik angka langsung di tabel, nilai otomatis tersimpan ke cloud saat pindah kotak. Nilai yang kurang dari KKM (75) akan berwarna <span class="text-red-600 font-bold">merah</span>.</span></li></ul>`;
        }
    } 
    else if(menuId === 'admin-import') {
        document.getElementById('sec-admin-import').classList.remove('hidden');
        renderTableSiswa(); 
    } 
    else if(menuId === 'admin-master') {
        document.getElementById('sec-admin-master').classList.remove('hidden');
    } 
    else if(menuId === 'admin-guru') {
        document.getElementById('sec-admin-guru').classList.remove('hidden');
        renderTableGuru(); 
    } 
    else if(menuId === 'admin-delete') {
        document.getElementById('sec-admin-delete').classList.remove('hidden');
    }
    else if(menuId === 'admin-backup') {
        document.getElementById('sec-admin-backup').classList.remove('hidden');
    }
    else if(menuId === 'nilai') {
        document.getElementById('sec-nilai').classList.remove('hidden');
        
        // --- LOGIKA MENYEMBUNYIKAN FILTER GURU ---
        const fGuruWrap = document.getElementById('filter-guru-wrapper');
        if (fGuruWrap) {
            if (appUser.role === 'wakasek') {
                fGuruWrap.classList.remove('hidden');
            } else {
                fGuruWrap.classList.add('hidden');
            }
        }

        if (typeof window.renderTable === 'function') {
            window.renderTable();
        }
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
