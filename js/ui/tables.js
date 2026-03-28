// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS } from '../services/db-master.js';

// --- STATE LOKAL TABEL (DIPERLUKAN UNTUK EXPORT) ---
export let gradesData = [];
export let selClass = '';
export let selSubject = '';
export let wFilter = 'all';
export let editGradeId = null;

export function setGradesData(data) { gradesData = data; }
export function setEditGradeId(id) { editGradeId = id; }
export function setFilters(c, s, w) { 
    selClass = c; 
    selSubject = s; 
    wFilter = w; 
}

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
               <button onclick="window.openResetSandi('${u.id}', '${encodeURIComponent(u.username)}')" class="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 p-1.5 rounded mr-2"><i class="ph ph-key text-lg"></i></button>
               <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded mr-2"><i class="ph ph-pencil-simple text-lg"></i></button>
               <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded"><i class="ph ph-trash text-lg"></i></button>
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
        crudSiswaTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">Pilih kelas terlebih dahulu.</td></tr>';
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
        html += `<tr class="border-b hover:bg-gray-50 transition-colors"><td class="p-3 text-center text-gray-500">${i+1}</td><td class="p-3 font-medium text-gray-800">${s.name}</td><td class="p-3 font-mono text-gray-500">${s.nisn||'-'}</td><td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">${s.className}</span></td><td class="p-3 text-right"><button onclick="window.editSiswa('${encName}', '${encNisn}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded mr-2"><i class="ph ph-pencil-simple text-lg"></i></button><button onclick="window.deleteSiswa('${encName}', '${encNisn}')" class="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded"><i class="ph ph-trash text-lg"></i></button></td></tr>`;
    });
    crudSiswaTbody.innerHTML = html || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Data kosong.</td></tr>`;
}

// ==========================================
// 3. RENDER TABEL NILAI (GURU & WAKASEK)
// ==========================================
export function getDisplayData() {
    const appUser = getAppUser();
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    let d = gradesData.filter(g => g.tahun === thn && g.semester === smt);
    if(appUser.role === 'guru') d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
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

    if(!selClass || (appUser.role === 'guru' && !selSubject)) {
        emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');
    
    const d = getDisplayData();
    let html = '';
    
    d.forEach((item, idx) => {
        const fin = getCalc(item.scores).final;
        const isRemedial = parseFloat(fin) < 75.0;
        const naColor = isRemedial ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50/20';

        if(appUser.role === 'wakasek' || editGradeId === item.id) {
            if(editGradeId !== item.id) {
                html += `<tr class="hover:bg-blue-50/50 transition-colors print:bg-white"><td class="px-4 py-3 text-center">${idx+1}</td><td class="px-4 py-3"><div class="font-medium">${item.studentName}</div><div class="text-xs text-gray-400">${item.nisn||'-'}</div></td><td class="px-4 py-3 text-center">${ds(item.scores.f1)}</td><td class="px-4 py-3 text-center">${ds(item.scores.f2)}</td><td class="px-4 py-3 text-center">${ds(item.scores.f3)}</td><td class="px-4 py-3 text-center">${ds(item.scores.t1)}</td><td class="px-4 py-3 text-center">${ds(item.scores.t2)}</td><td class="px-4 py-3 text-center">${ds(item.scores.t3)}</td><td class="px-4 py-3 text-center font-bold text-emerald-700">${ds(item.scores.asaj)}</td><td class="px-4 py-3 text-center font-bold ${naColor}">${fin}</td></tr>`;
            }
        } else {
            html += `<tr data-id="${item.id}" class="hover:bg-blue-50/50 transition-colors">
                <td class="px-4 py-3 text-center">${idx+1}</td>
                <td class="px-4 py-3"><div>${item.studentName}</div><div class="text-xs text-gray-400">${item.nisn||'-'}</div></td>
                <td class="px-2 py-3"><input type="number" data-f="f1" value="${ds(item.scores.f1)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="f2" value="${ds(item.scores.f2)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="f3" value="${ds(item.scores.f3)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="t1" value="${ds(item.scores.t1)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="t2" value="${ds(item.scores.t2)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="t3" value="${ds(item.scores.t3)}" class="w-full border rounded p-1 text-center text-sm outline-none"></td>
                <td class="px-2 py-3"><input type="number" data-f="asaj" value="${ds(item.scores.asaj)}" class="w-full border rounded p-1 text-center text-sm font-bold text-emerald-700 outline-none"></td>
                <td class="px-4 py-3 text-center font-bold ${naColor} cell-na">${fin}</td>
                <td class="px-4 py-3 text-right"><button type="button" class="btn-edit p-1.5 text-blue-600 rounded"><i class="ph ph-pencil-simple text-lg pointer-events-none"></i></button><button type="button" class="btn-del p-1.5 text-red-600 rounded"><i class="ph ph-trash text-lg pointer-events-none"></i></button></td>
            </tr>`;
        }
    });
    
    const newRowHTML = rowNewGrade ? rowNewGrade.outerHTML : '';
    gradesTbody.innerHTML = (appUser.role === 'guru' ? newRowHTML : '') + html;
    window.renderTable = renderTable;
}

export function renderMasterDataUI() {
    const clsList = document.getElementById('master-class-list');
    const subList = document.getElementById('master-subject-list');
    if (clsList) clsList.innerHTML = MASTER_CLASSES.map((c, i) => `<div class="flex justify-between p-2 border rounded mb-2 shadow-sm"><span>${c}</span><button onclick="window.deleteMasterClass(${i})" class="text-red-500"><i class="ph ph-trash"></i></button></div>`).join('');
    if (subList) subList.innerHTML = MASTER_SUBJECTS.map((s, i) => `<div class="flex justify-between p-2 border rounded mb-2 shadow-sm"><span>${s}</span><button onclick="window.deleteMasterSubject(${i})" class="text-red-500"><i class="ph ph-trash"></i></button></div>`).join('');
}

export function populateDropdowns() {
    const clsOpts = `<option value="">-- Pilih Kelas --</option>` + MASTER_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('');
    const subOpts = `<option value="">-- Pilih Mapel --</option>` + MASTER_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('');
    ['import-class-select', 'delete-class-select', 'filter-kelas', 'crud-siswa-kelas-filter'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = clsOpts; });
    const elMapel = document.getElementById('filter-mapel');
    if(elMapel) elMapel.innerHTML = subOpts;
}
