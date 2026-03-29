// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, DEFAULT_TAHUN } from '../services/db-master.js';

export let gradesData = [];
export let selClass = '';
export let selSubject = '';
export let wFilter = 'all';
export let editGradeId = null;
export let searchQuery = ''; 

export function setGradesData(data) { gradesData = data; }
export function setEditGradeId(id) { editGradeId = id; }
export function setSearchQuery(q) { searchQuery = q.toLowerCase(); }
export function setFilters(c, s, w) { selClass = c; selSubject = s; wFilter = w; }

export function renderTableGuru() {
    const tbody = document.getElementById('crud-guru-tbody');
    if(!tbody) return;

    tbody.innerHTML = USERS_DB.map((u, i) => {
        const isWali = u.jabatan === 'Wali Kelas';
        const roleColor = u.role === 'admin' ? 'text-red-600' : 'text-blue-600';
        
        // Tampilkan label jabatan & kelas asuhan dengan cantik
        const jabatanHtml = `
            <div class="font-bold uppercase tracking-wider ${roleColor}">${u.role}</div>
            <div class="text-xs text-gray-500 mt-0.5">
                ${u.jabatan || 'Guru Mapel'} ${isWali && u.waliKelas ? `<span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-bold">${u.waliKelas}</span>` : ''}
            </div>
        `;

        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-center text-gray-500">${i+1}</td>
                <td class="p-3 font-medium text-gray-800">${u.username}</td>
                <td class="p-3 text-[10px]">${jabatanHtml}</td>
                <td class="p-3 font-mono text-gray-400 text-xs">${u.password}</td>
                <td class="p-3 text-right whitespace-nowrap">
                   <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Edit Jabatan & Akun"><i class="ph ph-pencil-simple text-lg"></i></button>
                   <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Akun"><i class="ph ph-trash text-lg"></i></button>
                </td>
            </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada data pengguna.</td></tr>';
}

export function renderTableSiswa() {
    const tbody = document.getElementById('crud-siswa-tbody');
    const filter = document.getElementById('crud-siswa-kelas-filter');
    const appUser = getAppUser();
    
    if(!tbody || !filter || !appUser) return;
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    let clsData = gradesData.filter(g => g.tahun === thn && g.semester === smt);

    // KUNCI WALI KELAS: Hanya tampilkan data kelas asuhannya
    if (appUser.jabatan === 'Wali Kelas' && appUser.waliKelas) {
        clsData = clsData.filter(g => g.className === appUser.waliKelas);
    } else if (filter.value) {
        clsData = clsData.filter(g => g.className === filter.value);
    }

    const map = new Map();
    clsData.forEach(g => {
        const key = g.studentName + "_" + (g.nisn||'') + "_" + g.className;
        if(!map.has(key)) map.set(key, { name: g.studentName, nisn: g.nisn, className: g.className });
    });
    const students = Array.from(map.values());

    tbody.innerHTML = students.map((s, i) => {
        const encN = encodeURIComponent(s.name);
        const encI = encodeURIComponent(s.nisn || '');
        const encC = encodeURIComponent(s.className);
        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-center text-gray-500">${i+1}</td>
                <td class="p-3 font-medium text-gray-800">${s.name}</td>
                <td class="p-3 font-mono text-gray-500 text-sm">${s.nisn || '-'}</td>
                <td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase">${s.className}</span></td>
                <td class="p-3 text-right whitespace-nowrap">
                    <button onclick="window.editSiswa('${encN}', '${encI}', '${encC}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-1" title="Edit Siswa"><i class="ph ph-pencil-simple text-lg"></i></button>
                    <button onclick="window.deleteSiswa('${encN}', '${encI}', '${encC}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Siswa"><i class="ph ph-trash text-lg"></i></button>
                </td>
            </tr>`;
    }).join('') || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada data siswa ditemukan pada kelas ini.</td></tr>`;
}

export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    
    // Guru Mapel & Wali Kelas: Hanya melihat nilai miliknya, Wakasek/Admin: Lihat Semua
    if (appUser.role === 'guru' && appUser.jabatan !== 'Wakasek Kurikulum') {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    if(searchQuery) d = d.filter(g => g.studentName.toLowerCase().includes(searchQuery));
    
    return d;
}

export function renderTable() {
    // ... [Isi fungsi renderTable persis sama seperti sebelumnya, tidak ada perubahan] ...
    // (Karena instruksinya terlalu panjang, Anda tidak perlu mengubah fungsi renderTable ini jika sudah bagus)
}

export function renderMasterDataUI() {
    // ... [Isi fungsi renderMasterDataUI persis sama seperti sebelumnya] ...
}

export function populateDropdowns() {
    const appUser = getAppUser();
    if (!appUser) return;

    // 1. Opsi Tahun Ajaran
    const allTahun = [...new Set([...DEFAULT_TAHUN, ...MASTER_TAHUN])].sort();
    const thnOpts = allTahun.map(t => `<option value="${t}">${t}</option>`).join('');
    ['login-tahun', 'dash-filter-tahun', 'copy-tahun-asal'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { const oldVal = el.value; el.innerHTML = thnOpts; if (oldVal && allTahun.includes(oldVal)) el.value = oldVal; }
    });

    // 2. KUNCI DROPDOWN KELAS UNTUK WALI KELAS
    const dbClasses = [...new Set(gradesData.map(g => g.className))].filter(Boolean);
    let allClasses = [...new Set([...MASTER_CLASSES, ...dbClasses])].sort();
    
    // Jika user adalah Wali Kelas, paksa dropdown kelas HANYA berisi kelas miliknya
    if (appUser.jabatan === 'Wali Kelas' && appUser.waliKelas) {
        allClasses = [appUser.waliKelas];
    }

    const dbSubjects = [...new Set(gradesData.map(g => g.subject))].filter(Boolean);
    const allMapel = [...new Set([...MASTER_SUBJECTS, ...dbSubjects])].sort();

    const clsOptsPilih = `<option value="">-- Pilih Kelas --</option>` + allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    const clsOptsSemua = `<option value="">-- Semua Kelas --</option>` + allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    const subOpts = `<option value="">-- Pilih Mapel --</option>` + allMapel.map(s => `<option value="${s}">${s}</option>`).join('');
    
    ['import-class-select', 'delete-class-select', 'copy-class-asal', 'copy-class-tujuan'].forEach(id => { 
        const el = document.getElementById(id); 
        if(el) { const v = el.value; el.innerHTML = clsOptsPilih; el.value = v; }
    });

    ['filter-kelas', 'crud-siswa-kelas-filter'].forEach(id => { 
        const el = document.getElementById(id); 
        if(el) { const v = el.value; el.innerHTML = clsOptsSemua; el.value = v; }
    });

    const elMapel = document.getElementById('filter-mapel');
    if(elMapel) { const v = elMapel.value; elMapel.innerHTML = subOpts; elMapel.value = v; }
}
