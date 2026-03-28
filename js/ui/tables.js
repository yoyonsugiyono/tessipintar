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

// Setter yang dipanggil dari db-grades.js saat ada data baru
export function setGradesData(data) {
    gradesData = data;
}
export function setEditGradeId(id) { editGradeId = id; }
export function setFilters(c, s, w) { selClass = c; selSubject = s; wFilter = w; }

// ==========================================
// 1. RENDER TABEL GURU (ADMIN)
// ==========================================
export function renderTableGuru() {
    const crudGuruTbody = document.getElementById('crud-guru-tbody');
    if(!crudGuruTbody) return;
    
    let html = '';
    USERS_DB.forEach((u, i) => {
        const roleColor = u.role === 'admin' ? 'text-red-600' : (u.role === 'wakasek' ? 'text-purple-600' : 'text-blue-600');
        html += `<tr class="border-b hover:bg-gray-50 transition-colors">
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
    });
    crudGuruTbody.innerHTML = html || '<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada data pengguna</td></tr>';
}

// ==========================================
// 2. RENDER TABEL SISWA (ADMIN)
// ==========================================
export function renderTableSiswa() {
    const crudSiswaTbody = document.getElementById('crud-siswa-tbody');
    const crudSiswaKelasFilter = document.getElementById('crud-siswa-kelas-filter');
    const btnAddSiswa = document.getElementById('btn-add-siswa');
    
    if(!crudSiswaTbody || !crudSiswaKelasFilter) return;
    
    const cls = crudSiswaKelasFilter.value;
    if(!cls) {
        crudSiswaTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Pilih kelas pada menu di atas terlebih dahulu.</td></tr>';
        if(btnAddSiswa) btnAddSiswa.disabled = true;
        return;
    }
    if(btnAddSiswa) btnAddSiswa.disabled = false;

    const thn = getActiveTahun();
    const smt = getActiveSemester();

    const clsData = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
    const map = new Map();
    clsData.forEach(g => {
        const key = g.studentName + "_" + (g.nisn||'');
        if(!map.has(key)) map.set(key, { name: g.studentName, nisn: g.nisn, className: g.className });
    });
    const students = Array.from(map.values());

    let html = '';
    students.forEach((s, i) => {
        const encName = encodeURIComponent(s.name);
        const encNisn = encodeURIComponent(s.nisn || '');
        html += `<tr class="border-b hover:bg-gray-50 transition-colors">
            <td class="p-3 text-center text-gray-500">${i+1}</td>
            <td class="p-3 font-medium text-gray-800">${s.name}</td>
            <td class="p-3 font-mono text-gray-500">${s.nisn||'-'}</td>
            <td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">${s.className}</span></td>
            <td class="p-3 text-right">
                <button onclick="window.editSiswa('${encName}', '${encNisn}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Edit Siswa"><i class="ph ph-pencil-simple text-lg"></i></button>
                <button onclick="window.deleteSiswa('${encName}', '${encNisn}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Siswa"><i class="ph ph-trash text-lg"></i></button>
            </td>
        </tr>`;
    });
    crudSiswaTbody.innerHTML = html || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Tidak ada data siswa untuk kelas ${cls} pada periode ini.</td></tr>`;
}

// ==========================================
// 3. RENDER TABEL NILAI (GURU & WAKASEK)
// ==========================================
export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    
    // Filter Guru (Hanya melihat mapel miliknya atau admin)
    if(appUser.role === 'guru') {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    
    return d;
}

export function renderTable() {
    const appUser = getAppUser();
    const emptyState = document.getElementById('empty-state-nilai');
    const tableCont = document.getElementById('table-container');
    const gradesTbody = document.getElementById('grades-tbody');
    const rowNewGrade = document.getElementById('row-new-grade');
    
    if(!appUser || !emptyState || !tableCont || !gradesTbody) return;

    // Cek apakah Mapel & Kelas sudah dipilih
    if(!selClass || (appUser.role === 'guru' && !selSubject)) {
        emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');
    
    // Update Badges & UI
    const badgeGuru = document.getElementById('badge-guru');
    const badgeKelas = document.getElementById('badge-kelas');
    const badgeMapel = document.getElementById('badge-mapel');
    const weightsCont = document.getElementById('weights-container');
    const guruExcelActions = document.getElementById('guru-excel-actions');
    
    if(appUser.role === 'wakasek' && badgeGuru) { 
        badgeGuru.classList.remove('hidden'); 
        badgeGuru.textContent = wFilter === 'all' ? 'Semua Guru' : wFilter; 
    }
    if(badgeKelas) badgeKelas.textContent = selClass;
    if(badgeMapel) badgeMapel.textContent = selSubject || 'Semua Mapel';
    
    if(appUser.role === 'guru') {
        if(weightsCont) weightsCont.classList.remove('hidden');
        if(!editGradeId && rowNewGrade) rowNewGrade.classList.remove('hidden');
        if(guruExcelActions) guruExcelActions.classList.remove('hidden');
    } else {
        if(guruExcelActions) guruExcelActions.classList.add('hidden');
    }

    // Bangun HTML Baris Nilai
    let html = '';
    const d = getDisplayData();
    
    if(d.length === 0) {
        html = `<tr><td colspan="11" class="px-4 py-12 text-center text-gray-400">Belum ada data nilai.</td></tr>`;
    } else {
        d.forEach((item, idx) => {
            const fin = getCalc(item.scores).final;
            const bgA = 'bg-emerald-50/50 text-emerald-700 font-bold';
            
            // Logika KKM Merah (< 75)
            const isRemedial = parseFloat(fin) < 75.0;
            const naColor = isRemedial ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20';
            const naIcon = isRemedial ? '<i class="ph ph-warning-circle text-red-500 mr-1" title="Di bawah KKM (75)"></i>' : '';

            // Tampilan Read-Only (Wakasek / Saat sedang diedit)
            if(appUser.role === 'wakasek' || editGradeId === item.id) {
                if(editGradeId !== item.id) {
                    html += `<tr class="hover:bg-blue-50/50 transition-colors print:bg-white">
                        <td class="px-4 py-3 text-gray-500 text-center">${idx+1}</td>
                        <td class="px-4 py-3">
                            <div class="font-medium text-gray-800">${item.studentName}</div>
                            <div class="text-xs text-gray-400">${item.nisn||'-'}</div>
                            ${appUser.role==='wakasek'?`<div class="text-xs text-blue-500 mt-1">${item.teacherName} | ${item.subject}</div>`:''}
                        </td>
                        <td class="px-4 py-3 text-center">${ds(item.scores.f1)}</td><td class="px-4 py-3 text-center">${ds(item.scores.f2)}</td><td class="px-4 py-3 text-center">${ds(item.scores.f3)}</td>
                        <td class="px-4 py-3 text-center">${ds(item.scores.t1)}</td><td class="px-4 py-3 text-center">${ds(item.scores.t2)}</td><td class="px-4 py-3 text-center">${ds(item.scores.t3)}</td>
                        <td class="px-4 py-3 text-center font-bold text-emerald-700">${ds(item.scores.asaj)}</td>
                        <td class="px-4 py-3 text-center font-bold ${naColor}">${naIcon}${fin}</td>
                    </tr>`;
                }
            } else {
                // Tampilan Editable (Guru)
                html += `<tr data-id="${item.id}" class="hover:bg-blue-50/50 transition-colors print:bg-white">
                    <td class="px-4 py-3 text-gray-500 text-center">${idx+1}</td>
                    <td class="px-4 py-3"><div class="font-medium text-gray-800">${item.studentName}</div><div class="text-xs text-gray-400 font-mono">${item.nisn||'-'}</div></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="f1" value="${ds(item.scores.f1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="f2" value="${ds(item.scores.f2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="f3" value="${ds(item.scores.f3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="t1" value="${ds(item.scores.t1)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="t2" value="${ds(item.scores.t2)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="t3" value="${ds(item.scores.t3)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500"></td>
                    <td class="px-2 py-3"><input type="number" min="0" max="100" data-f="asaj" value="${ds(item.scores.asaj)}" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none focus:border-blue-500 ${bgA}"></td>
                    <td class="px-4 py-3 text-center font-bold ${naColor} cell-na">${naIcon}${fin}</td>
                    <td class="px-4 py-3 text-right print-hidden"><div class="flex justify-end gap-1">
                        <button type="button" class="btn-edit p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data Siswa"><i class="ph ph-book-open text-lg pointer-events-none"></i></button>
                        <button type="button" class="btn-del p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Siswa"><i class="ph ph-trash text-lg pointer-events-none"></i></button>
                    </div></td>
                </tr>`;
            }
        });
    }
    
    // Inject HTML (Sisipkan di bawah Form Input Baru)
    const newRowHTML = rowNewGrade ? rowNewGrade.outerHTML : '';
    gradesTbody.innerHTML = (appUser.role === 'guru' ? newRowHTML : '') + html;
    
    // Jadikan Tabel Global agar mudah diakses file lain
    window.renderTable = renderTable;
}
