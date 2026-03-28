// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS } from '../services/db-master.js';

// --- STATE LOKAL TABEL ---
export let gradesData = [];
export let selClass = '';
export let selSubject = '';
export let wFilter = 'all';
export let editGradeId = null;
export let searchQuery = ''; // Untuk memfilter tampilan berdasarkan pencarian nama

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
                   <button onclick="window.openResetSandi('${u.id}', '${encodeURIComponent(u.username)}')" class="text-orange-500 hover:bg-orange-50 p-1.5 rounded mr-1" title="Reset Sandi"><i class="ph ph-key text-lg"></i></button>
                   <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:bg-blue-50 p-1.5 rounded mr-1" title="Edit Akun"><i class="ph ph-pencil-simple text-lg"></i></button>
                   <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Hapus Akun"><i class="ph ph-trash text-lg"></i></button>
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
    const btnAdd = document.getElementById('btn-add-siswa');
    
    if(!tbody || !filter) return;
    const cls = filter.value;

    if(!cls) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 font-medium">Silakan pilih kelas terlebih dahulu untuk melihat daftar siswa.</td></tr>';
        if(btnAdd) btnAdd.disabled = true;
        return;
    }
    if(btnAdd) btnAdd.disabled = false;

    const thn = getActiveTahun();
    const smt = getActiveSemester();

    // Ambil data siswa unik per kelas & periode
    const clsData = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
    const map = new Map();
    clsData.forEach(g => {
        const key = g.studentName + "_" + (g.nisn||'');
        if(!map.has(key)) map.set(key, { name: g.studentName, nisn: g.nisn, className: g.className });
    });
    const students = Array.from(map.values());

    tbody.innerHTML = students.map((s, i) => {
        const encN = encodeURIComponent(s.name);
        const encI = encodeURIComponent(s.nisn || '');
        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-center text-gray-500">${i+1}</td>
                <td class="p-3 font-medium text-gray-800">${s.name}</td>
                <td class="p-3 font-mono text-gray-500 text-sm">${s.nisn || '-'}</td>
                <td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase">${s.className}</span></td>
                <td class="p-3 text-right">
                    <button onclick="window.editSiswa('${encN}', '${encI}')" class="text-blue-500 hover:bg-blue-50 p-1.5 rounded mr-1"><i class="ph ph-pencil-simple text-lg"></i></button>
                    <button onclick="window.deleteSiswa('${encN}', '${encI}')" class="text-red-500 hover:bg-red-50 p-1.5 rounded"><i class="ph ph-trash text-lg"></i></button>
                </td>
            </tr>`;
    }).join('') || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Belum ada siswa di kelas ${cls} pada periode ini.</td></tr>`;
}

// ==========================================
// 3. LOGIKA FILTER & PENCARIAN DATA NILAI
// ==========================================
export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    
    // Filter berdasarkan Role
    if(appUser.role === 'guru') {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    // Filter berdasarkan Pilihan Dropdown
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    
    // Filter berdasarkan Kotak Pencarian Nama
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
    const statsCont = document.getElementById('stats-container');

    if(!appUser || !tableCont || !gradesTbody) return;

    // Sembunyikan tabel jika filter belum lengkap
    if(!selClass || (appUser.role === 'guru' && !selSubject)) {
        if(emptyState) emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        if(statsCont) statsCont.classList.add('hidden');
        return;
    }

    if(emptyState) emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');
    if(statsCont) statsCont.classList.remove('hidden');

    const d = getDisplayData();
    let countPass = 0, countRemed = 0;

    let html = d.map((item, idx) => {
        const calc = getCalc(item.scores);
        const finNum = parseFloat(calc.final);
        const isRemedial = finNum < 75.0; // KKM standar 75
        
        // Update Hitungan Statistik untuk UI
        if(isRemedial) countRemed++; else countPass++;

        const naColor = isRemedial ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20';
        const naIcon = isRemedial ? '<i class="ph ph-warning-circle text-red-500 mr-1" title="Di bawah KKM (75)"></i>' : '';

        // TAMPILAN UNTUK WAKASEK (Hanya Baca) atau SAAT EDIT SISWA
        if(appUser.role === 'wakasek' || editGradeId === item.id) {
            if(editGradeId !== item.id) {
                return `
                <tr class="hover:bg-blue-50/50 transition-colors print:bg-white border-b border-gray-100">
                    <td class="px-4 py-3 text-center text-gray-400 text-xs">${idx+1}</td>
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
            // TAMPILAN EDITABLE UNTUK GURU
            return `
            <tr data-id="${item.id}" class="hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                <td class="px-4 py-3 text-center text-gray-400 text-xs">${idx+1}</td>
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800">${item.studentName}</div>
                    <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                </td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f1" value="${ds(item.scores.f1)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f2" value="${ds(item.scores.f2)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="f3" value="${ds(item.scores.f3)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t1" value="${ds(item.scores.t1)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t2" value="${ds(item.scores.t2)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="t3" value="${ds(item.scores.t3)}" class="w-full border border-gray-200 rounded p-1 text-center text-sm outline-none focus:ring-1 focus:ring-blue-500"></td>
                <td class="px-1 py-3"><input type="number" min="0" max="100" data-f="asaj" value="${ds(item.scores.asaj)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm font-bold text-emerald-700 outline-none focus:ring-1 focus:ring-emerald-500"></td>
                <td class="px-4 py-3 text-center font-bold ${naColor} cell-na border-l border-gray-100">${naIcon}${finNum.toFixed(1)}</td>
                <td class="px-4 py-3 text-right print-hidden">
                    <div class="flex justify-end gap-1">
                        <button type="button" class="btn-edit p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit Identitas"><i class="ph ph-pencil-simple text-lg pointer-events-none"></i></button>
                        <button type="button" class="btn-del p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus Siswa"><i class="ph ph-trash text-lg pointer-events-none"></i></button>
                    </div>
                </td>
            </tr>`;
        }
    }).join('');

    // --- UPDATE UI STATISTIK KETUNTASAN ---
    const total = d.length;
    const percent = total > 0 ? Math.round((countPass / total) * 100) : 0;
    
    const statPercent = document.getElementById('stat-pass-percent');
    const statPassCount = document.getElementById('count-pass');
    const statRemedCount = document.getElementById('count-remed');

    if (statPercent) statPercent.textContent = `${percent}%`;
    if (statPassCount) statPassCount.textContent = `${countPass} Siswa`;
    if (statRemedCount) statRemedCount.textContent = `${countRemed} Siswa`;

    // Ambil baris form "Input Siswa Baru" jika ada
    const rowNewGrade = document.getElementById('row-new-grade');
    
    // Gabungkan: (Baris Input Baru) + (Baris Data Siswa)
    gradesTbody.innerHTML = (appUser.role === 'guru' ? (rowNewGrade?.outerHTML || '') : '') + (html || '<tr><td colspan="11" class="p-20 text-center text-gray-400 font-medium">Data tidak ditemukan atau belum diinput.</td></tr>');
    
    // Re-bind fungsi global
    window.renderTable = renderTable;
}

// ==========================================
// 5. RENDER MASTER DATA (KELAS & MAPEL)
// ==========================================
export function renderMasterDataUI() {
    const clsList = document.getElementById('master-class-list');
    const subList = document.getElementById('master-subject-list');
    
    if (clsList) {
        clsList.innerHTML = MASTER_CLASSES.map((c, i) => `
            <div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
                <span class="font-medium text-gray-700">${c}</span>
                <button onclick="window.deleteMasterClass(${i})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><i class="ph ph-trash text-lg"></i></button>
            </div>`).join('');
    }

    if (subList) {
        subList.innerHTML = MASTER_SUBJECTS.map((s, i) => `
            <div class="flex justify-between items-center p-2.5 bg-white border border-gray-200 rounded-lg mb-2 shadow-sm">
                <span class="font-medium text-gray-700">${s}</span>
                <button onclick="window.deleteMasterSubject(${i})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"><i class="ph ph-trash text-lg"></i></button>
            </div>`).join('');
    }
}

// ==========================================
// 6. POPULATE DROPDOWNS (SELECT OPTIONS)
// ==========================================
export function populateDropdowns() {
    const clsOpts = `<option value="">-- Pilih Kelas --</option>` + MASTER_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('');
    const subOpts = `<option value="">-- Pilih Mapel --</option>` + MASTER_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('');
    
    // Isi semua dropdown kelas di berbagai menu
    ['import-class-select', 'delete-class-select', 'filter-kelas', 'crud-siswa-kelas-filter'].forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.innerHTML = clsOpts; 
    });

    // Isi dropdown mata pelajaran
    const elMapel = document.getElementById('filter-mapel');
    if(elMapel) elMapel.innerHTML = subOpts;
}
