// File: js/ui/tables.js

import { getAppUser, getActiveTahun, getActiveSemester, USERS_DB } from '../services/auth.js';
import { MASTER_CLASSES } from '../services/db-master.js';
// Nanti kita akan import gradesData dari db-grades.js
export let gradesData = []; 

export function setGradesData(data) {
    gradesData = data;
}

// Render Tabel Guru (Admin)
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

// Render Tabel Siswa (Admin)
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

    const activeTahun = getActiveTahun();
    const activeSemester = getActiveSemester();

    const clsData = gradesData.filter(g => g.className === cls && g.tahun === activeTahun && g.semester === activeSemester);
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
        html += `<tr class="border-b hover:bg-gray-50 transition-colors"><td class="p-3 text-center text-gray-500">${i+1}</td><td class="p-3 font-medium text-gray-800">${s.name}</td><td class="p-3 font-mono text-gray-500">${s.nisn||'-'}</td><td class="p-3 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">${s.className}</span></td><td class="p-3 text-right"><button onclick="window.editSiswa('${encName}', '${encNisn}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mr-2" title="Edit Siswa"><i class="ph ph-pencil-simple text-lg"></i></button><button onclick="window.deleteSiswa('${encName}', '${encNisn}')" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus Siswa"><i class="ph ph-trash text-lg"></i></button></td></tr>`;
    });
    crudSiswaTbody.innerHTML = html || `<tr><td colspan="5" class="p-8 text-center text-gray-400">Tidak ada data siswa untuk kelas ${cls} pada periode ini.</td></tr>`;
}
