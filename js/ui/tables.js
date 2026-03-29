// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, DEFAULT_TAHUN } from '../services/db-master.js';

// --- STATE LOKAL TABEL ---
export let gradesData = [];
export let selClass = '';
export let selSubject = '';
export let wFilter = 'all';
export let editGradeId = null;
export let searchQuery = ''; 

// --- SETTER UNTUK STATE ---
export function setGradesData(data) { gradesData = data; }
export function setEditGradeId(id) { editGradeId = id; }
export function setSearchQuery(q) { searchQuery = q.toLowerCase(); }
export function setFilters(c, s, w) { 
    selClass = c; 
    selSubject = s; 
    wFilter = w; 
}

// ==========================================
// 1. RENDER TABEL GURU (KHUSUS ADMIN)
// ==========================================
export function renderTableGuru() {
    const tbody = document.getElementById('crud-guru-tbody');
    if(!tbody) return;

    tbody.innerHTML = USERS_DB.map((u, i) => {
        const roleColor = u.role === 'admin' ? 'text-red-600' : (u.role === 'wakasek' ? 'text-purple-600' : 'text-blue-600');
        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-center text-gray-500">${i+1}</td>
                <td class="p-3 font-medium text-gray-800">${u.username}</td>
                <td class="p-3 uppercase text-[10px] font-bold tracking-wider ${roleColor}">${u.role}</td>
                <td class="p-3 font-mono text-gray-400 text-xs">${u.password}</td>
                <td class="p-3 text-right whitespace-nowrap">
                   <button onclick="window.openResetSandi('${u.id}', '${encodeURIComponent(u.username)}')" class="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 p-1.5 rounded transition-colors mr-2" title="Reset Sandi Pengguna"><i class="ph ph-key text-lg"></i></button>
                   <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Edit Akun"><i class="ph ph-pencil-simple text-lg"></i></button>
                   <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Akun"><i class="ph ph-trash text-lg"></i></button>
                </td>
            </tr>`;
    }).join('') || '<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada data pengguna terdaftar.</td></tr>';
}

// ==========================================
// 2. RENDER TABEL SISWA (KHUSUS ADMIN)
// ==========================================
export function renderTableSiswa() {
    const tbody = document.getElementById('crud-siswa-tbody');
    const filter = document.getElementById('crud-siswa-kelas-filter');
    const btnAddSiswa = document.getElementById('btn-add-siswa');
    
    if(!tbody || !filter) return;
    
    const cls = filter.value; 
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let clsData = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    
    if (cls) {
        clsData = clsData.filter(g => g.className === cls);
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
    }).join('') || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada data siswa ditemukan pada periode ini.</td></tr>`;

    // Mengatur status tombol Tambah Siswa
    if (btnAddSiswa) {
        if (!cls) {
            btnAddSiswa.disabled = true;
            btnAddSiswa.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnAddSiswa.disabled = false;
            btnAddSiswa.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

// ==========================================
// 3. LOGIKA FILTER & PENCARIAN DATA NILAI
// ==========================================
export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    
    if(appUser.role === 'guru') {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    
    if(searchQuery) {
        d = d.filter(g => g.studentName.toLowerCase().includes(searchQuery));
    }
    
    return d;
}

// ==========================================
// 4. RENDER TABEL NILAI UTAMA (GURU & WAKASEK)
// ==========================================
export function renderTable() {
    const appUser = getAppUser();
    const tableCont = document.getElementById('table-container');
    const gradesTbody = document.getElementById('grades-tbody');
    const emptyState = document.getElementById('empty-state-nilai');

    if(!appUser || !tableCont || !gradesTbody) return;

    // Sembunyikan tabel jika kelas/mapel belum dipilih
    if(!selClass || (appUser.role === 'guru' && !selSubject)) {
        if(emptyState) emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        return;
    }

    // Tampilkan tabel
    if(emptyState) emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');

    // Update Badges UI
    if(document.getElementById('badge-guru')) {
        document.getElementById('badge-guru').classList.toggle('hidden', appUser.role === 'guru');
        document.getElementById('badge-guru').textContent = wFilter === 'all' ? 'Semua Guru' : wFilter;
    }
    if(document.getElementById('badge-kelas')) document.getElementById('badge-kelas').textContent = selClass;
    if(document.getElementById('badge-mapel')) document.getElementById('badge-mapel').textContent = selSubject || 'Semua Mapel';
    
    // Tampilkan tombol khusus Guru
    if(appUser.role === 'guru') {
        document.getElementById('weights-container')?.classList.remove('hidden');
        document.getElementById('guru-excel-actions')?.classList.remove('hidden');
        document.querySelectorAll('.guru-col').forEach(c => c.classList.remove('hidden'));
    } else {
        document.getElementById('weights-container')?.classList.add('hidden');
        document.getElementById('guru-excel-actions')?.classList.add('hidden');
        document.querySelectorAll('.guru-col').forEach(c => c.classList.add('hidden'));
    }

    const d = getDisplayData();
    let countPass = 0, countRemed = 0;
    let html = '';

    if (d.length === 0) {
        html = `<tr><td colspan="11" class="px-4 py-12 text-center text-gray-400 font-medium">Belum ada data nilai/siswa di kelas ini.</td></tr>`;
    } else {
        d.forEach((item, idx) => {
            const calc = getCalc(item.scores);
            const finNum = parseFloat(calc.final);
            const isRemedial = finNum < 75.0; 
            
            if(isRemedial) countRemed++; else countPass++;

            const naColor = isRemedial ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20';
            const naIcon = isRemedial ? '<i class="ph ph-warning-circle text-red-500 mr-1" title="Di bawah KKM (75)"></i>' : '';
            const bgA = 'bg-emerald-50/50 text-emerald-700 font-bold';

            if(appUser.role === 'wakasek' || editGradeId === item.id) {
                // Tampilan Read-Only (Wakasek / Saat Baris Sedang Diedit)
                if(editGradeId !== item.id) {
                    html += `
                    <tr class="hover:bg-blue-50/50 border-b border-gray-100 transition-colors print:bg-white">
                        <td class="px-4 py-3 text-center text-gray-500 text-xs">${idx+1}</td>
                        <td class="px-4 py-3">
                            <div class="font-bold text-gray-800">${item.studentName}</div>
                            <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                            ${appUser.role==='wakasek' ? `<div class="text-[9px] text-blue-500 font-bold uppercase mt-1">${item.teacherName} | ${item.subject}</div>` : ''}
                        </td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.f1)}</td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.f2)}</td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.f3)}</td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.t1)}</td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.t2)}</td>
                        <td class="px-2 py-3 text-center text-sm">${ds(item.scores.t3)}</td>
                        <td class="px-2 py-3 text-center font-bold text-emerald-700">${ds(item.scores.asaj)}</td>
                        <td class="px-4 py-3 text-center font-bold ${naColor} border-l border-gray-100">${naIcon}${finNum.toFixed(1)}</td>
                    </tr>`;
                }
            } else {
                // Tampilan Editable untuk Guru
                html += `
                <tr data-id="${item.id}" class="hover:bg-blue-50/50 border-b border-gray-100 transition-colors print:bg-white">
                    <td class="px-4 py-3 text-center text-gray-500 text-xs">${idx+1}</td>
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-800">${item.studentName}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                    </td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f1" value="${ds(item.scores.f1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f2" value="${ds(item.scores.f2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f3" value="${ds(item.scores.f3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t1" value="${ds(item.scores.t1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t2" value="${ds(item.scores.t2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t3" value="${ds(item.scores.t3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="asaj" value="${ds(item.scores.asaj)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500 ${bgA}"></td>
                    <td class="px-4 py-3 text-center font-bold ${naColor} cell-na border-l border-gray-100">${naIcon}${finNum.toFixed(1)}</td>
                    <td class="px-4 py-3 text-right print-hidden">
                        <div class="flex justify-end gap-1">
                            <button type="button" class="btn-edit p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Data Siswa"><i class="ph ph-book-open text-lg pointer-events-none"></i></button>
                            <button type="button" class="btn-del p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus Siswa"><i class="ph ph-trash text-lg pointer-events-none"></i></button>
                        </div>
                    </td>
                </tr>`;
            }
        });
    }

    const total = d.length;
    const percent = total > 0 ? Math.round((countPass / total) * 100) : 0;
    
    if (document.getElementById('stat-pass-percent')) document.getElementById('stat-pass-percent').textContent = `${percent}%`;
    if (document.getElementById('count-pass')) document.getElementById('count-pass').textContent = `${countPass} Siswa`;
    if (document.getElementById('count-remed')) document.getElementById('count-remed').textContent = `${countRemed} Siswa`;

    // Ambil baris HTML untuk "Input Siswa Baru" (Jika ada)
    const rowNewGrade = document.getElementById('row-new-grade');
    const newRowHTML = rowNewGrade ? rowNewGrade.outerHTML : '';

    // Gabungkan baris baru + baris data siswa
    gradesTbody.innerHTML = (appUser.role === 'guru' ? newRowHTML : '') + html;
    
    // Pastikan baris baru dimunculkan (jika tidak sedang mode edit)
    const rowNewGradeAfter = document.getElementById('row-new-grade');
    if(rowNewGradeAfter && !editGradeId && appUser.role === 'guru') {
        rowNewGradeAfter.classList.remove('hidden');
    }
    
    window.renderTable = renderTable;
}

// ==========================================
// 5. RENDER MASTER DATA (KELAS & MAPEL)
// ==========================================
export function renderMasterDataUI() {
    const thnList = document.getElementById('master-tahun-list');
    const clsList = document.getElementById('master-class-list');
    const subList = document.getElementById('master-subject-list');
    
    if (thnList) {
        thnList.innerHTML = MASTER_TAHUN.map((t, i) => `
            <div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
                <span class="font-medium text-blue-700">${t}</span>
                <button onclick="window.deleteMasterTahun(${i})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"><i class="ph ph-trash text-lg"></i></button>
            </div>`).join('') || '<div class="text-xs text-gray-400 text-center italic mt-2">Belum ada tahun tambahan.</div>';
    }

    if (clsList) {
        clsList.innerHTML = MASTER_CLASSES.map((c, i) => `
            <div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
                <span class="font-medium text-gray-700">${c}</span>
                <button onclick="window.deleteMasterClass(${i})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"><i class="ph ph-trash text-lg"></i></button>
            </div>`).join('') || '<div class="text-xs text-gray-400 text-center italic mt-2">Belum ada data kelas.</div>';
    }

    if (subList) {
        subList.innerHTML = MASTER_SUBJECTS.map((s, i) => `
            <div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
                <span class="font-medium text-gray-700">${s}</span>
                <button onclick="window.deleteMasterSubject(${i})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"><i class="ph ph-trash text-lg"></i></button>
            </div>`).join('') || '<div class="text-xs text-gray-400 text-center italic mt-2">Belum ada data mata pelajaran.</div>';
    }
}

// ==========================================
// 6. POPULATE DROPDOWNS (SELECT OPTIONS)
// ==========================================
export function populateDropdowns() {
    // 1. Opsi Tahun Ajaran
    const allTahun = [...new Set([...DEFAULT_TAHUN, ...MASTER_TAHUN])].sort();
    const thnOpts = allTahun.map(t => `<option value="${t}">${t}</option>`).join('');
    
    ['login-tahun', 'dash-filter-tahun', 'copy-tahun-asal'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const oldVal = el.value;
            el.innerHTML = thnOpts;
            if (oldVal && allTahun.includes(oldVal)) el.value = oldVal;
        }
    });

    // 2. FALLBACK CERDAS: Gabung Master Data + Data Riil Siswa
    const dbClasses = [...new Set(gradesData.map(g => g.className))].filter(Boolean);
    const dbSubjects = [...new Set(gradesData.map(g => g.subject))].filter(Boolean);

    const allClasses = [...new Set([...MASTER_CLASSES, ...dbClasses])].sort();
    const allMapel = [...new Set([...MASTER_SUBJECTS, ...dbSubjects])].sort();

    const clsOptsPilih = `<option value="">-- Pilih Kelas --</option>` + allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    const clsOptsSemua = `<option value="">-- Semua Kelas --</option>` + allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    const subOpts = `<option value="">-- Pilih Mapel --</option>` + allMapel.map(s => `<option value="${s}">${s}</option>`).join('');
    
    // Pertahankan nilai yang sedang dipilih agar tidak melompat-lompat
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
