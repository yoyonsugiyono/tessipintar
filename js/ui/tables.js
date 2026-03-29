// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { getCalc, weights, ds } from '../services/db-grades.js';
import { MASTER_CLASSES, MASTER_SUBJECTS, MASTER_TAHUN, DEFAULT_TAHUN } from '../services/db-master.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../config/firebase.js';

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

// ==========================================
// 1. RENDER TABEL GURU (DENGAN TUGAS TAMBAHAN)
// ==========================================
export async function renderTableGuru() {
    const tbody = document.getElementById('crud-guru-tbody');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500"><i class="ph ph-spinner animate-spin text-2xl"></i> Memuat data dari database...</td></tr>';

    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let usersList = [];
        usersSnap.forEach(doc => { usersList.push({ id: doc.id, ...doc.data() }); });

        // Update cache lokal
        USERS_DB.length = 0; 
        usersList.forEach(u => USERS_DB.push(u));

        if (usersList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada data pengguna terdaftar.</td></tr>';
            return;
        }

        tbody.innerHTML = usersList.map((u, i) => {
            const isAdmin = u.role === 'admin';
            const isWali = u.tugasTambahan === 'Wali Kelas' || u.jabatan === 'Wali Kelas';
            const isWakasek = u.tugasTambahan === 'Wakasek Kurikulum' || u.role === 'wakasek';
            
            let jabatanHtml = '';
            if (isAdmin) {
                jabatanHtml = `<div class="font-bold text-red-600 uppercase tracking-wider text-xs">Administrator</div>`;
            } else {
                jabatanHtml = `<div class="font-bold text-gray-800 text-xs">Guru Mata Pelajaran</div>`;
                if (isWali && u.waliKelas) {
                    jabatanHtml += `<div class="text-[10px] text-blue-600 mt-1 font-bold flex items-center gap-1"><i class="ph ph-star-fill"></i> Tugas: Wali Kelas <span class="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">${u.waliKelas}</span></div>`;
                } else if (isWakasek) {
                    jabatanHtml += `<div class="text-[10px] text-purple-600 mt-1 font-bold flex items-center gap-1"><i class="ph ph-star-fill"></i> Tugas: Wakasek Kurikulum</div>`;
                }
            }

            return `
                <tr class="border-b hover:bg-gray-50 transition-colors">
                    <td class="p-3 text-center text-gray-500">${i+1}</td>
                    <td class="p-3 font-medium text-gray-800">${u.username}</td>
                    <td class="p-3">${jabatanHtml}</td>
                    <td class="p-3 font-mono text-gray-400 text-xs">${u.password}</td>
                    <td class="p-3 text-right whitespace-nowrap">
                       <button onclick="window.openResetSandi('${u.id}', '${encodeURIComponent(u.username)}')" class="text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 p-1.5 rounded transition-colors mr-2" title="Reset Sandi"><i class="ph ph-key text-lg"></i></button>
                       <button onclick="window.editGuru('${u.id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Atur Tugas Tambahan"><i class="ph ph-briefcase text-lg"></i></button>
                       <button onclick="window.deleteGuru('${u.id}', '${encodeURIComponent(u.username)}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Akun"><i class="ph ph-trash text-lg"></i></button>
                    </td>
                </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-red-500">Gagal mengambil data server.</td></tr>';
    }
}

export function renderTableSiswa() {
    const tbody = document.getElementById('crud-siswa-tbody');
    const filter = document.getElementById('crud-siswa-kelas-filter');
    const appUser = getAppUser();
    
    if(!tbody || !filter || !appUser) return;
    
    const thn = getActiveTahun();
    const smt = getActiveSemester();
    let clsData = gradesData.filter(g => g.tahun === thn && g.semester === smt);

    const isWali = appUser.role !== 'admin' && (appUser.tugasTambahan === 'Wali Kelas' || appUser.jabatan === 'Wali Kelas');

    if (isWali && appUser.waliKelas) {
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
    const isWakasek = appUser.role === 'wakasek' || appUser.tugasTambahan === 'Wakasek Kurikulum';
    
    if (appUser.role === 'guru' && !isWakasek) {
        d = d.filter(g => g.teacherName === appUser.username || g.teacherName === 'admin');
    }
    
    if(selSubject) d = d.filter(g => g.subject === selSubject);
    if(selClass) d = d.filter(g => g.className === selClass);
    if(wFilter !== 'all') d = d.filter(g => g.teacherName === wFilter);
    if(searchQuery) d = d.filter(g => g.studentName.toLowerCase().includes(searchQuery));
    
    return d;
}

export function renderTable() {
    const appUser = getAppUser();
    const tableCont = document.getElementById('table-container');
    const gradesTbody = document.getElementById('grades-tbody');
    const emptyState = document.getElementById('empty-state-nilai');

    if(!appUser || !tableCont || !gradesTbody) return;

    if(!selClass || ((appUser.role === 'guru' || appUser.role === 'admin') && !selSubject)) {
        if(emptyState) emptyState.classList.remove('hidden');
        tableCont.classList.add('hidden');
        return;
    }

    if(emptyState) emptyState.classList.add('hidden');
    tableCont.classList.remove('hidden');

    if(document.getElementById('badge-guru')) {
        document.getElementById('badge-guru').classList.toggle('hidden', appUser.role === 'guru');
        document.getElementById('badge-guru').textContent = wFilter === 'all' ? 'Semua Guru' : wFilter;
    }
    if(document.getElementById('badge-kelas')) document.getElementById('badge-kelas').textContent = selClass;
    if(document.getElementById('badge-mapel')) document.getElementById('badge-mapel').textContent = selSubject || 'Semua Mapel';
    
    if(appUser.role === 'guru' || appUser.role === 'admin') {
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
            const naIcon = isRemedial ? '<i class="ph ph-warning-circle text-red-500 mr-1"></i>' : '';
            const bgA = 'bg-emerald-50/50 text-emerald-700 font-bold';

            if(appUser.role === 'wakasek' || editGradeId === item.id) {
                if(editGradeId !== item.id) {
                    html += `
                    <tr class="hover:bg-blue-50/50 border-b border-gray-100 transition-colors print:bg-white">
                        <td class="px-4 py-3 text-center text-gray-500 text-xs">${idx+1}</td>
                        <td class="px-4 py-3">
                            <div class="font-bold text-gray-800">${item.studentName}</div>
                            <div class="text-[10px] text-gray-400 font-mono">${item.nisn||'-'}</div>
                            ${appUser.role==='wakasek' || appUser.role==='admin' ? `<div class="text-[9px] text-blue-500 font-bold uppercase mt-1">${item.teacherName} | ${item.subject}</div>` : ''}
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
                            <button type="button" class="btn-edit p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data Siswa"><i class="ph ph-book-open text-lg pointer-events-none"></i></button>
                            <button type="button" class="btn-del p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Siswa"><i class="ph ph-trash text-lg pointer-events-none"></i></button>
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

    const rowNewGrade = document.getElementById('row-new-grade');
    const newRowHTML = rowNewGrade ? rowNewGrade.outerHTML : '';

    gradesTbody.innerHTML = (appUser.role === 'guru' || appUser.role === 'admin' ? newRowHTML : '') + html;
    
    const rowNewGradeAfter = document.getElementById('row-new-grade');
    if(rowNewGradeAfter && !editGradeId && (appUser.role === 'guru' || appUser.role === 'admin')) {
        rowNewGradeAfter.classList.remove('hidden');
    }
    
    window.renderTable = renderTable;
}

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

export function populateDropdowns() {
    const allTahun = [...new Set([...DEFAULT_TAHUN, ...MASTER_TAHUN])].sort();
    const thnOpts = allTahun.map(t => `<option value="${t}">${t}</option>`).join('');
    ['login-tahun', 'dash-filter-tahun', 'copy-tahun-asal'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { const oldVal = el.value; el.innerHTML = thnOpts; if (oldVal && allTahun.includes(oldVal)) el.value = oldVal; }
    });

    const appUser = getAppUser();
    
    const dbClasses = [...new Set(gradesData.map(g => g.className))].filter(Boolean);
    let allClasses = [...new Set([...MASTER_CLASSES, ...dbClasses])].sort();
    
    const isWali = appUser && appUser.role !== 'admin' && (appUser.tugasTambahan === 'Wali Kelas' || appUser.jabatan === 'Wali Kelas');
    if (isWali && appUser.waliKelas) {
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
