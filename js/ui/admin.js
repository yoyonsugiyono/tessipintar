// File: js/ui/admin.js

// PERUBAHAN: Menambahkan getDocs pada import
import { doc, deleteDoc, updateDoc, addDoc, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, getGradesCollection } from '../config/firebase.js';
import { USERS_DB, getActiveTahun, getActiveSemester } from '../services/auth.js';
import { MASTER_CLASSES, MASTER_SUBJECTS } from '../services/db-master.js';
import { renderTableGuru, renderTableSiswa, gradesData } from './tables.js';
import { writeLog } from '../services/audit.js';

export function setupAdminEvents() {
    // A. Download Data Siswa Berbasis Database
    const btnTemplateSiswa = document.getElementById('btn-template-siswa');
    if (btnTemplateSiswa) {
        btnTemplateSiswa.onclick = () => {
            const cls = document.getElementById('import-class-select').value;
            const thn = getActiveTahun();
            const smt = getActiveSemester();

            const clsData = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
            const map = new Map();
            clsData.forEach(g => {
                const key = g.studentName + "_" + (g.nisn || '');
                if (!map.has(key)) map.set(key, { "Nama Siswa": g.studentName, "NISN": g.nisn || "", "Kelas": g.className });
            });
            
            let dataToExport = Array.from(map.values());
            if (dataToExport.length === 0) dataToExport = [{ "Nama Siswa": "Contoh Nama", "NISN": "000000", "Kelas": cls || "X-1" }];

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DataSiswa");
            XLSX.writeFile(wb, `Data_Siswa_${cls || 'Semua'}.xlsx`);
        };
    }

    // B. Download Data Guru
    const btnTemplateGuru = document.getElementById('btn-template-guru');
    if (btnTemplateGuru) {
        btnTemplateGuru.onclick = () => {
            const dataToExport = USERS_DB.map(u => ({ "Username": u.username, "Role": u.role, "Password": u.password }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DataGuru");
            XLSX.writeFile(wb, "Data_Akun_Guru.xlsx");
        };
    }

    // C. Import Siswa Masal (Otomatis Semua Mapel)
    const importXlsxSiswa = document.getElementById('import-xlsx-siswa');
    if (importXlsxSiswa) {
        importXlsxSiswa.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    let count = 0;
                    for(let row of json) {
                        let n = String(row["Nama Siswa"] || "").trim();
                        let cls = String(row["Kelas"] || "").trim();
                        if(!n || !cls) continue;
                        for(const s of MASTER_SUBJECTS) {
                            await addDoc(getGradesCollection(), { 
                                studentName: n, nisn: String(row["NISN"] || ""), teacherName: 'admin', subject: s, className: cls, 
                                tahun: getActiveTahun(), semester: getActiveSemester(), 
                                scores: { f1:null, f2:null, f3:null, t1:null, t2:null, t3:null, asaj:null }, 
                                results: { avgFormative:0, avgTask:0, final:0 }, createdAt: serverTimestamp() 
                            });
                        }
                        count++;
                    }
                    alert(`Impor ${count} siswa berhasil!`);
                    renderTableSiswa();
                } catch(err) { alert("Format Excel salah."); }
                e.target.value = null;
            };
            reader.readAsArrayBuffer(file);
        };
    }

    // D. Listener Filter Kelas Admin
    const filterKelasSiswa = document.getElementById('crud-siswa-kelas-filter');
    if (filterKelasSiswa) {
        filterKelasSiswa.addEventListener('change', () => {
            renderTableSiswa();
        });
    }

    // E. Fitur Hapus Kelas Masal
    const btnDeleteClass = document.getElementById('btn-delete-class');
    const deleteClassSelect = document.getElementById('delete-class-select');
    
    if (deleteClassSelect && btnDeleteClass) {
        deleteClassSelect.addEventListener('change', (e) => {
            if(e.target.value) {
                btnDeleteClass.disabled = false;
                btnDeleteClass.classList.replace('bg-gray-300', 'bg-red-600');
            } else {
                btnDeleteClass.disabled = true;
                btnDeleteClass.classList.replace('bg-red-600', 'bg-gray-300');
            }
        });

        btnDeleteClass.onclick = async () => {
            const cls = deleteClassSelect.value;
            const thn = getActiveTahun();
            const smt = getActiveSemester();
            if(!cls) return;

            if(!confirm(`Yakin ingin MENGHAPUS SEMUA DATA nilai kelas ${cls} periode ${thn} ${smt}?`)) return;

            try {
                const docsToDelete = gradesData.filter(g => g.className === cls && g.tahun === thn && g.semester === smt);
                if (docsToDelete.length === 0) { alert("Data tidak ditemukan."); return; }

                btnDeleteClass.textContent = "MENGHAPUS...";
                const batch = writeBatch(db);
                docsToDelete.forEach(d => batch.delete(doc(getGradesCollection(), d.id)));
                await batch.commit();

                await writeLog("HAPUS_KELAS_MASAL", `Menghapus data kelas ${cls}.`);
                alert(`Berhasil menghapus ${docsToDelete.length} data.`);
                deleteClassSelect.value = '';
                btnDeleteClass.disabled = true;
                btnDeleteClass.textContent = "EKSEKUSI PENGHAPUSAN";
                renderTableSiswa();
            } catch (err) { alert("Gagal menghapus."); }
        };
    }

    // F. Reset Seluruh Data Siswa (Semua Kelas & Periode)
    const btnResetSiswa = document.getElementById('btn-reset-siswa');
    if (btnResetSiswa) {
        btnResetSiswa.onclick = async () => {
            if(!confirm("PERINGATAN BAHAYA: Anda yakin ingin MENGHAPUS SELURUH DATA SISWA secara permanen? Data yang dihapus tidak bisa dikembalikan!")) return;
            
            const pass = prompt("Untuk melanjutkan, ketik kata: HAPUS");
            if (pass !== "HAPUS") {
                alert("Proses dibatalkan.");
                return;
            }

            try {
                btnResetSiswa.innerHTML = '<i class="ph ph-spinner animate-spin text-xl"></i> SEDANG MENGHAPUS...';
                btnResetSiswa.disabled = true;

                // Mengambil seluruh dokumen di koleksi grades (data siswa & nilai)
                const snapshot = await getDocs(getGradesCollection());
                
                if (snapshot.empty) {
                    alert("Database siswa sudah dalam keadaan kosong.");
                    btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                    btnResetSiswa.disabled = false;
                    return;
                }

                // Hapus semua data
                const promises = [];
                snapshot.forEach(d => {
                    promises.push(deleteDoc(doc(getGradesCollection(), d.id)));
                });
                await Promise.all(promises); // Tunggu sampai semuanya terhapus

                await writeLog("RESET_DATA_SISWA", `Admin mengosongkan seluruh database siswa (${promises.length} dokumen terhapus).`);
                alert(`Selesai! Sebanyak ${promises.length} dokumen siswa berhasil dihapus secara permanen.`);
                
                btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                btnResetSiswa.disabled = false;
                renderTableSiswa(); // Refresh UI
            } catch (err) {
                console.error("Gagal reset data siswa:", err);
                alert("Terjadi kesalahan saat menghapus data.");
                btnResetSiswa.innerHTML = '<i class="ph ph-users-three text-xl"></i> Kosongkan Data Siswa';
                btnResetSiswa.disabled = false;
            }
        };
    }

    // G. Reset Database Sekolah
    const btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) {
        btnResetDb.onclick = async () => {
            if(!confirm("Reset seluruh database sekolah? (Termasuk data guru dan pengaturan)")) return;
            await writeLog("RESET_DATABASE", "Request reset total database.");
            alert("Tindakan dicatat di Log Audit. Untuk keamanan, hapus seluruh data master & guru dilakukan manual di Firebase Console.");
        };
    }
}

// ========================================================
// GLOBAL: Edit Siswa oleh Admin (Batch)
// ========================================================
window.editSiswa = async (encN, encI, encC) => {
    const oldName = decodeURIComponent(encN);
    const oldNisn = decodeURIComponent(encI);
    const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    const newName = prompt("Edit Nama Lengkap Siswa:", oldName);
    if(!newName || newName.trim() === '') return;
    const newNisn = prompt("Edit NISN:", oldNisn) || "";

    try {
        const docsToUpdate = gradesData.filter(g =>
            g.className === studentClass && g.tahun === thn && g.semester === smt &&
            g.studentName === oldName && (g.nisn || '') === oldNisn
        );

        if(docsToUpdate.length > 0) {
            const batch = writeBatch(db);
            docsToUpdate.forEach(d => {
                batch.update(doc(getGradesCollection(), d.id), { studentName: newName, nisn: newNisn, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            alert(`Siswa ${oldName} berhasil diupdate!`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal update."); }
};

// ========================================================
// GLOBAL: Hapus Siswa oleh Admin (Batch)
// ========================================================
window.deleteSiswa = async (encN, encI, encC) => {
    const name = decodeURIComponent(encN);
    const nisn = decodeURIComponent(encI);
    const studentClass = decodeURIComponent(encC);
    const thn = getActiveTahun();
    const smt = getActiveSemester();

    if(!confirm(`Hapus seluruh data nilai "${name}" di kelas ${studentClass}?`)) return;

    try {
        const docsToDelete = gradesData.filter(g =>
            g.className === studentClass && g.tahun === thn && g.semester === smt &&
            g.studentName === name && (g.nisn || '') === nisn
        );

        if(docsToDelete.length > 0) {
            const batch = writeBatch(db);
            docsToDelete.forEach(d => batch.delete(doc(getGradesCollection(), d.id)));
            await batch.commit();
            alert(`Data ${name} dihapus.`);
            renderTableSiswa();
        }
    } catch(err) { alert("Gagal hapus."); }
};
